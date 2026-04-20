import type { Vec3 } from '../road/road-mesh.builder';
export {
  isFiniteVec3,
  normalizeLocalRing,
  samePointXZ,
  toLocalPoint,
  toLocalRing,
} from '../../../common/geo/coordinate-transform.utils';

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
