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

/** 도로 base Y 오프셋 (m). 지면 약간 위로. */
const ROAD_BASE_Y = 0.04;

/** 도로 marking Y 오프셋 (m). 도로 base 위. */
const ROAD_MARKING_Y = 0.094;

/** 차선 오버레이 Y 오프셋 (m). */
const LANE_OVERLAY_Y = 0.108;

/** 히어로 차선 오버레이 Y 오프셋 (m). */
const LANE_OVERLAY_HERO_Y = 0.114;

/** 정지선 Y 오프셋 (m). */
const STOP_LINE_Y = 0.1;

/** 횡단보도 Y 오프셋 (m). 도로 marking 위. */
const CROSSWALK_Y = 0.142;

/** 히어로 횡단보도 Y 오프셋 (m). */
const CROSSWALK_HERO_Y = 0.146;

/** 횡단보도 스트라이프 Y 오프셋 (m). */
const CROSSWALK_STRIPE_Y = 0.154;

/** 교차로 오버레이 Y 오프셋 (m). */
const JUNCTION_OVERLAY_Y = 0.182;

/** 화살표 마크 Y 오프셋 (m). */
const ARROW_MARK_Y = 0.19;

/** 지형 relief 격자 해상도 (9×9 grid). */
const GROUND_GRID_RESOLUTION = 8;

/** 지형 relief 방사형 진폭 (m). */
const GROUND_RELIEF_RADIAL_AMPLITUDE_M = 0.072;

/** 지형 relief 긴 파장 진폭 (m). */
const GROUND_RELIEF_LONG_WAVE_AMPLITUDE_M = 0.041;

/** 지형 relief 교차 파장 진폭 (m). */
const GROUND_RELIEF_CROSS_WAVE_AMPLITUDE_M = 0.036;

/** 도로 최소 너비 (m). */
const MIN_ROAD_WIDTH_M = 3.2;

/** 도로 가장자리 밴드 최소 너비 (m). */
const MIN_ROAD_EDGE_BAND_WIDTH_M = 0.22;

/** 도로 가장자리 밴드 최대 너비 (m). */
const MAX_ROAD_EDGE_BAND_WIDTH_M = 0.42;

/** 도로 가장자리 밴드 너비 비율. */
const ROAD_EDGE_BAND_WIDTH_RATIO = 0.045;

/** 도로 가장자리 밴드 높이 (m). */
const ROAD_EDGE_BAND_HEIGHT_M = 0.02;

/** 차선 너비 (m). */
const LANE_LINE_WIDTH_M = 0.3;

/** 정지선 너비 (m). */
const STOP_LINE_WIDTH_M = 0.68;

/** 횡단보도 marking 너비 (m). */
const CROSSWALK_MARKING_WIDTH_M = 2.1;

/** 정지선 데칼 너비 (m). */
const STOP_LINE_DECAL_WIDTH_M = 1.2;

/** 히어로 횡단보도 오버레이 너비 (m). */
const CROSSWALK_OVERLAY_HERO_WIDTH_M = 4.8;

/** 일반 횡단보도 오버레이 너비 (m). */
const CROSSWALK_OVERLAY_WIDTH_M = 3.2;

/** 히어로 레인 오버레이 너비 (m). */
const LANE_OVERLAY_HERO_WIDTH_M = 0.52;

/** 일반 레인 오버레이 너비 (m). */
const LANE_OVERLAY_WIDTH_M = 0.46;

/** 히어로 횡단보도 스트라이프 깊이 (m). */
const HERO_CROSSWALK_STRIPE_DEPTH_M = 0.98;

/** 히어로 횡단보도 스트라이프 깊이 배율. */
const HERO_CROSSWALK_STRIPE_DEPTH_SCALE = 1.04;

/** 히어로 횡단보도 절반 너비 (m). */
const HERO_CROSSWALK_HALF_WIDTH_M = 8.6;

/** 히어로 횡단보도 절반 너비 배율. */
const HERO_CROSSWALK_HALF_WIDTH_SCALE = 1.06;

/** 보도 최소 너비 (m). */
const MIN_WALKWAY_WIDTH_M = 1.8;

/** 보도 base Y 오프셋 (m). */
const WALKWAY_BASE_Y = 0.026;

/** 연석 높이 (m). */
const CURB_HEIGHT_M = 0.15;

/** 연석 너비 (m). */
const CURB_WIDTH_M = 0.18;

/** 중앙분리대 최소 너비 (m). */
const MEDIAN_MIN_WIDTH_M = 8;

