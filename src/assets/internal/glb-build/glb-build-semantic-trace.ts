import { hashValue } from './glb-build-utils';

export function resolveSemanticCategory(name: string): string {
  if (name.startsWith('building_') || name.startsWith('landmark_')) {
    return 'building';
  }
  if (
    name.startsWith('road_') ||
    name.includes('crosswalk') ||
    name.includes('lane_overlay') ||
    name.includes('junction_overlay') ||
    name.includes('sidewalk') ||
    name.includes('curb') ||
    name.includes('median')
  ) {
    return 'transport';
  }
  if (
    name.includes('traffic_light') ||
    name.includes('street_light') ||
    name.includes('sign_pole') ||
    name.includes('tree') ||
    name.includes('bush') ||
    name.includes('flower') ||
    name.includes('poi') ||
    name.includes('landcover') ||
    name.includes('linear_')
  ) {
    return 'street_context';
  }
  return 'scene';
}

export function resolveSemanticCoverage(
  sourceCount?: number,
  selectedCount?: number,
): 'NONE' | 'PARTIAL' | 'FULL' {
  if ((sourceCount ?? 0) <= 0) {
    return 'NONE';
  }
  if ((selectedCount ?? 0) >= (sourceCount ?? 0)) {
    return 'FULL';
  }
  return 'PARTIAL';
}

export function resolveTwinEntityIds(
  sceneId: string,
  meshName: string,
  semanticCategory: string,
  sourceObjectIds: string[],
): string[] {
  if (!resolveTwinEntityKind(meshName, semanticCategory)) {
    return [];
  }
  return sourceObjectIds.map((objectId) =>
    createTwinEntityId(sceneId, objectId),
  );
}

export function resolveTwinComponentIds(
  sceneId: string,
  meshName: string,
  semanticCategory: string,
  sourceObjectIds: string[],
): string[] {
  const componentLabel = resolveTwinComponentLabel(meshName, semanticCategory);
  const componentKind = resolveTwinComponentKind(meshName, semanticCategory);
  if (!componentLabel || !componentKind) {
    return [];
  }
  return sourceObjectIds.map((objectId) =>
    createTwinComponentId(sceneId, objectId, componentKind, componentLabel),
  );
}

export function resolveSourceSnapshotIds(
  sceneId: string,
  meshName: string,
  semanticCategory: string,
): string[] {
  if (semanticCategory === 'building') {
    if (
      meshName.includes('panels') ||
      meshName.includes('windows') ||
      meshName.includes('hero_') ||
      meshName.includes('billboard') ||
      meshName.includes('landmark')
    ) {
      return [
        createSnapshotId(sceneId, 'OVERPASS', 'PLACE_PACKAGE'),
        createSnapshotId(sceneId, 'SCENE_PIPELINE', 'SCENE_DETAIL'),
        createSnapshotId(sceneId, 'SCENE_PIPELINE', 'SCENE_META'),
      ];
    }
    return [
      createSnapshotId(sceneId, 'OVERPASS', 'PLACE_PACKAGE'),
      createSnapshotId(sceneId, 'SCENE_PIPELINE', 'SCENE_META'),
    ];
  }

  if (semanticCategory === 'transport') {
    if (
      meshName.includes('crosswalk') ||
      meshName.includes('road_markings') ||
      meshName.includes('lane_overlay') ||
      meshName.includes('junction_overlay')
    ) {
      return [createSnapshotId(sceneId, 'SCENE_PIPELINE', 'SCENE_DETAIL')];
    }
    return [
      createSnapshotId(sceneId, 'OVERPASS', 'PLACE_PACKAGE'),
      createSnapshotId(sceneId, 'SCENE_PIPELINE', 'SCENE_META'),
    ];
  }

  if (semanticCategory === 'street_context') {
    return [
      createSnapshotId(sceneId, 'OVERPASS', 'PLACE_PACKAGE'),
      createSnapshotId(sceneId, 'SCENE_PIPELINE', 'SCENE_DETAIL'),
    ];
  }

  return [createSnapshotId(sceneId, 'SCENE_PIPELINE', 'SCENE_META')];
}

