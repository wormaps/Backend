import type { Coordinate } from '../../../../places/types/place.types';
import type {
  SceneCrossingDetail,
  SceneDetail,
  SceneMeta,
  SceneStreetFurnitureDetail,
} from '../../../../scene/types/scene.types';
import type { AccentTone } from '../../../compiler/materials';
import type { GeometryBuffers, Vec3 } from '../../../compiler/road';
import {
  createEmptyGeometry,
  insetRing,
  isFiniteVec3,
  normalize2d,
  normalizeLocalRing,
  pushBox,
  pushPathStrips,
  pushQuad,
  pushRingWallsBetween,
  pushTriangle,
  toLocalPoint,
  toLocalRing,
  triangulateRings,
} from './glb-build-geometry-primitives.utils';
import { buildRoadSpatialIndex } from '../../../compiler/road/road-spatial-index.utils';
import { resolveBuildingAccentToneFromBuilding } from '../glb-build-style.utils';

function stableVariant(seed: string, modulo: number): number {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return modulo > 0 ? hash % modulo : 0;
}

function pushTrafficLightAssembly(
  geometry: GeometryBuffers,
  center: Vec3,
  principal: boolean,
  variant: number,
): void {
  const poleHeight = principal ? 7.2 : 6.4;
  const armLength = principal ? 1.8 : 1.2;
  const signalOffset = variant === 0 ? -1 : 1;
  pushBox(
    geometry,
    [center[0] - 0.12, 0, center[2] - 0.12],
    [center[0] + 0.12, poleHeight, center[2] + 0.12],
  );
  pushBox(
    geometry,
    [center[0] - 0.24, 0, center[2] - 0.24],
    [center[0] + 0.24, 0.16, center[2] + 0.24],
  );
  pushBox(
    geometry,
    [center[0], poleHeight - 0.28, center[2] - 0.06],
    [center[0] + signalOffset * armLength, poleHeight - 0.12, center[2] + 0.06],
  );
  const headX = center[0] + signalOffset * armLength;
  pushBox(
    geometry,
    [headX - 0.18, poleHeight - 0.88, center[2] - 0.22],
    [headX + 0.18, poleHeight - 0.18, center[2] + 0.22],
  );
  if (principal) {
    pushBox(
      geometry,
      [headX - signalOffset * 0.62, poleHeight - 0.82, center[2] - 0.18],
      [headX - signalOffset * 0.28, poleHeight - 0.28, center[2] + 0.18],
    );
  }
  pushBox(
    geometry,
    [center[0] - 0.22, 1.2, center[2] - 0.08],
    [center[0] + 0.16, 1.7, center[2] + 0.08],
  );
}

function pushStreetLightAssembly(
  geometry: GeometryBuffers,
  center: Vec3,
  variant: number,
): void {
  const poleHeight = variant === 2 ? 9.2 : 8.4;
  const armLength = variant === 1 ? 1.4 : 1.1;
  pushBox(
    geometry,
    [center[0] - 0.1, 0, center[2] - 0.1],
    [center[0] + 0.1, poleHeight, center[2] + 0.1],
  );
  pushBox(
    geometry,
    [center[0] - 0.2, 0, center[2] - 0.2],
    [center[0] + 0.2, 0.12, center[2] + 0.2],
  );
  pushBox(
    geometry,
    [center[0], poleHeight - 0.18, center[2] - 0.05],
    [center[0] + armLength, poleHeight, center[2] + 0.05],
  );
  pushBox(
    geometry,
    [center[0] + armLength - 0.18, poleHeight - 0.28, center[2] - 0.18],
    [center[0] + armLength + 0.12, poleHeight + 0.02, center[2] + 0.18],
  );
  if (variant === 2) {
    pushBox(
      geometry,
      [center[0] - 0.55, poleHeight - 0.08, center[2] - 0.04],
      [center[0], poleHeight + 0.04, center[2] + 0.04],
    );
  }
}