/** 중앙분리대 너비 (m). */
const MEDIAN_WIDTH_M = 1.2;

/** 중앙분리대 너비 비율. */
const MEDIAN_WIDTH_RATIO = 0.12;

/** 중앙분리대 높이 (m). */
const MEDIAN_HEIGHT_M = 0.12;

/** 중앙분리대 추가 높이 (m). */
const MEDIAN_EXTRA_HEIGHT_M = 0.01;

/** 보도 가장자리 높이 (m). */
const SIDEWALK_EDGE_HEIGHT_M = 0.1;

/** 보도 가장자리 너비 (m). */
const SIDEWALK_EDGE_WIDTH_M = 0.12;

/** 횡단보도 최소 스트라이프 간격 (m). */
const CROSSWALK_MIN_STRIPE_SPACING_M = 0.75;

/** 횡단보도 스트라이프 간격 비율. */
const CROSSWALK_STRIPE_SPACING_RATIO = 0.2;

/** 주요 횡단보도 최소 스트라이프 수. */
const PRINCIPAL_CROSSWALK_MIN_STRIPES = 10;

/** 주요 횡단보도 최대 스트라이프 수. */
const PRINCIPAL_CROSSWALK_MAX_STRIPES = 16;

/** 주요 횡단보도 스트라이프 간격 (m). */
const PRINCIPAL_CROSSWALK_STRIPE_SPACING_M = 0.92;

/** 일반 횡단보도 최소 스트라이프 수. */
const NORMAL_CROSSWALK_MIN_STRIPES = 7;

/** 일반 횡단보도 최대 스트라이프 수. */
const NORMAL_CROSSWALK_MAX_STRIPES = 12;

/** 일반 횡단보도 스트라이프 간격 (m). */
const NORMAL_CROSSWALK_STRIPE_SPACING_M = 1.08;

/** 주요 횡단보도 스트라이프 깊이 (m). */
const PRINCIPAL_CROSSWALK_STRIPE_DEPTH_M = 1.08;

/** 주요 횡단보도 절반 너비 (m). */
const PRINCIPAL_CROSSWALK_HALF_WIDTH_M = 9.6;

/** 일반 횡단보도 절반 너비 (m). */
const NORMAL_CROSSWALK_HALF_WIDTH_M = 6.3;

/** 일반 횡단보도 스트라이프 깊이 (m). */
const NORMAL_CROSSWALK_STRIPE_DEPTH_M = 0.94;

/** Motorway/trunk 도로 너비 배율. */
const MOTORWAY_WIDTH_SCALE = 1.14;

/** Primary 도로 너비 배율. */
const PRIMARY_WIDTH_SCALE = 1.08;

/** Secondary 도로 너비 배율. */
const SECONDARY_WIDTH_SCALE = 1.04;

/** Tertiary 도로 너비 배율. */
const TERTIARY_WIDTH_SCALE = 0.98;

/** Residential/service 도로 너비 배율. */
const RESIDENTIAL_WIDTH_SCALE = 0.9;

/** 4차선 이상 도로 너비 배율. */
const FOUR_LANE_WIDTH_SCALE = 1.08;

/** 1차선 이하 도로 너비 배율. */
const ONE_LANE_WIDTH_SCALE = 0.9;

/** 보도 footway/pedestrian 너비 배율. */
const FOOTWAY_WIDTH_SCALE = 1.08;

/** 보도 steps/path 너비 배율. */
const STEPS_PATH_WIDTH_SCALE = 0.9;

/** Cobblestone/sett 도로 추가 높이 (m). */
const COBBLESTONE_Y_OFFSET_M = 0.008;

/** Gravel/unpaved 도로 추가 높이 (m). */
const GRAVEL_Y_OFFSET_M = 0.004;

/** Paving stones/tiles 보도 추가 높이 (m). */
const PAVING_STONES_Y_OFFSET_M = 0.004;

/** Wood 보도 추가 높이 (m). */
const WOOD_Y_OFFSET_M = 0.006;

/** DEM 샘플 최대 참조 수. */
const MAX_DEM_SAMPLE_REFERENCES = 4;

/** DEM 샘플 최소 거리 (m). */
const MIN_DEM_SAMPLE_DISTANCE_M = 0.5;

/** DEM relief 최소값 (m). */
const MIN_DEM_RELIEF_M = -5;

/** DEM relief 최대값 (m). */
const MAX_DEM_RELIEF_M = 5;

/** Ground relief 사인파 주파수. */
const GROUND_RELIEF_SINE_FREQ = 0.00042;

