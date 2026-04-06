import type { Coordinate } from '../../../places/types/place.types';
import type { SceneMeta } from '../../../scene/types/scene.types';
import type { AccentTone } from '../materials/glb-material-factory';
import type { GeometryBuffers } from '../road/road-mesh.builder';
import { createEmptyGeometry } from '../road/road-mesh.builder';
import { normalizeLocalRing, toLocalRing } from './building-mesh-utils';
import { resolveAccentTone } from './building-mesh.tone.utils';
import { insetRing, pushExtrudedPolygon } from './building-mesh.shell.builder';

export function createBuildingRoofSurfaceGeometry(
  origin: Coordinate,
  buildings: SceneMeta['buildings'],
  triangulate: (
    vertices: number[],
    holes?: number[],
    dimensions?: number,
  ) => number[],
  tone: AccentTone,
): GeometryBuffers {
  const geometry = createEmptyGeometry();

  for (const building of buildings) {
    if (resolveRoofTone(building) !== tone) {
      continue;
    }
    const outerRing = normalizeLocalRing(
      toLocalRing(origin, building.outerRing),
      'CCW',
    );
    if (outerRing.length < 3) {
      continue;
    }
    const roofRing = insetRing(
      outerRing,
      building.roofType === 'gable' ? 0.08 : 0.05,
    );
    if (roofRing.length < 3) {
      continue;
    }
    const topHeight = Math.max(4, building.heightMeters);
    const slabMin = topHeight + 0.02;
    const slabMax = topHeight + (building.roofType === 'gable' ? 0.18 : 0.12);
    pushExtrudedPolygon(geometry, roofRing, [], slabMin, slabMax, triangulate);
  }

  return geometry;
}

function resolveRoofTone(building: SceneMeta['buildings'][number]): AccentTone {
  const explicit = building.roofColor ?? building.facadeColor;
  if (explicit) {
    return resolveAccentTone([explicit]);
  }
  if (building.roofType === 'gable') {
    return 'warm';
  }
  return building.preset === 'glass_tower' ? 'cool' : 'neutral';
}
