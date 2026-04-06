import type { Coordinate } from '../../../../places/types/place.types';
import type {
  GeometryBuffers,
  Vec3,
} from '../../../compiler/road-mesh.builder';

type Vec2 = { x: number; z: number };

export function createEmptyGeometry(): GeometryBuffers {
  return {
    positions: [],
    normals: [],
    indices: [],
  };
}

export function isFiniteVec3(point: Vec3): boolean {
  return point.every((value) => Number.isFinite(value));
}

export function isFiniteVec2(point: [number, number]): boolean {
  return point.every((value) => Number.isFinite(value));
}

export function samePointXZ(a: Vec3, b: Vec3): boolean {
  return Math.abs(a[0] - b[0]) <= 1e-6 && Math.abs(a[2] - b[2]) <= 1e-6;
}

export function computeNormal(a: Vec3, b: Vec3, c: Vec3): Vec3 | null {
  if (![a, b, c].every((point) => isFiniteVec3(point))) {
    return null;
  }

  const ab: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const ac: Vec3 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const cross: Vec3 = [
    ab[1] * ac[2] - ab[2] * ac[1],
    ab[2] * ac[0] - ab[0] * ac[2],
    ab[0] * ac[1] - ab[1] * ac[0],
  ];
  const length = Math.hypot(cross[0], cross[1], cross[2]);
  if (!Number.isFinite(length) || length <= 1e-6) {
    return null;
  }

  return [cross[0] / length, cross[1] / length, cross[2] / length];
}

export function pushTriangle(
  geometry: GeometryBuffers,
  a: Vec3,
  b: Vec3,
  c: Vec3,
): void {
  const normal = computeNormal(a, b, c);
  if (normal === null) {
    return;
  }
  const baseIndex = geometry.positions.length / 3;
  geometry.positions.push(...a, ...b, ...c);
  geometry.normals.push(...normal, ...normal, ...normal);
  geometry.indices.push(baseIndex, baseIndex + 1, baseIndex + 2);
}

export function pushQuad(
  geometry: GeometryBuffers,
  a: Vec3,
  b: Vec3,
  c: Vec3,
  d: Vec3,
): void {
  pushTriangle(geometry, a, b, c);
  pushTriangle(geometry, a, c, d);
}

export function pushBox(geometry: GeometryBuffers, min: Vec3, max: Vec3): void {
  const [x0, y0, z0] = min;
  const [x1, y1, z1] = max;
  pushQuad(geometry, [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]);
  pushQuad(geometry, [x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]);
  pushQuad(geometry, [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]);
  pushQuad(geometry, [x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]);
  pushQuad(geometry, [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]);
  pushQuad(geometry, [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]);
}

export function normalize2d(vector: Vec2): Vec2 {
  const length = Math.hypot(vector.x, vector.z);
  if (length === 0) {
    return { x: 0, z: 0 };
  }
  return {
    x: vector.x / length,
    z: vector.z / length,
  };
}

export function computePathNormal(
  prev: Vec3,
  current: Vec3,
  next: Vec3,
): [number, number] {
  const inDir = normalize2d({
    x: current[0] - prev[0],
    z: current[2] - prev[2],
  });
  const outDir = normalize2d({
    x: next[0] - current[0],
    z: next[2] - current[2],
  });

  const tangent = normalize2d({
    x: inDir.x + outDir.x,
    z: inDir.z + outDir.z,
  });

  if (tangent.x === 0 && tangent.z === 0) {
    if (inDir.x === 0 && inDir.z === 0) {
      return [0, 1];
    }
    return [-inDir.z, inDir.x];
  }

  return [-tangent.z, tangent.x];
}

export function toLocalPoint(origin: Coordinate, point: Coordinate): Vec3 {
  const metersPerLat = 111_320;
  const metersPerLng = 111_320 * Math.cos((origin.lat * Math.PI) / 180);
  const x = (point.lng - origin.lng) * metersPerLng;
  const z = -(point.lat - origin.lat) * metersPerLat;
  return [x, 0, z];
}