/** Ground relief 코사인파 주파수. */
const GROUND_RELIEF_COS_FREQ = 0.00035;

/** Ground base Y 오프셋 (m). */
const GROUND_BASE_Y_OFFSET_M = -0.06;

/** 거리 판정 임계값 (denom). */
const DISTANCE_THRESHOLD_DENOM = 1e-9;

export function createGroundGeometry(sceneMeta: SceneMeta): GeometryBuffers {
  const geometry = createEmptyGeometry();
  const ne = toLocalPoint(sceneMeta.origin, sceneMeta.bounds.northEast);
  const sw = toLocalPoint(sceneMeta.origin, sceneMeta.bounds.southWest);
  const centerX = (sw[0] + ne[0]) / 2;
  const centerZ = (sw[2] + ne[2]) / 2;
  const radius = Math.max(1, Math.hypot(ne[0] - sw[0], ne[2] - sw[2]) / 2);

  const GRID = GROUND_GRID_RESOLUTION;
  const grid: Vec3[][] = [];
  for (let iz = 0; iz <= GRID; iz += 1) {
    const row: Vec3[] = [];
    const tz = iz / GRID;
    const z = sw[2] + (ne[2] - sw[2]) * tz;
    for (let ix = 0; ix <= GRID; ix += 1) {
      const tx = ix / GRID;
      const x = sw[0] + (ne[0] - sw[0]) * tx;
      const y =
        GROUND_BASE_Y_OFFSET_M +
        resolveGroundElevationY(sceneMeta, x, z, centerX, centerZ, radius);
      row.push([x, y, z]);
    }
    grid.push(row);
  }

  for (let iz = 0; iz < GRID; iz += 1) {
    for (let ix = 0; ix < GRID; ix += 1) {
      const a = grid[iz][ix];
      const b = grid[iz][ix + 1];
      const c = grid[iz + 1][ix + 1];
      const d = grid[iz + 1][ix];
      pushQuad(geometry, a, b, c, d);
    }
  }

  return geometry;
}

function resolveGroundElevationY(
  sceneMeta: SceneMeta,
  x: number,
  z: number,
  centerX: number,
  centerZ: number,
  radius: number,
): number {
  const terrainProfile = sceneMeta.terrainProfile;
  if (
    (terrainProfile?.mode === 'LOCAL_DEM_SAMPLES' ||
      terrainProfile?.mode === 'DEM_FUSED') &&
    terrainProfile.samples.length > 0
  ) {
    return resolveDemSampleRelief(sceneMeta, x, z);
  }
  return resolveGroundReliefY(x, z, centerX, centerZ, radius);
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
      Math.max(MIN_ROAD_WIDTH_M, road.widthMeters * widthScale),
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
      Math.max(MIN_ROAD_WIDTH_M, road.widthMeters),
      Math.max(MIN_ROAD_EDGE_BAND_WIDTH_M, Math.min(MAX_ROAD_EDGE_BAND_WIDTH_M, road.widthMeters * ROAD_EDGE_BAND_WIDTH_RATIO)),
      ROAD_EDGE_BAND_HEIGHT_M,
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
        ? LANE_LINE_WIDTH_M
        : marking.type === 'STOP_LINE'
          ? STOP_LINE_WIDTH_M
          : CROSSWALK_MARKING_WIDTH_M;
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
        ? STOP_LINE_DECAL_WIDTH_M
        : decal.type === 'CROSSWALK_OVERLAY'
          ? decal.emphasis === 'hero'
            ? CROSSWALK_OVERLAY_HERO_WIDTH_M
            : CROSSWALK_OVERLAY_WIDTH_M
          : decal.emphasis === 'hero'
            ? LANE_OVERLAY_HERO_WIDTH_M
            : LANE_OVERLAY_WIDTH_M;
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
      heroStripe ? HERO_CROSSWALK_STRIPE_DEPTH_M : NORMAL_CROSSWALK_STRIPE_DEPTH_M,
      decal.stripeSet.stripeDepth * (heroStripe ? HERO_CROSSWALK_STRIPE_DEPTH_SCALE : 1),
    );
    const halfWidth = Math.max(
      heroStripe ? HERO_CROSSWALK_HALF_WIDTH_M : NORMAL_CROSSWALK_HALF_WIDTH_M,
      decal.stripeSet.halfWidth * (heroStripe ? HERO_CROSSWALK_HALF_WIDTH_SCALE : 1),
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
  roads: SceneMeta['roads'] = [],
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
    const halfWidth = crossing.principal ? PRINCIPAL_CROSSWALK_HALF_WIDTH_M : NORMAL_CROSSWALK_HALF_WIDTH_M;
    const y = CROSSWALK_Y + resolveCrosswalkYOffset(crossing, roads);
    const corridorCapacity = Math.max(
      6,
      Math.floor(length / Math.max(CROSSWALK_MIN_STRIPE_SPACING_M, halfWidth * CROSSWALK_STRIPE_SPACING_RATIO)),
    );
    const stripeCountBase = crossing.principal
      ? Math.max(PRINCIPAL_CROSSWALK_MIN_STRIPES, Math.min(PRINCIPAL_CROSSWALK_MAX_STRIPES, Math.floor(length / PRINCIPAL_CROSSWALK_STRIPE_SPACING_M) + signalizedBoost))
      : Math.max(NORMAL_CROSSWALK_MIN_STRIPES, Math.min(NORMAL_CROSSWALK_MAX_STRIPES, Math.floor(length / NORMAL_CROSSWALK_STRIPE_SPACING_M) + signalizedBoost));
    const stripeCount = Math.min(stripeCountBase, corridorCapacity);
    const stripeDepth = crossing.principal ? PRINCIPAL_CROSSWALK_STRIPE_DEPTH_M : NORMAL_CROSSWALK_STRIPE_DEPTH_M;

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
      Math.max(MIN_WALKWAY_WIDTH_M, walkway.widthMeters * widthScale),
      WALKWAY_BASE_Y + yOffset,
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
    const roadWidth = Math.max(MIN_ROAD_WIDTH_M, road.widthMeters);
    const curbHeight = CURB_HEIGHT_M;
    const curbWidth = CURB_WIDTH_M;
    pushPathCurb(
      origin,
      geometry,
      road.path,
      roadWidth,
      curbWidth,
      curbHeight,
      ROAD_BASE_Y + resolveRoadYOffset(road),
    );
  }
  return geometry;
}

