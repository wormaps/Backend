import { GeometryBuffers, Vec3 } from './road-mesh.types';
import { isFiniteVec3 } from '../../../common/geo/coordinate-transform.utils';
export {
  isFiniteVec3,
  normalizeLocalRing,
  samePointXZ,
  toLocalPoint,
  toLocalRing,
} from '../../../common/geo/coordinate-transform.utils';

interface Vec2 {
  x: number;
  z: number;
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
  if (geometry.uvs !== undefined) {
    geometry.uvs.push(a[0], a[2], b[0], b[2], c[0], c[2]);
  }
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

export function isFiniteVec2(vector: [number, number]): boolean {
  return Number.isFinite(vector[0]) && Number.isFinite(vector[1]);
}
