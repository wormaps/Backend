import { Injectable } from '@nestjs/common';
import type {
  Coordinate,
  PlacePackage,
} from '../../../places/types/place.types';
import type {
  GeometryFallbackReason,
  SceneFacadeHint,
  SceneGeometryDiagnostic,
} from '../../types/scene.types';

@Injectable()
export class SceneGeometryDiagnosticsService {
  buildGeometryDiagnostics(
    placePackage: PlacePackage,
    facadeHints: SceneFacadeHint[],
  ): SceneGeometryDiagnostic[] {
    const hintMap = new Map(facadeHints.map((hint) => [hint.objectId, hint]));

    return placePackage.buildings.map((building) => {
      const complexity = classifyPolygonComplexity(building.outerRing);
      const hint = hintMap.get(building.id);
      const strategy =
        hint?.geometryStrategy ??
        (building.holes.length > 0
          ? 'courtyard_block'
          : complexity === 'complex'
            ? 'stepped_tower'
            : 'simple_extrude');
      const fallbackReason = determineFallbackReason(
        building.outerRing,
        building.holes,
      );
      const fallbackApplied = fallbackReason !== 'NONE';

      return {
        objectId: building.id,
        strategy,
        fallbackApplied,
        fallbackReason,
        hasHoles: building.holes.length > 0,
        polygonComplexity: complexity,
      };
    });
  }
}

function classifyPolygonComplexity(
  ring: Coordinate[],
): SceneGeometryDiagnostic['polygonComplexity'] {
  if (ring.length >= 10) {
    return 'complex';
  }
  if (ring.length >= 7) {
    return 'concave';
  }
  return 'simple';
}

function determineFallbackReason(
  outerRing: Coordinate[],
  holes: Coordinate[][],
): GeometryFallbackReason {
  if (holes.length > 0) {
    return 'HAS_HOLES';
  }
  if (outerRing.length < 3) {
    return 'DEGENERATE_RING';
  }
  if (ringHasVeryThinEdge(outerRing)) {
    return 'VERY_THIN_POLYGON';
  }
  return 'NONE';
}

function ringHasVeryThinEdge(ring: Coordinate[]): boolean {
  for (let index = 0; index < ring.length; index += 1) {
    const current = ring[index];
    const next = ring[(index + 1) % ring.length];
    if (squaredDistance(current, next) <= 1.2 ** 2) {
      return true;
    }
  }

  return false;
}

function squaredDistance(a: Coordinate, b: Coordinate): number {
  const dx = (a.lng - b.lng) * 111_320;
  const dy = (a.lat - b.lat) * 111_320;
  return dx * dx + dy * dy;
}
