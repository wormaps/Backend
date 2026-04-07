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
    const roofBoost = resolveRoofSurfaceBoost(building);
    const slabMin = topHeight + 0.02;
    const slabMax =
      topHeight +
      (building.roofType === 'gable'
        ? 0.2 + roofBoost * 0.05
        : 0.14 + roofBoost * 0.06);
    pushExtrudedPolygon(geometry, roofRing, [], slabMin, slabMax, triangulate);

    if ((building.roofSpec?.roofUnits ?? 0) >= 4) {
      const upperRing = insetRing(roofRing, 0.04 + roofBoost * 0.02);
      if (upperRing.length >= 3) {
        pushExtrudedPolygon(
          geometry,
          upperRing,
          [],
          slabMax,
          slabMax + 0.08 + roofBoost * 0.05,
          triangulate,
        );
      }
    }
  }

  return geometry;
}

function resolveRoofSurfaceBoost(
  building: SceneMeta['buildings'][number],
): number {
  const units = building.roofSpec?.roofUnits ?? 0;
  if (units >= 6) {
    return 1;
  }
  if (units >= 3) {
    return 0.65;
  }
  if (building.visualRole === 'hero_landmark') {
    return 0.55;
  }
  return 0.35;
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