export function createMedianGeometry(
  origin: Coordinate,
  roads: SceneMeta['roads'],
): GeometryBuffers {
  const geometry = createEmptyGeometry();
  for (const road of roads) {
    const roadWidth = Math.max(MIN_ROAD_WIDTH_M, road.widthMeters);
    if (roadWidth < MEDIAN_MIN_WIDTH_M) {
      continue;
    }
    const medianWidth = Math.min(MEDIAN_WIDTH_M, roadWidth * MEDIAN_WIDTH_RATIO);
    const medianHeight = MEDIAN_HEIGHT_M;
    pushPathMedian(
      origin,
      geometry,
      road.path,
      roadWidth,
      medianWidth,
      medianHeight,
      ROAD_BASE_Y + resolveRoadYOffset(road) + MEDIAN_EXTRA_HEIGHT_M,
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
    const walkwayWidth = Math.max(MIN_WALKWAY_WIDTH_M, walkway.widthMeters);
    const edgeHeight = SIDEWALK_EDGE_HEIGHT_M;
    const edgeWidth = SIDEWALK_EDGE_WIDTH_M;
    pushPathSidewalkEdge(
      origin,
      geometry,
      walkway.path,
      walkwayWidth,
      edgeWidth,
      edgeHeight,
      WALKWAY_BASE_Y + resolveWalkwayYOffset(walkway),
    );
  }
  return geometry;
}

function resolveRoadWidthScale(road: SceneMeta['roads'][number]): number {
  const className = road.roadClass.toLowerCase();
  if (className.includes('motorway') || className.includes('trunk')) {
    return MOTORWAY_WIDTH_SCALE;
  }
  if (className.includes('primary')) {
    return PRIMARY_WIDTH_SCALE;
  }
  if (className.includes('secondary')) {
    return SECONDARY_WIDTH_SCALE;
  }
  if (className.includes('tertiary')) {
    return TERTIARY_WIDTH_SCALE;
  }
  if (className.includes('residential') || className.includes('service')) {
    return RESIDENTIAL_WIDTH_SCALE;
  }
  return road.laneCount >= 4 ? FOUR_LANE_WIDTH_SCALE : road.laneCount <= 1 ? ONE_LANE_WIDTH_SCALE : 1;
}

function resolveRoadYOffset(road: SceneMeta['roads'][number]): number {
  const terrainOffset = road.terrainOffsetM ?? 0;
  const surface = road.surface?.toLowerCase() ?? '';
  if (surface.includes('cobblestone') || surface.includes('sett')) {
    return terrainOffset + COBBLESTONE_Y_OFFSET_M;
  }
  if (surface.includes('gravel') || surface.includes('unpaved')) {
    return terrainOffset + GRAVEL_Y_OFFSET_M;
  }
  return terrainOffset;
}

function resolveWalkwayWidthScale(
  walkway: SceneMeta['walkways'][number],
): number {
  const type = walkway.walkwayType.toLowerCase();
  if (type.includes('footway') || type.includes('pedestrian')) {
    return FOOTWAY_WIDTH_SCALE;
  }
  if (type.includes('steps') || type.includes('path')) {
    return STEPS_PATH_WIDTH_SCALE;
  }
  return 1;
}

function resolveWalkwayYOffset(walkway: SceneMeta['walkways'][number]): number {
  const terrainOffset = walkway.terrainOffsetM ?? 0;
  const surface = walkway.surface?.toLowerCase() ?? '';
  if (surface.includes('paving_stones') || surface.includes('tiles')) {
    return terrainOffset + PAVING_STONES_Y_OFFSET_M;
  }
  if (surface.includes('wood')) {
    return terrainOffset + WOOD_Y_OFFSET_M;
  }
  return terrainOffset;
}

function resolveCrosswalkYOffset(
  crossing: SceneCrossingDetail,
  roads: SceneMeta['roads'],
): number {
  if (!crossing.center || roads.length === 0) {
    return 0;
  }

  let nearestDistance = Number.POSITIVE_INFINITY;
  let nearestTerrainOffset = 0;
  for (const road of roads) {
    const distance = distanceToPathMeters(crossing.center, road.path);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestTerrainOffset = road.terrainOffsetM ?? 0;
    }
  }
  return nearestTerrainOffset;
}

