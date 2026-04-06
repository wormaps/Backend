import type { Coordinate } from '../../places/types/place.types';
import type { Vec3 } from './road-mesh.builder';

export function toLocalPoint(origin: Coordinate, point: Coordinate): Vec3 {
  const metersPerLat = 111_320;
  const metersPerLng = 111_320 * Math.cos((origin.lat * Math.PI) / 180);
  const x = (point.lng - origin.lng) * metersPerLng;
  const z = -(point.lat - origin.lat) * metersPerLat;
  return [x, 0, z];
}

export function toLocalRing(origin: Coordinate, points: Coordinate[]): Vec3[] {
  const deduped = points.filter((point, index) => {
    const prev = points[index - 1];
    return !prev || prev.lat !== point.lat || prev.lng !== point.lng;
  });
  const normalized = [...deduped];
  if (normalized.length > 1) {
    const first = normalized[0];
    const last = normalized[normalized.length - 1];
    if (first.lat === last.lat && first.lng === last.lng) {
      normalized.pop();
    }
  }

  return normalized
    .map((point) => toLocalPoint(origin, point))
    .filter((point) => isFiniteVec3(point));
}

export function normalizeLocalRing(
  ring: Vec3[],
  direction: 'CW' | 'CCW',
): Vec3[] {
  if (ring.length < 3) {
    return ring;
  }

  const signedArea = signedAreaXZ(ring);
  if (Math.abs(signedArea) <= 1e-6) {
    return ring;
  }

  const isClockwise = signedArea < 0;
  if (
    (direction === 'CW' && isClockwise) ||
    (direction === 'CCW' && !isClockwise)
  ) {
    return ring;
  }

  return [...ring].reverse();
}

export function samePointXZ(left: Vec3, right: Vec3): boolean {
  return (
    Math.abs(left[0] - right[0]) <= 1e-6 && Math.abs(left[2] - right[2]) <= 1e-6
  );
}

export function isFiniteVec3(vector: Vec3): boolean {
  return (
    Number.isFinite(vector[0]) &&
    Number.isFinite(vector[1]) &&
    Number.isFinite(vector[2])
  );
}

export function averagePoint(points: Vec3[]): Vec3 {
  const total = points.reduce(
    (acc, point) =>
      [acc[0] + point[0], acc[1] + point[1], acc[2] + point[2]] as Vec3,
    [0, 0, 0],
  );
  return [total[0] / points.length, 0, total[2] / points.length];
}

export function computeBounds(points: Vec3[]) {
  const xs = points.map((point) => point[0]);
  const zs = points.map((point) => point[2]);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minZ: Math.min(...zs),
    maxZ: Math.max(...zs),
    width: Math.max(...xs) - Math.min(...xs),
    depth: Math.max(...zs) - Math.min(...zs),
  };
}

export function isPolygonTooThin(points: Vec3[]): boolean {
  const bounds = computeBounds(points);
  const minDimension = Math.min(bounds.width, bounds.depth);
  return minDimension <= 1.5;
}

export function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace('#', '');
  const safe =
    normalized.length === 3
      ? normalized
          .split('')
          .map((char) => `${char}${char}`)
          .join('')
      : normalized;
  const value = Number.parseInt(safe, 16);
  return [
    ((value >> 16) & 255) / 255,
    ((value >> 8) & 255) / 255,
    (value & 255) / 255,
  ];
}

function signedAreaXZ(ring: Vec3[]): number {
  let area = 0;
  for (let index = 0; index < ring.length; index += 1) {
    const current = ring[index];
    const next = ring[(index + 1) % ring.length];
    area += current[0] * next[2] - next[0] * current[2];
  }
  return area / 2;
}
