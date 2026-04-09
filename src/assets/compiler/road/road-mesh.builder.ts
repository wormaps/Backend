import type { Coordinate } from '../../../places/types/place.types';
import type {
  SceneCrossingDetail,
  SceneDetail,
  SceneMeta,
  SceneRoadDecal,
} from '../../../scene/types/scene.types';
import {
  GeometryBuffers,
  Vec3,
  createEmptyGeometry,
  mergeGeometryBuffers,
} from './road-mesh.types';
import {
  isFiniteVec3,
  normalize2d,
  normalizeLocalRing,
  pushQuad,
  pushTriangle,
  toLocalPoint,
  toLocalRing,
} from './road-mesh.geometry.utils';
import {
  pushPathCurb,
  pushPathEdgeBands,
  pushPathMedian,
  pushPathSidewalkEdge,
  pushPathStrips,
} from './road-mesh.path.utils';

export { createEmptyGeometry, mergeGeometryBuffers };
export type { GeometryBuffers, Vec3 };

const ROAD_BASE_Y = 0.04;
const ROAD_MARKING_Y = 0.094;
const LANE_OVERLAY_Y = 0.108;
const LANE_OVERLAY_HERO_Y = 0.114;
const STOP_LINE_Y = 0.1;
const CROSSWALK_Y = 0.142;
const CROSSWALK_HERO_Y = 0.146;
const CROSSWALK_STRIPE_Y = 0.154;
const JUNCTION_OVERLAY_Y = 0.182;
const ARROW_MARK_Y = 0.19;

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
    const widthScale = resolveRoadWidthScale(road);
    const yOffset = resolveRoadYOffset(road);
    pushPathStrips(
      origin,
      geometry,
      road.path,
      Math.max(3.2, road.widthMeters * widthScale),
      ROAD_BASE_Y + yOffset,
    );
  }
  return geometry;
}