export function resolveTwinEntityKind(
  meshName: string,
  semanticCategory: string,
): string | null {
  if (semanticCategory === 'building') {
    return meshName === 'landmark_extras' ? 'LANDMARK' : 'BUILDING';
  }
  if (semanticCategory === 'transport') {
    if (meshName.includes('sidewalk')) {
      return 'WALKWAY';
    }
    if (meshName.includes('crosswalk')) {
      return 'CROSSING';
    }
    if (
      meshName === 'road_base' ||
      meshName === 'road_edges' ||
      meshName === 'curbs' ||
      meshName === 'medians'
    ) {
      return 'ROAD';
    }
    return null;
  }
  if (semanticCategory === 'street_context') {
    if (
      meshName.includes('traffic_light') ||
      meshName.includes('street_light') ||
      meshName.includes('sign_pole') ||
      meshName.includes('bench') ||
      meshName.includes('bike_rack') ||
      meshName.includes('trash_can') ||
      meshName.includes('fire_hydrant')
    ) {
      return 'STREET_FURNITURE';
    }
    if (
      meshName.includes('tree') ||
      meshName.includes('bush') ||
      meshName.includes('flower')
    ) {
      return 'VEGETATION';
    }
    if (meshName.includes('poi')) {
      return 'POI';
    }
    if (meshName.includes('landcover')) {
      return 'LAND_COVER';
    }
    if (meshName.includes('linear_')) {
      return 'LINEAR_FEATURE';
    }
  }
  return null;
}

export function resolveTwinComponentKind(
  meshName: string,
  semanticCategory: string,
): 'SPATIAL' | 'STRUCTURE' | 'APPEARANCE' | null {
  if (semanticCategory === 'building') {
    if (meshName.includes('shells') || meshName.includes('roof_surfaces')) {
      return 'STRUCTURE';
    }
    return 'APPEARANCE';
  }
  if (semanticCategory === 'transport') {
    if (meshName.includes('sidewalk')) {
      return 'SPATIAL';
    }
    if (meshName.includes('crosswalk')) {
      return 'STRUCTURE';
    }
    if (
      meshName === 'road_base' ||
      meshName === 'road_edges' ||
      meshName === 'curbs' ||
      meshName === 'medians'
    ) {
      return 'STRUCTURE';
    }
    return null;
  }
  if (semanticCategory === 'street_context') {
    if (
      meshName.includes('tree') ||
      meshName.includes('bush') ||
      meshName.includes('flower')
    ) {
      return 'STRUCTURE';
    }
    return 'SPATIAL';
  }
  return null;
}

export function resolveTwinComponentLabel(
  meshName: string,
  semanticCategory: string,
): string | null {
  if (semanticCategory === 'building') {
    if (meshName.includes('shells') || meshName.includes('roof_surfaces')) {
      return 'Building Structure';
    }
    return 'Building Appearance';
  }
  if (semanticCategory === 'transport') {
    if (meshName.includes('sidewalk')) {
      return 'Walkway Spatial';
    }
    if (meshName.includes('crosswalk')) {
      return 'Crossing Structure';
    }
    if (
      meshName === 'road_base' ||
      meshName === 'road_edges' ||
      meshName === 'curbs' ||
      meshName === 'medians'
    ) {
      return 'Road Structure';
    }
    return null;
  }
  if (semanticCategory === 'street_context') {
    if (
      meshName.includes('tree') ||
      meshName.includes('bush') ||
      meshName.includes('flower')
    ) {
      return 'Vegetation Structure';
    }
    if (meshName.includes('poi')) {
      return 'POI Spatial';
    }
    if (meshName.includes('landcover')) {
      return 'Land Cover Spatial';
    }
    if (meshName.includes('linear_')) {
      return 'Linear Feature Spatial';
    }
    return 'Street Furniture Spatial';
  }
  return null;
}

export function createTwinEntityId(sceneId: string, objectId: string): string {
  return `entity-${hashValue(`${sceneId}:${objectId}`).slice(0, 12)}`;
}

export function createTwinComponentId(
  sceneId: string,
  objectId: string,
  kind: string,
  label: string,
): string {
  const entityId = createTwinEntityId(sceneId, objectId);
  return `component-${hashValue(`${entityId}:${kind}:${label}`).slice(0, 12)}`;
}

export function createSnapshotId(
  sceneId: string,
  provider: string,
  kind: string,
): string {
  return `snapshot-${hashValue(`${sceneId}:${provider}:${kind}`).slice(0, 12)}`;
}