function pushSignPoleAssembly(
  geometry: GeometryBuffers,
  center: Vec3,
  variant: number,
): void {
  const poleHeight = 3.4 + variant * 0.35;
  pushBox(
    geometry,
    [center[0] - 0.08, 0, center[2] - 0.08],
    [center[0] + 0.08, poleHeight, center[2] + 0.08],
  );
  pushBox(
    geometry,
    [center[0] - 0.18, 0, center[2] - 0.18],
    [center[0] + 0.18, 0.08, center[2] + 0.18],
  );
  pushBox(
    geometry,
    [center[0] - 0.42, poleHeight - 0.9, center[2] - 0.05],
    [center[0] + 0.42, poleHeight - 0.15, center[2] + 0.05],
  );
  if (variant > 0) {
    pushBox(
      geometry,
      [center[0] - 0.28, poleHeight - 1.65, center[2] - 0.05],
      [center[0] + 0.28, poleHeight - 1.1, center[2] + 0.05],
    );
  }
}

export function createBuildingRoofAccentGeometry(
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
    if (resolveBuildingAccentToneFromBuilding(building) !== tone) {
      continue;
    }

    const outerRing = normalizeLocalRing(
      toLocalRing(origin, building.outerRing),
      'CCW',
    );
    if (outerRing.length < 3) {
      continue;
    }

    const ring = insetRing(outerRing, 0.12);
    if (ring.length < 3) {
      continue;
    }

    const topHeight = Math.max(4, building.heightMeters);
    const accentBaseHeight =
      building.roofType === 'stepped'
        ? topHeight * 0.82
        : building.roofType === 'gable'
          ? topHeight * 0.78
          : topHeight - Math.min(1.2, Math.max(0.45, topHeight * 0.03));
    const accentTopHeight = Math.min(topHeight + 0.18, accentBaseHeight + 0.35);
    const triangles = triangulateRings(ring, [], triangulate);
    if (triangles.length === 0) {
      continue;
    }

    for (const [a, b, c] of triangles) {
      pushTriangle(
        geometry,
        [a[0], accentTopHeight, a[2]],
        [b[0], accentTopHeight, b[2]],
        [c[0], accentTopHeight, c[2]],
      );
    }
    pushRingWallsBetween(
      geometry,
      ring,
      accentBaseHeight,
      accentTopHeight,
      false,
    );
  }

  return geometry;
}

export function createCrosswalkGeometry(
  origin: Coordinate,
  crossings: SceneCrossingDetail[],
  roads: SceneMeta['roads'] = [],
): GeometryBuffers {
  const geometry = createEmptyGeometry();
  const crosswalkY = 0.142;
  const spatialIndex = buildRoadSpatialIndex(roads, origin);
  for (const crossing of crossings) {
    const local = crossing.path
      .map((point) => toLocalPoint(origin, point))
      .filter((point) => isFiniteVec3(point));
    if (local.length < 2) {
      continue;
    }

    const start = local[0]!;
    const end = local[local.length - 1]!;
    const direction = normalize2d({
      x: end[0] - start[0],
      z: end[2] - start[2],
    });
    const normal = { x: -direction.z, z: direction.x };
    const length = Math.hypot(end[0] - start[0], end[2] - start[2]);
    const stripeCount = Math.max(4, Math.min(9, Math.floor(length / 1.4)));
    const stripeDepth = 0.8;
    const halfWidth = crossing.principal ? 8 : 5;
    const y = crosswalkY + (crossing.center ? spatialIndex.findNearest(crossing.center).terrainOffset : 0);

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
        [centerX - dx - nx, y, centerZ - dz - nz],
        [centerX + dx - nx, y, centerZ + dz - nz],
        [centerX + dx + nx, y, centerZ + dz + nz],
        [centerX - dx + nx, y, centerZ - dz + nz],
      );
    }
  }
  return geometry;
}

function resolveCrosswalkYOffset(
  crossing: SceneCrossingDetail,
  roads: SceneMeta['roads'],
  origin: Coordinate,
): number {
  if (!crossing.center || roads.length === 0) {
    return 0;
  }

  const spatialIndex = buildRoadSpatialIndex(roads, origin);
  return spatialIndex.findNearest(crossing.center).terrainOffset;
}

