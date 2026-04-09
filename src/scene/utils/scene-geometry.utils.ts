import { Coordinate, GeoBounds, Vector3 } from '../../places/types/place.types';
import {
  createBoundsFromCenterRadius,
  isFiniteCoordinate,
  midpoint,
} from '../../places/utils/geo.utils';
import { SceneMeta } from '../types/scene.types';

export function resolveSceneBounds(
  center: Coordinate,
  radiusM: number,
): GeoBounds {
  return createBoundsFromCenterRadius(center, radiusM);
}

export function computeSceneCamera(
  origin: Coordinate,
  bounds: GeoBounds,
  geometry: Pick<SceneMeta, 'buildings' | 'roads' | 'walkways'>,
): SceneMeta['camera'] {
  const points = [
    ...geometry.buildings.flatMap((building) => building.footprint),
    ...geometry.roads.flatMap((road) => road.path),
    ...geometry.walkways.flatMap((walkway) => walkway.path),
  ].filter(isFiniteCoordinate);

  const localPoints =
    points.length > 0
      ? points.map((point) => toLocalPoint(origin, point))
      : [
          toLocalPoint(origin, bounds.northEast),
          toLocalPoint(origin, bounds.southWest),
        ];

  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;

  for (const point of localPoints) {
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minZ = Math.min(minZ, point.z);
    maxZ = Math.max(maxZ, point.z);
  }

  const centerX = (minX + maxX) / 2;
  const centerZ = (minZ + maxZ) / 2;
  const span = Math.max(maxX - minX, maxZ - minZ, 60);
  const walkAnchor =
    pickWalkAnchor(
      geometry.walkways.map((walkway) => walkway.path),
      origin,
    ) ??
    pickWalkAnchor(
      geometry.roads.map((road) => road.path),
      origin,
    );

  const walkPoint = walkAnchor
    ? toLocalPoint(origin, walkAnchor)
    : { x: centerX, z: centerZ + span * 0.15 };

  return {
    topView: {
      x: round(centerX),
      y: round(Math.max(120, span * 1.1)),
      z: round(centerZ + Math.max(60, span * 0.35)),
    },
    walkViewStart: {
      x: round(walkPoint.x),
      y: 1.7,
      z: round(walkPoint.z),
    },
  };
}

function pickWalkAnchor(
  paths: Coordinate[][],
  origin: Coordinate,
): Coordinate | null {
  let best: { point: Coordinate; distance: number } | null = null;

  for (const path of paths) {
    const point = midpoint(path);
    if (!point || !isFiniteCoordinate(point)) {
      continue;
    }

    const dx = point.lng - origin.lng;
    const dy = point.lat - origin.lat;
    const distance = dx * dx + dy * dy;
    if (!best || distance < best.distance) {
      best = { point, distance };
    }
  }

  return best?.point ?? null;
}

function toLocalPoint(
  origin: Coordinate,
  point: Coordinate,
): { x: number; z: number } {
  const metersPerLat = 111_320;
  const metersPerLng = 111_320 * Math.cos((origin.lat * Math.PI) / 180);
  return {
    x: (point.lng - origin.lng) * metersPerLng,
    z: -(point.lat - origin.lat) * metersPerLat,
  };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