export function pushPathStrips(
  origin: Coordinate,
  geometry: GeometryBuffers,
  path: Coordinate[],
  width: number,
  y: number,
): void {
  const localPath = path
    .map((point) => toLocalPoint(origin, point))
    .filter((point) => isFiniteVec3(point))
    .filter((point, index, array) => {
      const prev = array[index - 1];
      return !prev || !samePointXZ(prev, point);
    });

  if (localPath.length < 2) {
    return;
  }

  const half = width / 2;
  const left: Vec3[] = [];
  const right: Vec3[] = [];

  for (let i = 0; i < localPath.length; i += 1) {
    const current = localPath[i];
    const prev = localPath[i - 1] ?? current;
    const next = localPath[i + 1] ?? current;
    const normal = computePathNormal(prev, current, next);
    if (!isFiniteVec2(normal)) {
      continue;
    }
    left.push([
      current[0] + normal[0] * half,
      y,
      current[2] + normal[1] * half,
    ]);
    right.push([
      current[0] - normal[0] * half,
      y,
      current[2] - normal[1] * half,
    ]);
  }

  for (let i = 0; i < localPath.length - 1; i += 1) {
    if (!left[i] || !right[i] || !left[i + 1] || !right[i + 1]) {
      continue;
    }
    pushQuad(geometry, left[i], right[i], right[i + 1], left[i + 1]);
  }
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

export function signedAreaXZ(points: Vec3[]): number {
  if (points.length < 3) {
    return 0;
  }

  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    area += current[0] * next[2] - next[0] * current[2];
  }

  return area / 2;
}

export function normalizeLocalRing(
  ring: Vec3[],
  direction: 'CW' | 'CCW',
): Vec3[] {
  if (ring.length < 3) {
    return ring;
  }

  const area = signedAreaXZ(ring);
  if (Math.abs(area) <= 1e-6) {
    return ring;
  }

  const isClockwise = area < 0;
  if (
    (direction === 'CW' && isClockwise) ||
    (direction === 'CCW' && !isClockwise)
  ) {
    return ring;
  }

  return [...ring].reverse();
}

export function triangulateRings(
  outerRing: Vec3[],
  holes: Vec3[][],
  triangulate: (
    vertices: number[],
    holes?: number[],
    dimensions?: number,
  ) => number[],
): Array<[Vec3, Vec3, Vec3]> {
  const vertices: number[] = [];
  const points: Vec3[] = [];
  const holeIndices: number[] = [];

  const pushRing = (ring: Vec3[]) => {
    for (const point of ring) {
      points.push(point);
      vertices.push(point[0], point[2]);
    }
  };

  pushRing(outerRing);
  for (const hole of holes) {
    holeIndices.push(points.length);
    pushRing(hole);
  }

  const indices = triangulate(vertices, holeIndices, 2);
  const triangles: Array<[Vec3, Vec3, Vec3]> = [];
  for (let index = 0; index < indices.length; index += 3) {
    const a = points[indices[index]];
    const b = points[indices[index + 1]];
    const c = points[indices[index + 2]];
    if (!a || !b || !c) {
      continue;
    }
    if (samePointXZ(a, b) || samePointXZ(b, c) || samePointXZ(a, c)) {
      continue;
    }
    triangles.push([a, b, c]);
  }

  return triangles;
}

export function pushRingWallsBetween(
  geometry: GeometryBuffers,
  ring: Vec3[],
  minHeight: number,
  maxHeight: number,
  invert: boolean,
): void {
  for (let index = 0; index < ring.length; index += 1) {
    const current = ring[index];
    const next = ring[(index + 1) % ring.length];
    if (invert) {
      pushQuad(
        geometry,
        [next[0], minHeight, next[2]],
        [current[0], minHeight, current[2]],
        [current[0], maxHeight, current[2]],
        [next[0], maxHeight, next[2]],
      );
    } else {
      pushQuad(
        geometry,
        [current[0], minHeight, current[2]],
        [next[0], minHeight, next[2]],
        [next[0], maxHeight, next[2]],
        [current[0], maxHeight, current[2]],
      );
    }
  }
}

export function averagePoint(points: Vec3[]): Vec3 {
  const total = points.reduce(
    (acc, point) =>
      [acc[0] + point[0], acc[1] + point[1], acc[2] + point[2]] as Vec3,
    [0, 0, 0],
  );
  return [total[0] / points.length, 0, total[2] / points.length];
}

export function insetRing(points: Vec3[], ratio: number): Vec3[] {
  const center = averagePoint(points);
  return points.map((point) => [
    center[0] + (point[0] - center[0]) * (1 - ratio),
    0,
    center[2] + (point[2] - center[2]) * (1 - ratio),
  ]);
}