function distanceToPathMeters(point: Coordinate, path: Coordinate[], origin: Coordinate): number {
  if (path.length < 2) {
    return Number.POSITIVE_INFINITY;
  }

  let minimum = Number.POSITIVE_INFINITY;
  for (let index = 0; index < path.length - 1; index += 1) {
    const segStart = path[index];
    const segEnd = path[index + 1];
    if (!segStart || !segEnd) continue;
    const start = toLocalPoint(origin, segStart);
    const end = toLocalPoint(origin, segEnd);
    if (!isFiniteVec3(start) || !isFiniteVec3(end)) {
      continue;
    }
    minimum = Math.min(
      minimum,
      distancePointToSegment2d(
        [0, 0],
        [start[0], start[2]],
        [end[0], end[2]],
      ),
    );
  }
  return minimum;
}

function distancePointToSegment2d(
  point: [number, number],
  start: [number, number],
  end: [number, number],
): number {
  const abX = end[0] - start[0];
  const abY = end[1] - start[1];
  const apX = point[0] - start[0];
  const apY = point[1] - start[1];
  const denom = abX * abX + abY * abY;
  if (denom <= 1e-9) {
    return Math.hypot(apX, apY);
  }
  const t = Math.max(0, Math.min(1, (apX * abX + apY * abY) / denom));
  const closestX = start[0] + abX * t;
  const closestY = start[1] + abY * t;
  return Math.hypot(point[0] - closestX, point[1] - closestY);
}

export function createStreetFurnitureGeometry(
  origin: Coordinate,
  items: SceneStreetFurnitureDetail[],
  type: SceneStreetFurnitureDetail['type'],
): GeometryBuffers {
  const geometry = createEmptyGeometry();
  for (const item of items) {
    if (item.type !== type) {
      continue;
    }
    const center = toLocalPoint(origin, item.location);
    if (!isFiniteVec3(center)) {
      continue;
    }
    const variant = stableVariant(item.objectId, 3);
    if (type === 'TRAFFIC_LIGHT') {
      pushTrafficLightAssembly(geometry, center, item.principal, variant);
    } else if (type === 'STREET_LIGHT') {
      pushStreetLightAssembly(geometry, center, variant);
    } else {
      pushSignPoleAssembly(geometry, center, variant);
    }
  }
  return geometry;
}

export function createPoiGeometry(
  origin: Coordinate,
  pois: SceneMeta['pois'],
): GeometryBuffers {
  const geometry = createEmptyGeometry();

  for (const poi of pois) {
    const center = toLocalPoint(origin, poi.location);
    if (!isFiniteVec3(center)) {
      continue;
    }
    const size = poi.isLandmark ? 0.65 : 0.35;
    const height = poi.isLandmark ? 3.4 : 2;
    pushBox(
      geometry,
      [center[0] - 0.08, 0, center[2] - 0.08],
      [center[0] + 0.08, height, center[2] + 0.08],
    );
    pushBox(
      geometry,
      [center[0] - size, height, center[2] - size],
      [center[0] + size, height + 0.9, center[2] + size],
    );
  }

  return geometry;
}

export function createLandCoverGeometry(
  origin: Coordinate,
  covers: SceneDetail['landCovers'],
  type: SceneDetail['landCovers'][number]['type'],
  triangulate: (
    vertices: number[],
    holes?: number[],
    dimensions?: number,
  ) => number[],
): GeometryBuffers {
  const geometry = createEmptyGeometry();
  const y = type === 'WATER' ? -0.01 : type === 'PLAZA' ? 0.006 : 0.01;

  for (const cover of covers) {
    if (cover.type !== type) {
      continue;
    }
    const ring = toLocalRing(origin, cover.polygon);
    if (ring.length < 3) {
      continue;
    }
    const triangles = triangulateRings(ring, [], triangulate);
    for (const [a, b, c] of triangles) {
      pushTriangle(geometry, [a[0], y, a[2]], [b[0], y, b[2]], [c[0], y, c[2]]);
    }
  }

  return geometry;
}

export function createLinearFeatureGeometry(
  origin: Coordinate,
  features: SceneDetail['linearFeatures'],
  type: SceneDetail['linearFeatures'][number]['type'],
): GeometryBuffers {
  const geometry = createEmptyGeometry();

  for (const feature of features) {
    if (feature.type !== type) {
      continue;
    }
    const width = type === 'RAILWAY' ? 3.2 : type === 'BRIDGE' ? 4.6 : 2.8;
    const y = type === 'BRIDGE' ? 0.34 : type === 'WATERWAY' ? -0.005 : 0.025;
    pushPathStrips(origin, geometry, feature.path, width, y);
  }

  return geometry;
}
