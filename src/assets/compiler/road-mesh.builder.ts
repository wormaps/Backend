import type { Coordinate } from '../../places/types/place.types';
import type {
  SceneCrossingDetail,
  SceneDetail,
  SceneMeta,
  SceneRoadDecal,
} from '../../scene/types/scene.types';

export type Vec3 = [number, number, number];

export interface GeometryBuffers {
  positions: number[];
  normals: number[];
  indices: number[];
}

interface Vec2 {
  x: number;
  z: number;
}

export function createEmptyGeometry(): GeometryBuffers {
  return {
    positions: [],
    normals: [],
    indices: [],
  };
}

export function mergeGeometryBuffers(buffers: GeometryBuffers[]): GeometryBuffers {
  const merged = createEmptyGeometry();

  for (const buffer of buffers) {
    const baseIndex = merged.positions.length / 3;
    merged.positions.push(...buffer.positions);
    merged.normals.push(...buffer.normals);
    merged.indices.push(...buffer.indices.map((index) => index + baseIndex));
  }

  return merged;
}

export function createGroundGeometry(sceneMeta: SceneMeta): GeometryBuffers {
  const geometry = createEmptyGeometry();
  const ne = toLocalPoint(sceneMeta.origin, sceneMeta.bounds.northEast);
  const sw = toLocalPoint(sceneMeta.origin, sceneMeta.bounds.southWest);
  pushQuad(
    geometry,
    [sw[0], -0.03, ne[2]],
    [ne[0], -0.03, ne[2]],
    [ne[0], -0.03, sw[2]],
    [sw[0], -0.03, sw[2]],
  );
  return geometry;
}

export function createRoadBaseGeometry(
  origin: Coordinate,
  roads: SceneMeta['roads'],
): GeometryBuffers {
  const geometry = createEmptyGeometry();
  for (const road of roads) {
    pushPathStrips(
      origin,
      geometry,
      road.path,
      Math.max(3.2, road.widthMeters),
      0.01,
    );
  }
  return geometry;
}

export function createRoadMarkingsGeometry(
  origin: Coordinate,
  markings: SceneDetail['roadMarkings'],
): GeometryBuffers {
  const geometry = createEmptyGeometry();
  for (const marking of markings) {
    const width =
      marking.type === 'LANE_LINE'
        ? 0.24
        : marking.type === 'STOP_LINE'
          ? 0.55
          : 1.6;
    pushPathStrips(origin, geometry, marking.path, width, 0.03);
  }
  return geometry;
}

export function createRoadDecalPathGeometry(
  origin: Coordinate,
  decals: SceneRoadDecal[],
  types: SceneRoadDecal['type'][],
): GeometryBuffers {
  const geometry = createEmptyGeometry();

  for (const decal of decals) {
    if (
      !types.includes(decal.type) ||
      decal.shapeKind === 'stripe_set' ||
      !decal.path ||
      decal.path.length < 2
    ) {
      continue;
    }

    const width =
      decal.type === 'STOP_LINE'
        ? 0.95
        : decal.type === 'CROSSWALK_OVERLAY'
          ? decal.emphasis === 'hero'
            ? 3.6
            : 2.2
          : 0.34;
    const y =
      decal.type === 'STOP_LINE'
        ? 0.036
        : decal.emphasis === 'hero'
          ? 0.05
          : 0.04;
    pushPathStrips(origin, geometry, decal.path, width, y);
  }

  return geometry;
}

export function createRoadDecalStripeGeometry(
  origin: Coordinate,
  decals: SceneRoadDecal[],
  types: SceneRoadDecal['type'][],
): GeometryBuffers {
  const geometry = createEmptyGeometry();

  for (const decal of decals) {
    if (
      !types.includes(decal.type) ||
      decal.shapeKind !== 'stripe_set' ||
      !decal.stripeSet ||
      decal.stripeSet.centerPath.length < 2
    ) {
      continue;
    }

    const local = decal.stripeSet.centerPath
      .map((point) => toLocalPoint(origin, point))
      .filter((point) => isFiniteVec3(point));
    if (local.length < 2) {
      continue;
    }

    const start = local[0];
    const end = local[local.length - 1];
    const direction = normalize2d({
      x: end[0] - start[0],
      z: end[2] - start[2],
    });
    const normal = { x: -direction.z, z: direction.x };
    const stripeCount = Math.max(1, decal.stripeSet.stripeCount);
    const stripeDepth = decal.stripeSet.stripeDepth;
    const halfWidth = decal.stripeSet.halfWidth;

    for (let i = 0; i < stripeCount; i += 1) {
      const t = (i + 0.5) / stripeCount;
      const centerX = start[0] + (end[0] - start[0]) * t;
      const centerZ = start[2] + (end[2] - start[2]) * t;
      const dx = direction.x * stripeDepth;
      const dz = direction.z * stripeDepth;
      const nx = normal.x * halfWidth;
      const nz = normal.z * halfWidth;
      pushQuad(
        geometry,
        [centerX - dx - nx, 0.05, centerZ - dz - nz],
        [centerX + dx - nx, 0.05, centerZ + dz - nz],
        [centerX + dx + nx, 0.05, centerZ + dz + nz],
        [centerX - dx + nx, 0.05, centerZ - dz + nz],
      );
    }
  }

  return geometry;
}