function distanceToPathMeters(point: Coordinate, path: Coordinate[]): number {
  if (path.length < 2) {
    return Number.POSITIVE_INFINITY;
  }

  let minimum = Number.POSITIVE_INFINITY;
  for (let index = 0; index < path.length - 1; index += 1) {
    const start = toLocalPoint(point, path[index]);
    const end = toLocalPoint(point, path[index + 1]);
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
  if (denom <= DISTANCE_THRESHOLD_DENOM) {
    return Math.hypot(apX, apY);
  }
  const t = Math.max(0, Math.min(1, (apX * abX + apY * abY) / denom));
  const closestX = start[0] + abX * t;
  const closestY = start[1] + abY * t;
  return Math.hypot(point[0] - closestX, point[1] - closestY);
}

function resolveGroundReliefY(
  x: number,
  z: number,
  centerX: number,
  centerZ: number,
  radius: number,
): number {
  const dx = (x - centerX) / radius;
  const dz = (z - centerZ) / radius;
  const radial = Math.max(0, 1 - Math.min(1, Math.hypot(dx, dz)));
  const longWave =
    Math.sin((x + z) * GROUND_RELIEF_SINE_FREQ) * GROUND_RELIEF_LONG_WAVE_AMPLITUDE_M;
  const crossWave =
    Math.cos((x - z) * GROUND_RELIEF_COS_FREQ) * GROUND_RELIEF_CROSS_WAVE_AMPLITUDE_M;
  const relief = radial * GROUND_RELIEF_RADIAL_AMPLITUDE_M + longWave + crossWave;
  return Number(relief.toFixed(4));
}

function resolveDemSampleRelief(
  sceneMeta: SceneMeta,
  x: number,
  z: number,
): number {
  const terrainProfile = sceneMeta.terrainProfile;
  if (!terrainProfile || terrainProfile.samples.length === 0) {
    return 0;
  }

  const weighted = terrainProfile.samples
    .map((sample) => {
      const local = toLocalPoint(sceneMeta.origin, sample.location);
      const dx = local[0] - x;
      const dz = local[2] - z;
      const distance = Math.max(MIN_DEM_SAMPLE_DISTANCE_M, Math.hypot(dx, dz));
      const weight = 1 / distance;
      return {
        deltaHeight: sample.heightMeters - terrainProfile.baseHeightMeters,
        weight,
      };
    })
    .sort((left, right) => right.weight - left.weight)
    .slice(0, MAX_DEM_SAMPLE_REFERENCES);

  const totalWeight = weighted.reduce((sum, item) => sum + item.weight, 0);
  if (totalWeight <= 0) {
    return 0;
  }

  const relief =
    weighted.reduce((sum, item) => sum + item.deltaHeight * item.weight, 0) /
    totalWeight;
  return Number(Math.max(-5, Math.min(5, relief)).toFixed(4));
}
