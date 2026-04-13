import { Coordinate } from '../../../places/types/place.types';
import { SceneMeta } from '../../../scene/types/scene.types';
import { toLocalPoint } from './geometry/glb-build-geometry-primitives.utils';
import { applyExtras } from './glb-build-material-cache';
import {
  createTwinEntityId,
  createTwinComponentId,
  createSnapshotId,
} from './glb-build-semantic-trace';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GltfNode = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GltfDoc = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GltfScene = any;

export function initializeDccHierarchy(
  doc: GltfDoc,
  scene: GltfScene,
  sceneId: string,
  semanticGroupNodes: Map<string, GltfNode>,
): void {
  const root = doc.createNode('dcc_root');
  applyExtras(root, {
    sceneId,
    semanticCategory: 'scene',
    dccCollection: 'Scene',
    blenderCollection: 'Scene',
    isGroupNode: true,
  });
  scene.addChild(root);
  semanticGroupNodes.set('scene_root', root);
}

export function resolveParentNode(
  doc: GltfDoc,
  scene: GltfScene,
  semanticCategory: string,
  semanticGroupNodes: Map<string, GltfNode>,
): GltfNode {
  const root = semanticGroupNodes.get('scene_root');
  const category = semanticCategory || 'scene';
  const key = `category:${category}`;
  const cached = semanticGroupNodes.get(key);
  if (cached) {
    return cached;
  }

  const label = resolveCategoryLabel(category);
  const node = doc.createNode(`grp_${category}`);
  applyExtras(node, {
    sceneId: scene.name ?? undefined,
    semanticCategory: category,
    dccCollection: label,
    blenderCollection: label,
    isGroupNode: true,
  });
  (root ?? scene).addChild(node);
  semanticGroupNodes.set(key, node);
  return node;
}

export function resolveMeshParent(
  doc: GltfDoc,
  scene: GltfScene,
  semanticCategory: string,
  sourceObjectIds: string[],
  semanticGroupNodes: Map<string, GltfNode>,
): GltfNode {
  if (semanticCategory === 'building' && sourceObjectIds.length === 1) {
    const buildingNode = semanticGroupNodes.get(
      `building:${sourceObjectIds[0]}`,
    );
    if (buildingNode) {
      return buildingNode;
    }
  }
  return resolveParentNode(doc, scene, semanticCategory, semanticGroupNodes);
}

export function resolveCategoryLabel(category: string): string {
  switch (category) {
    case 'transport':
      return 'Transport';
    case 'street_context':
      return 'StreetContext';
    case 'building':
      return 'Buildings';
    default:
      return 'SceneMisc';
  }
}

export function registerBuildingGroupNodes(
  doc: GltfDoc,
  scene: GltfScene,
  sceneMeta: SceneMeta,
  semanticGroupNodes: Map<string, GltfNode>,
): void {
  const buildingsParent = resolveParentNode(
    doc,
    scene,
    'building',
    semanticGroupNodes,
  );
  for (const building of sceneMeta.buildings) {
    const pivot = resolveBuildingPivot(sceneMeta.origin, building);
    const node = doc.createNode(`bld_${building.objectId}`);
    applyExtras(node, {
      sceneId: sceneMeta.sceneId,
      semanticCategory: 'building',
      dccCollection: 'Buildings',
      blenderCollection: 'Buildings',
      isGroupNode: true,
      objectId: building.objectId,
      osmWayId: building.osmWayId,
      buildingUsage: building.usage,
      pivotLocal: pivot,
      suggestedPivotPolicy: 'footprint_centroid',
      twinEntityId: createTwinEntityId(sceneMeta.sceneId, building.objectId),
      twinComponentIds: [
        createTwinComponentId(
          sceneMeta.sceneId,
          building.objectId,
          'IDENTITY',
          'Building Identity',
        ),
        createTwinComponentId(
          sceneMeta.sceneId,
          building.objectId,
          'SPATIAL',
          'Building Spatial',
        ),
      ],
      sourceSnapshotIds: [
        createSnapshotId(sceneMeta.sceneId, 'OVERPASS', 'PLACE_PACKAGE'),
        createSnapshotId(sceneMeta.sceneId, 'SCENE_PIPELINE', 'SCENE_META'),
      ],
    });
    buildingsParent.addChild(node);
    semanticGroupNodes.set(`building:${building.objectId}`, node);
  }
}

export function resolveBuildingPivot(
  origin: Coordinate,
  building: SceneMeta['buildings'][number],
): { x: number; y: number; z: number } {
  const points = building.outerRing
    .map((point) => toLocalPoint(origin, point))
    .filter(
      (point) =>
        Number.isFinite(point[0]) &&
        Number.isFinite(point[1]) &&
        Number.isFinite(point[2]),
    );
  if (points.length === 0) {
    return { x: 0, y: building.terrainOffsetM ?? 0, z: 0 };
  }
  const centroid = points.reduce(
    (acc, point) => ({
      x: acc.x + point[0],
      z: acc.z + point[2],
    }),
    { x: 0, z: 0 },
  );
  return {
    x: Number((centroid.x / points.length).toFixed(3)),
    y: Number((building.terrainOffsetM ?? 0).toFixed(3)),
    z: Number((centroid.z / points.length).toFixed(3)),
  };
}