export function createRoadDecalPolygonGeometry(
  origin: Coordinate,
  decals: SceneRoadDecal[],
  types: SceneRoadDecal['type'][],
  triangulateRings: (
    outerRing: Vec3[],
    holes: Vec3[][],
    triangulate: (vertices: number[], holes?: number[], dimensions?: number) => number[],
  ) => Array<[Vec3, Vec3, Vec3]>,
  triangulate: (vertices: number[], holes?: number[], dimensions?: number) => number[],
): GeometryBuffers {
  const geometry = createEmptyGeometry();

  for (const decal of decals) {
    if (
      !types.includes(decal.type) ||
      decal.shapeKind === 'stripe_set' ||
      !decal.polygon ||
      decal.polygon.length < 3
    ) {
      continue;
    }
    const ring = normalizeLocalRing(
      toLocalRing(origin, decal.polygon),
      'CCW',
    );
    if (ring.length < 3) {
      continue;
    }
    const triangles = triangulateRings(ring, [], triangulate);
    const y = decal.type === 'JUNCTION_OVERLAY' ? 0.045 : 0.05;
    for (const [a, b, c] of triangles) {
      pushTriangle(
        geometry,
        [a[0], y, a[2]],
        [b[0], y, b[2]],
        [c[0], y, c[2]],
      );
    }
  }

  return geometry;
}

export function createCrosswalkGeometry(
  origin: Coordinate,
  crossings: SceneCrossingDetail[],
): GeometryBuffers {
  const geometry = createEmptyGeometry();
  for (const crossing of crossings) {
    const local = crossing.path
      .map((point) => toLocalPoint(origin, point))
      .filter((point) => isFiniteVec3(point));
    if (local.length < 2) {
      continue;
    }

    const start = local[0];
    const end = local[local.length - 1];
    const direction = normalize2d({
      x: end[0] - start[0],
      z: end[2] - start[2],
    });
    const normal = { x: -direction.z, z: direction.x };
    const length = Math.hypot(end[0] - start[0], end[2] - start[2]);
    const stripeCount = Math.max(4, Math.min(9, Math.floor(length / 1.4)));
    const stripeDepth = 0.8;
    const halfWidth = crossing.principal ? 8 : 5;

    for (let i = 0; i < stripeCount; i += 1) {
      const t = (i + 0.5) / stripeCount;
      const centerX = start[0] + (end[0] - start[0]) * t;
      const centerZ = start[2] + (end[2] - start[2]) * t;
      const dx = direction.x * stripeDepth;
      const dz = direction.z * stripeDepth;
      const nx = normal.x * halfWidth;
      const nz = normal.z * halfWidth;
      pushQuad(
        geometry,
        [centerX - dx - nx, 0.04, centerZ - dz - nz],
        [centerX + dx - nx, 0.04, centerZ + dz - nz],
        [centerX + dx + nx, 0.04, centerZ + dz + nz],
        [centerX - dx + nx, 0.04, centerZ - dz + nz],
      );
    }
  }
  return geometry;
}

export function createWalkwayGeometry(
  origin: Coordinate,
  walkways: SceneMeta['walkways'],
): GeometryBuffers {
  const geometry = createEmptyGeometry();
  for (const walkway of walkways) {
    pushPathStrips(
      origin,
      geometry,
      walkway.path,
      Math.max(2, walkway.widthMeters),
      0.015,
    );
  }
  return geometry;
}

function pushPathStrips(
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
    left.push([current[0] + normal[0] * half, y, current[2] + normal[1] * half]);
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

function pushQuad(
  geometry: GeometryBuffers,
  a: Vec3,
  b: Vec3,
  c: Vec3,
  d: Vec3,
): void {
  pushTriangle(geometry, a, b, c);
  pushTriangle(geometry, a, c, d);
}

function pushTriangle(
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

function computeNormal(a: Vec3, b: Vec3, c: Vec3): Vec3 | null {
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

function computePathNormal(
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

function normalize2d(vector: Vec2): Vec2 {
  const length = Math.hypot(vector.x, vector.z);
  if (length === 0) {
    return { x: 0, z: 0 };
  }
  return {
    x: vector.x / length,
    z: vector.z / length,
  };
}

function toLocalPoint(origin: Coordinate, point: Coordinate): Vec3 {
  const metersPerLat = 111_320;
  const metersPerLng = 111_320 * Math.cos((origin.lat * Math.PI) / 180);

  return [
    (point.lng - origin.lng) * metersPerLng,
    0,
    -(point.lat - origin.lat) * metersPerLat,
  ];
}

function toLocalRing(origin: Coordinate, points: Coordinate[]): Vec3[] {
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

function normalizeLocalRing(
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
  if ((direction === 'CW' && isClockwise) || (direction === 'CCW' && !isClockwise)) {
    return ring;
  }

  return [...ring].reverse();
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

function samePointXZ(left: Vec3, right: Vec3): boolean {
  return (
    Math.abs(left[0] - right[0]) <= 1e-6 &&
    Math.abs(left[2] - right[2]) <= 1e-6
  );
}

function isFiniteVec2(vector: [number, number]): boolean {
  return Number.isFinite(vector[0]) && Number.isFinite(vector[1]);
}

function isFiniteVec3(vector: Vec3): boolean {
  return (
    Number.isFinite(vector[0]) &&
    Number.isFinite(vector[1]) &&
    Number.isFinite(vector[2])
  );
}