export function createRoadEdgeGeometry(
  origin: Coordinate,
  roads: SceneMeta['roads'],
): GeometryBuffers {
  const geometry = createEmptyGeometry();
  for (const road of roads) {
    pushPathEdgeBands(
      origin,
      geometry,
      road.path,
      Math.max(3.2, road.widthMeters),
      Math.max(0.22, Math.min(0.42, road.widthMeters * 0.045)),
      0.02,
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
        ? 0.3
        : marking.type === 'STOP_LINE'
          ? 0.68
          : 2.1;
    pushPathStrips(origin, geometry, marking.path, width, ROAD_MARKING_Y);
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
        ? 1.2
        : decal.type === 'CROSSWALK_OVERLAY'
          ? decal.emphasis === 'hero'
            ? 4.8
            : 3.2
          : decal.emphasis === 'hero'
            ? 0.52
            : 0.46;
    const y =
      decal.type === 'STOP_LINE'
        ? STOP_LINE_Y
        : decal.type === 'CROSSWALK_OVERLAY'
          ? decal.emphasis === 'hero'
            ? CROSSWALK_HERO_Y
            : CROSSWALK_Y
          : decal.emphasis === 'hero'
            ? LANE_OVERLAY_HERO_Y
            : LANE_OVERLAY_Y;
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
    const heroStripe = decal.emphasis === 'hero';
    const stripeDepth = Math.max(
      heroStripe ? 0.98 : 0.82,
      decal.stripeSet.stripeDepth * (heroStripe ? 1.04 : 1),
    );
    const halfWidth = Math.max(
      heroStripe ? 8.6 : 5.8,
      decal.stripeSet.halfWidth * (heroStripe ? 1.06 : 1),
    );

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
        [centerX - dx - nx, CROSSWALK_STRIPE_Y, centerZ - dz - nz],
        [centerX + dx - nx, CROSSWALK_STRIPE_Y, centerZ + dz - nz],
        [centerX + dx + nx, CROSSWALK_STRIPE_Y, centerZ + dz + nz],
        [centerX - dx + nx, CROSSWALK_STRIPE_Y, centerZ - dz + nz],
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
    triangulate: (
      vertices: number[],
      holes?: number[],
      dimensions?: number,
    ) => number[],
  ) => Array<[Vec3, Vec3, Vec3]>,
  triangulate: (
    vertices: number[],
    holes?: number[],
    dimensions?: number,
  ) => number[],
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
    const ring = normalizeLocalRing(toLocalRing(origin, decal.polygon), 'CCW');
    if (ring.length < 3) {
      continue;
    }
    const triangles = triangulateRings(ring, [], triangulate);
    const y =
      decal.type === 'JUNCTION_OVERLAY'
        ? JUNCTION_OVERLAY_Y
        : decal.type === 'ARROW_MARK'
          ? ARROW_MARK_Y
          : CROSSWALK_STRIPE_Y;
    for (const [a, b, c] of triangles) {
      pushTriangle(geometry, [a[0], y, a[2]], [b[0], y, b[2]], [c[0], y, c[2]]);
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
    const signalizedBoost = crossing.style === 'signalized' ? 1 : 0;
    const halfWidth = crossing.principal ? 9.6 : 6.3;
    const corridorCapacity = Math.max(
      6,
      Math.floor(length / Math.max(0.75, halfWidth * 0.2)),
    );
    const stripeCountBase = crossing.principal
      ? Math.max(10, Math.min(16, Math.floor(length / 0.92) + signalizedBoost))
      : Math.max(7, Math.min(12, Math.floor(length / 1.08) + signalizedBoost));
    const stripeCount = Math.min(stripeCountBase, corridorCapacity);
    const stripeDepth = crossing.principal ? 1.08 : 0.94;

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
        [centerX - dx - nx, CROSSWALK_Y, centerZ - dz - nz],
        [centerX + dx - nx, CROSSWALK_Y, centerZ + dz - nz],
        [centerX + dx + nx, CROSSWALK_Y, centerZ + dz + nz],
        [centerX - dx + nx, CROSSWALK_Y, centerZ - dz + nz],
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
    const widthScale = resolveWalkwayWidthScale(walkway);
    const yOffset = resolveWalkwayYOffset(walkway);
    pushPathStrips(
      origin,
      geometry,
      walkway.path,
      Math.max(1.8, walkway.widthMeters * widthScale),
      0.015 + yOffset,
    );
  }
  return geometry;
}

export function createCurbGeometry(
  origin: Coordinate,
  roads: SceneMeta['roads'],
): GeometryBuffers {
  const geometry = createEmptyGeometry();
  for (const road of roads) {
    const roadWidth = Math.max(3.2, road.widthMeters);
    const curbHeight = 0.15;
    const curbWidth = 0.18;
    pushPathCurb(origin, geometry, road.path, roadWidth, curbWidth, curbHeight);
  }
  return geometry;
}

export function createMedianGeometry(
  origin: Coordinate,
  roads: SceneMeta['roads'],
): GeometryBuffers {
  const geometry = createEmptyGeometry();
  for (const road of roads) {
    const roadWidth = Math.max(3.2, road.widthMeters);
    if (roadWidth < 8) {
      continue;
    }
    const medianWidth = Math.min(1.2, roadWidth * 0.12);
    const medianHeight = 0.12;
    pushPathMedian(
      origin,
      geometry,
      road.path,
      roadWidth,
      medianWidth,
      medianHeight,
    );
  }
  return geometry;
}

export function createSidewalkEdgeGeometry(
  origin: Coordinate,
  walkways: SceneMeta['walkways'],
): GeometryBuffers {
  const geometry = createEmptyGeometry();
  for (const walkway of walkways) {
    const walkwayWidth = Math.max(2, walkway.widthMeters);
    const edgeHeight = 0.08;
    const edgeWidth = 0.12;
    pushPathSidewalkEdge(
      origin,
      geometry,
      walkway.path,
      walkwayWidth,
      edgeWidth,
      edgeHeight,
    );
  }
  return geometry;
}

function resolveRoadWidthScale(road: SceneMeta['roads'][number]): number {
  const className = road.roadClass.toLowerCase();
  if (className.includes('motorway') || className.includes('trunk')) {
    return 1.14;
  }
  if (className.includes('primary')) {
    return 1.08;
  }
  if (className.includes('secondary')) {
    return 1.04;
  }
  if (className.includes('tertiary')) {
    return 0.98;
  }
  if (className.includes('residential') || className.includes('service')) {
    return 0.9;
  }
  return road.laneCount >= 4 ? 1.08 : road.laneCount <= 1 ? 0.9 : 1;
}

function resolveRoadYOffset(road: SceneMeta['roads'][number]): number {
  const surface = road.surface?.toLowerCase() ?? '';
  if (surface.includes('cobblestone') || surface.includes('sett')) {
    return 0.008;
  }
  if (surface.includes('gravel') || surface.includes('unpaved')) {
    return 0.004;
  }
  return 0;
}

function resolveWalkwayWidthScale(
  walkway: SceneMeta['walkways'][number],
): number {
  const type = walkway.walkwayType.toLowerCase();
  if (type.includes('footway') || type.includes('pedestrian')) {
    return 1.08;
  }
  if (type.includes('steps') || type.includes('path')) {
    return 0.9;
  }
  return 1;
}

function resolveWalkwayYOffset(walkway: SceneMeta['walkways'][number]): number {
  const surface = walkway.surface?.toLowerCase() ?? '';
  if (surface.includes('paving_stones') || surface.includes('tiles')) {
    return 0.004;
  }
  if (surface.includes('wood')) {
    return 0.006;
  }
  return 0;
}
