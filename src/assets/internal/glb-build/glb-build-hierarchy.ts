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
    selectiveLoadCandidate: true,
    progressiveChunkKey: category,
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
    case 'vegetation':
      return 'Vegetation';
    case 'landmark':
      return 'Landmarks';
    case 'signage':
      return 'Signage';
    case 'street_furniture':
      return 'StreetFurniture';
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
  const lodParents = createBuildingLodGroups(
    doc,
    sceneMeta.sceneId,
    buildingsParent,
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
      selectionLod: building.lodLevel,
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
    const lodKey = building.lodLevel ?? 'MEDIUM';
    const lodParent = lodParents.get(lodKey) ?? buildingsParent;
    lodParent.addChild(node);
    semanticGroupNodes.set(`building:${building.objectId}`, node);
  }
}

function createBuildingLodGroups(
  doc: GltfDoc,
  sceneId: string,
  buildingsParent: GltfNode,
  semanticGroupNodes: Map<string, GltfNode>,
): Map<'HIGH' | 'MEDIUM' | 'LOW', GltfNode> {
  const lods: Array<'HIGH' | 'MEDIUM' | 'LOW'> = ['HIGH', 'MEDIUM', 'LOW'];
  const map = new Map<'HIGH' | 'MEDIUM' | 'LOW', GltfNode>();
  for (const lod of lods) {
    const node = doc.createNode(`grp_building_lod_${lod.toLowerCase()}`);
    applyExtras(node, {
      sceneId,
      semanticCategory: 'building',
      dccCollection: `Buildings_${lod}`,
      blenderCollection: `Buildings_${lod}`,
      isGroupNode: true,
      selectionLod: lod,
      selectiveLoadCandidate: true,
      progressiveChunkKey: `building_lod_${lod.toLowerCase()}`,
    });
    buildingsParent.addChild(node);
    map.set(lod, node);
    semanticGroupNodes.set(`building_lod:${lod}`, node);
  }
  return map;
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
