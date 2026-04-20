import type {
  GeometryStrategy,
  SceneMeta,
} from '../../../scene/types/scene.types';
import type { Coordinate } from '../../../places/types/place.types';
import type { GeometryBuffers, Vec3 } from '../road/road-mesh.builder';
import { createEmptyGeometry } from '../road/road-mesh.builder';
import {
  averagePoint,
  computeBounds,
  isPolygonTooThin,
  normalizeLocalRing,
  samePointXZ,
  toLocalRing,
} from './building-mesh-utils';
import {
  pushBox,
  pushQuad,
  pushTriangle,
} from './building-mesh.geometry-primitives';

/** 건물 기초 최소 깊이 (m). 지반 안정성 기준. */
const MIN_FOUNDATION_DEPTH_M = 0.4;

/** 건물 기초 최대 깊이 (m). 지하주차장 고려. */
const MAX_FOUNDATION_DEPTH_M = 1.1;

/** Podium과 tower setback 사이 겹침 거리 (m). 0이면 join geometry로 연결. */
const SETBACK_OVERLAP_M = 0.0;

/** Setback 시 링 면적 최소값 (㎡). 이보다 작으면 inset 중단. */
const MIN_SETBACK_RING_AREA_M2 = 0.5;

/** 지형 오프셋이 기초 깊이에 반영되는 비율. */
const FOUNDATION_TERRAIN_SCALE = 0.3;

/** 지형 오프셋이 기초 깊이에 반영되는 최대값 (m). */
const MAX_FOUNDATION_TERRAIN_OFFSET = 0.5;

/** Setback 단계당 기본 inset 비율 (12%). 건축물 퇴보 규정 기반. */
const SETBACK_INSET_RATIO = 0.12;

/** Setback 단계별 추가 inset 비율 (4%씩 증가). */
const SETBACK_STAGE_INSET_INCREMENT = 0.04;

/** Corner tower 건물용 setback 기본 inset 비율. */
const CORNER_TOWER_SETBACK_BASE_RATIO = 0.18;

/** Corner tower 건물용 setback 단계별 inset 증가분. */
const CORNER_TOWER_SETBACK_STAGE_INCREMENT = 0.05;

/** Slab midrise 건물용 setback 기본 inset 비율. */
const SLAB_MIDRISE_SETBACK_BASE_RATIO = 0.08;

/** Slab midrise 건물용 setback 단계별 inset 증가분. */
const SLAB_MIDRISE_SETBACK_STAGE_INCREMENT = 0.03;

/** Podium tower 건물용 tower inset 비율 (corner chamfer 없을 때). */
const PODIUM_TOWER_INSET_RATIO_DEFAULT = 0.14;

/** Podium tower 건물용 tower inset 비율 (corner chamfer 있을 때). */
const PODIUM_TOWER_INSET_RATIO_CHAMFER = 0.2;

/** LOD LOW 단순화 허용오차 (m). */
const LOD_LOW_SIMPLIFY_TOLERANCE_M = 1.5;

/** LOD MEDIUM 단순화 허용오차 (m). */
const LOD_MEDIUM_SIMPLIFY_TOLERANCE_M = 0.8;

/** 건물 높이 최소값 (m). */
const MIN_BUILDING_HEIGHT_M = 4;

/** Podium 높이 비율 (건물 높이의 52%). */
const PODIUM_HEIGHT_RATIO = 0.52;

/** Podium 최소 높이 (m). */
const MIN_PODIUM_HEIGHT_M = 6;

/** Podium 기본 층수. */
const DEFAULT_PODIUM_LEVELS = 2;

/** Podium 층당 높이 (m). */
const PODIUM_LEVEL_HEIGHT_M = 4;

/** Stepped tower base 높이 비율 (건물 높이의 58%). */
const STEPPED_TOWER_BASE_RATIO = 0.58;

/** Stepped tower base 최소 높이 (m). */
const STEPPED_TOWER_BASE_MIN_HEIGHT_M = 8;

/** Stepped tower 기본 단계 수. */
const DEFAULT_STEPPED_TOWER_STAGES = 2;

/** Stepped tower 최대 단계 수. */
const MAX_STEPPED_TOWER_STAGES = 3;

/** Gable/Hipped roof 최소 높이 (m). */
const MIN_ROOF_BASE_HEIGHT_M = 3.2;

/** Gable/Hipped roof 높이 비율 (건물 높이의 72%). */
const ROOF_BASE_HEIGHT_RATIO = 0.72;

/** Hero building 높이 최소값 (m). */
const MIN_HERO_BUILDING_HEIGHT_M = 6;

/** Hero building podium 높이 비율 (건물 높이의 45%). */
const HERO_PODIUM_HEIGHT_RATIO = 0.45;

/** Hero building podium 최소 높이 (m). */
const HERO_MIN_PODIUM_HEIGHT_M = 5.5;

/** Hero building podium 층당 높이 (m). */
const HERO_PODIUM_LEVEL_HEIGHT_M = 3.8;

/** Hero building 기본 setback 단계 수. */
const HERO_DEFAULT_SETBACKS = 1;

/** Ridge 길이 비율 (bounds의 60%). */
const RIDGE_LENGTH_RATIO = 0.6;

/** Ridge 최소 길이 (m). */
const MIN_RIDGE_LENGTH_M = 1.0;

/** Gable/Hipped roof 추가 높이 (m). */
const ROOF_EXTRA_HEIGHT_M = 1.1;

/** Simplify 후 면적 판정 임계값. */
const SIMPLIFY_AREA_THRESHOLD = 0.001;

export interface BuildingShellClosureMetrics {
  openShellCount: number;
  invalidSetbackJoinCount: number;
}

const INITIAL_SHELL_CLOSURE_METRICS: BuildingShellClosureMetrics = {
  openShellCount: 0,
  invalidSetbackJoinCount: 0,
};

export function collectBuildingShellClosureMetrics(
  origin: Coordinate,
  buildings: SceneMeta['buildings'],
): BuildingShellClosureMetrics {
  const metrics: BuildingShellClosureMetrics = {
    ...INITIAL_SHELL_CLOSURE_METRICS,
  };

  for (const building of buildings) {
    const outerRing = normalizeLocalRing(
      toLocalRing(origin, building.outerRing),
      'CCW',
    );
    const holes = building.holes
      .map((ring) => normalizeLocalRing(toLocalRing(origin, ring), 'CW'))
      .filter((ring) => ring.length >= 3);

    if (outerRing.length < 3) {
      metrics.openShellCount += 1;
      continue;
    }

    const strategy = resolveBuildingGeometryStrategy(
      building,
      holes,
      outerRing,
    );
    const isFallback = strategy === 'fallback_massing';

    if (!isFallback && strategy !== 'courtyard_block' && holes.length > 0) {
      metrics.openShellCount += 1;
    }

    const setbackLevels = Math.max(0, building.setbackLevels ?? 0);
    if (strategy === 'stepped_tower' && setbackLevels > 0) {
      let currentRing = outerRing;
      for (let stage = 0; stage < setbackLevels; stage += 1) {
        let nextRing = insetRing(currentRing, SETBACK_INSET_RATIO + stage * SETBACK_STAGE_INSET_INCREMENT);
        if (nextRing.length < 3) {
          metrics.invalidSetbackJoinCount += 1;
          nextRing = [...currentRing];
        }
        const ringArea = computeRingAreaM2(nextRing);
        if (ringArea < MIN_SETBACK_RING_AREA_M2) {
          metrics.invalidSetbackJoinCount += 1;
          nextRing = [...currentRing];
        }
        currentRing = nextRing;
      }
    }
  }

  return metrics;
}

export function createBuildingShellGeometry(
  origin: Coordinate,
  buildings: SceneMeta['buildings'],
  triangulate: (
    vertices: number[],
    holes?: number[],
    dimensions?: number,
  ) => number[],
): GeometryBuffers {
  const geometry = createEmptyGeometry();

  for (const building of buildings) {
    const outerRing = normalizeLocalRing(
      toLocalRing(origin, building.outerRing),
      'CCW',
    );
    const holes = building.holes
      .map((ring) => normalizeLocalRing(toLocalRing(origin, ring), 'CW'))
      .filter((ring) => ring.length >= 3);
    if (outerRing.length < 3) {
      continue;
    }

    pushBuildingByStrategy(geometry, building, outerRing, holes, triangulate);
  }

  return geometry;
}

export function insetRing(points: Vec3[], ratio: number): Vec3[] {
  const center = averagePoint(points);
  return points.map((point) => [
    center[0] + (point[0] - center[0]) * (1 - ratio),
    point[1],
    center[2] + (point[2] - center[2]) * (1 - ratio),
  ]);
}

export function resolveBuildingVerticalBase(
  building: SceneMeta['buildings'][number],
): number {
  return Number((building.terrainOffsetM ?? 0).toFixed(3));
}

export function pushExtrudedPolygon(
  geometry: GeometryBuffers,
  outerRing: Vec3[],
  holes: Vec3[][],
  minHeight: number,
  maxHeight: number,
  triangulate: (
    vertices: number[],
    holes?: number[],
    dimensions?: number,
  ) => number[],
  buildingId?: string,
): void {
  const triangulated = triangulateRings(outerRing, holes, triangulate);
  if (triangulated.length === 0) {
    if (buildingId) {
      console.warn('[building.triangulation.fallback]', {
        buildingId,
        ringVertexCount: outerRing.length,
        holeCount: holes.length,
      });
    }
    const bounds = computeBounds(outerRing);
    pushBox(
      geometry,
      [bounds.minX, minHeight, bounds.minZ],
      [bounds.maxX, maxHeight, bounds.maxZ],
    );
    return;
  }

  for (const [a, b, c] of triangulated) {
    pushTriangle(
      geometry,
      [a[0], maxHeight, a[2]],
      [b[0], maxHeight, b[2]],
      [c[0], maxHeight, c[2]],
    );
    pushTriangle(
      geometry,
      [a[0], minHeight, a[2]],
      [c[0], minHeight, c[2]],
      [b[0], minHeight, b[2]],
    );
  }

  pushRingWallsBetween(geometry, outerRing, minHeight, maxHeight, false);
  for (const hole of holes) {
    pushRingWallsBetween(geometry, hole, minHeight, maxHeight, true);
  }
}

function pushBuildingByStrategy(
  geometry: GeometryBuffers,
  building: SceneMeta['buildings'][number],
  outerRing: Vec3[],
  holes: Vec3[][],
  triangulate: (
    vertices: number[],
    holes?: number[],
    dimensions?: number,
  ) => number[],
): void {
  const foundationDepth = resolveFoundationDepth(building);
  const baseY = resolveBuildingVerticalBase(building);
  const buildingId = building.objectId;

  if (building.visualRole && building.visualRole !== 'generic') {
    pushHeroBuilding(
      geometry,
      building,
      outerRing,
      holes,
      triangulate,
      foundationDepth,
    );
    return;
  }

  const strategy = resolveBuildingGeometryStrategy(building, holes, outerRing);
  const height = Math.max(MIN_BUILDING_HEIGHT_M, building.heightMeters);
  const lodLevel = (building as { lodLevel?: string }).lodLevel ?? 'HIGH';

  const simplifiedRing =
    lodLevel === 'LOW'
      ? simplifyRing(outerRing, LOD_LOW_SIMPLIFY_TOLERANCE_M)
      : lodLevel === 'MEDIUM'
        ? simplifyRing(outerRing, LOD_MEDIUM_SIMPLIFY_TOLERANCE_M)
        : outerRing;
  const simplifiedHoles = lodLevel === 'LOW' ? [] : holes;

  switch (strategy) {
    case 'podium_tower': {
      const podiumHeight = Math.min(
        height * PODIUM_HEIGHT_RATIO,
        Math.max(MIN_PODIUM_HEIGHT_M, (building.podiumLevels ?? DEFAULT_PODIUM_LEVELS) * PODIUM_LEVEL_HEIGHT_M),
      );
      pushExtrudedPolygon(
        geometry,
        simplifiedRing,
        simplifiedHoles,
        baseY - foundationDepth,
        baseY + podiumHeight,
        triangulate,
        buildingId,
      );
      if (lodLevel === 'HIGH') {
        const insetRatio = building.cornerChamfer ? PODIUM_TOWER_INSET_RATIO_CHAMFER : PODIUM_TOWER_INSET_RATIO_DEFAULT;
        const towerRing = insetRing(simplifiedRing, insetRatio);
        if (towerRing.length >= 3) {
          const towerTop = Math.max(podiumHeight + 4, height);
          pushExtrudedPolygon(
            geometry,
            towerRing,
            [],
            baseY + podiumHeight - SETBACK_OVERLAP_M,
            baseY + towerTop,
            triangulate,
            buildingId,
          );
          if (SETBACK_OVERLAP_M === 0) {
            pushSetbackJoinGeometry(
              geometry,
              simplifiedRing,
              towerRing,
              baseY + podiumHeight,
            );
          }
        }
      }
      break;
    }
    case 'stepped_tower': {
      const baseTop = Math.max(STEPPED_TOWER_BASE_MIN_HEIGHT_M, height * STEPPED_TOWER_BASE_RATIO);
      pushExtrudedPolygon(
        geometry,
        simplifiedRing,
        simplifiedHoles,
        baseY - foundationDepth,
        baseY + baseTop,
        triangulate,
        buildingId,
      );
      if (lodLevel === 'HIGH') {
        let currentRing = simplifiedRing;
        const stageCount = Math.max(
          DEFAULT_STEPPED_TOWER_STAGES,
          Math.min(MAX_STEPPED_TOWER_STAGES, building.setbackLevels ?? DEFAULT_STEPPED_TOWER_STAGES),
        );
        let prevRing = simplifiedRing;
        let prevTop = baseTop;
        for (let stage = 0; stage < stageCount; stage += 1) {
          currentRing = insetRing(currentRing, SETBACK_INSET_RATIO + stage * SETBACK_STAGE_INSET_INCREMENT);
          if (currentRing.length < 3) {
            currentRing = [...prevRing];
          }
          const stageMin =
            stage === 0
              ? baseTop - SETBACK_OVERLAP_M
              : baseTop +
                stage * ((height - baseTop) / stageCount) -
                SETBACK_OVERLAP_M;
          const stageMax =
            stage === stageCount - 1
              ? height
              : baseTop + (stage + 1) * ((height - baseTop) / stageCount);
          pushExtrudedPolygon(
            geometry,
            currentRing,
            [],
            baseY + stageMin,
            baseY + stageMax,
            triangulate,
            buildingId,
          );
          if (SETBACK_OVERLAP_M === 0) {
            pushSetbackJoinGeometry(
              geometry,
              prevRing,
              currentRing,
              baseY + prevTop,
            );
          }
          prevRing = currentRing;
          prevTop = stageMax;
        }
      }
      break;
    }
    case 'gable_lowrise': {
      const roofBaseHeight = Math.max(MIN_ROOF_BASE_HEIGHT_M, height * ROOF_BASE_HEIGHT_RATIO);
      pushExtrudedPolygon(
        geometry,
        simplifiedRing,
        simplifiedHoles,
        baseY - foundationDepth,
        baseY + roofBaseHeight,
        triangulate,
        buildingId,
      );
      if (lodLevel === 'HIGH') {
        pushGableRoof(
          geometry,
          simplifiedRing,
          baseY + roofBaseHeight,
          baseY + height,
        );
      }
      break;
    }
    case 'hipped_lowrise': {
      const roofBaseHeight = Math.max(MIN_ROOF_BASE_HEIGHT_M, height * ROOF_BASE_HEIGHT_RATIO);
      pushExtrudedPolygon(
        geometry,
        simplifiedRing,
        simplifiedHoles,
        baseY - foundationDepth,
        baseY + roofBaseHeight,
        triangulate,
        buildingId,
      );
      if (lodLevel === 'HIGH') {
        pushHippedRoof(
          geometry,
          simplifiedRing,
          baseY + roofBaseHeight,
          baseY + height,
        );
      }
      break;
    }
    case 'pyramidal_lowrise': {
      const roofBaseHeight = Math.max(MIN_ROOF_BASE_HEIGHT_M, height * ROOF_BASE_HEIGHT_RATIO);
      pushExtrudedPolygon(
        geometry,
        simplifiedRing,
        simplifiedHoles,
        baseY - foundationDepth,
        baseY + roofBaseHeight,
        triangulate,
        buildingId,
      );
      if (lodLevel === 'HIGH') {
        pushPyramidalRoof(
          geometry,
          simplifiedRing,
          baseY + roofBaseHeight,
          baseY + height,
        );
      }
      break;
    }
    case 'courtyard_block': {
      pushExtrudedPolygon(
        geometry,
        simplifiedRing,
        simplifiedHoles,
        baseY - foundationDepth,
        baseY + height,
        triangulate,
        buildingId,
      );
      break;
    }
    case 'fallback_massing': {
      const bounds = computeBounds(simplifiedRing);
      pushBox(
        geometry,
        [bounds.minX, baseY - foundationDepth, bounds.minZ],
        [bounds.maxX, baseY + height, bounds.maxZ],
      );
      break;
    }
    case 'simple_extrude':
    default: {
      pushExtrudedPolygon(
        geometry,
        simplifiedRing,
        simplifiedHoles,
        baseY - foundationDepth,
        baseY + height,
        triangulate,
        buildingId,
      );
      break;
    }
  }
}

function pushHeroBuilding(
  geometry: GeometryBuffers,
  building: SceneMeta['buildings'][number],
  outerRing: Vec3[],
  holes: Vec3[][],
  triangulate: (
    vertices: number[],
    holes?: number[],
    dimensions?: number,
  ) => number[],
  foundationDepth: number,
): void {
  const height = Math.max(MIN_HERO_BUILDING_HEIGHT_M, building.heightMeters);
  const baseY = resolveBuildingVerticalBase(building);
  const buildingId = building.objectId;
  const baseMass = building.baseMass ?? 'podium_tower';
  const podiumLevels =
    building.podiumSpec?.levels ?? building.podiumLevels ?? 2;
  const setbacks = building.podiumSpec?.setbacks ?? building.setbackLevels ?? 1;
  const podiumHeight = Math.min(
    height * HERO_PODIUM_HEIGHT_RATIO,
    Math.max(HERO_MIN_PODIUM_HEIGHT_M, podiumLevels * HERO_PODIUM_LEVEL_HEIGHT_M),
  );

  if (baseMass === 'lowrise_strip') {
    pushExtrudedPolygon(
      geometry,
      outerRing,
      holes,
      baseY - foundationDepth,
      baseY + height,
      triangulate,
      buildingId,
    );
    return;
  }

  if (baseMass === 'simple') {
    pushExtrudedPolygon(
      geometry,
      outerRing,
      holes,
      baseY - foundationDepth,
      baseY + height,
      triangulate,
      buildingId,
    );
    return;
  }

  pushExtrudedPolygon(
    geometry,
    outerRing,
    holes,
    baseY - foundationDepth,
    baseY + podiumHeight,
    triangulate,
    buildingId,
  );

  let currentRing = outerRing;
  const stageCount =
    baseMass === 'stepped_tower' || baseMass === 'corner_tower'
      ? Math.max(DEFAULT_STEPPED_TOWER_STAGES, setbacks || DEFAULT_STEPPED_TOWER_STAGES)
      : HERO_DEFAULT_SETBACKS;
  let prevRing = outerRing;
  let prevTop = podiumHeight;
  for (let stage = 0; stage < stageCount; stage += 1) {
    const insetRatio =
      baseMass === 'corner_tower'
        ? CORNER_TOWER_SETBACK_BASE_RATIO + stage * CORNER_TOWER_SETBACK_STAGE_INCREMENT
        : baseMass === 'slab_midrise'
          ? SLAB_MIDRISE_SETBACK_BASE_RATIO + stage * SLAB_MIDRISE_SETBACK_STAGE_INCREMENT
          : SETBACK_INSET_RATIO + stage * SETBACK_STAGE_INSET_INCREMENT;
    currentRing = insetRing(currentRing, insetRatio);
    if (currentRing.length < 3) {
      currentRing = [...prevRing];
    }
    const stageMin =
      stage === 0
        ? podiumHeight - SETBACK_OVERLAP_M
        : podiumHeight +
          stage * ((height - podiumHeight) / stageCount) -
          SETBACK_OVERLAP_M;
    const stageMax =
      stage === stageCount - 1
        ? height
        : podiumHeight + (stage + 1) * ((height - podiumHeight) / stageCount);
    pushExtrudedPolygon(
      geometry,
      currentRing,
      [],
      baseY + stageMin,
      baseY + stageMax,
      triangulate,
      buildingId,
    );
    if (SETBACK_OVERLAP_M === 0) {
      pushSetbackJoinGeometry(
        geometry,
        prevRing,
        currentRing,
        baseY + prevTop,
      );
    }
    prevRing = currentRing;
    prevTop = stageMax;
  }
}

function resolveFoundationDepth(
  building: SceneMeta['buildings'][number],
): number {
  const groundOffset = Math.max(0, building.groundOffsetM ?? 0);
  const terrainOffset = Math.abs(building.terrainOffsetM ?? 0);
  const terrainAdjustment = Math.min(
    MAX_FOUNDATION_TERRAIN_OFFSET,
    terrainOffset * FOUNDATION_TERRAIN_SCALE,
  );
  const base = MIN_FOUNDATION_DEPTH_M + groundOffset + terrainAdjustment;
  return Math.min(MAX_FOUNDATION_DEPTH_M, Number(base.toFixed(3)));
}

function triangulateRings(
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
    const idxA = indices[index];
    const idxB = indices[index + 1];
    const idxC = indices[index + 2];
    if (idxA === undefined || idxB === undefined || idxC === undefined) continue;
    const a = points[idxA];
    const b = points[idxB];
    const c = points[idxC];
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

function pushRingWallsBetween(
  geometry: GeometryBuffers,
  ring: Vec3[],
  minHeight: number,
  maxHeight: number,
  invert: boolean,
): void {
  for (let index = 0; index < ring.length; index += 1) {
    const current = ring[index];
    const next = ring[(index + 1) % ring.length];
    if (!current || !next) continue;
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

function pushSetbackJoinGeometry(
  geometry: GeometryBuffers,
  outerRing: Vec3[],
  innerRing: Vec3[],
  joinY: number,
): void {
  const len = Math.min(outerRing.length, innerRing.length);
  if (len < 3) return;

  for (let i = 0; i < len; i += 1) {
    const p1 = outerRing[i];
    const p2 = outerRing[(i + 1) % len];
    const t1 = innerRing[i];
    const t2 = innerRing[(i + 1) % len];
    if (!p1 || !p2 || !t1 || !t2) continue;

    const a: Vec3 = [p1[0], joinY, p1[2]];
    const b: Vec3 = [p2[0], joinY, p2[2]];
    const c: Vec3 = [t1[0], joinY, t1[2]];
    const d: Vec3 = [t2[0], joinY, t2[2]];

    pushTriangle(geometry, a, b, c);
    pushTriangle(geometry, b, d, c);
  }
}

function resolveRidgeForIrregularRing(
  ring: Vec3[],
  ridgeHeight: number,
): { ridgeA: Vec3; ridgeB: Vec3; ridgeAlongX: boolean } {
  const bounds = computeBounds(ring);
  const centroid = averagePoint(ring);
  const ridgeAlongX = bounds.width >= bounds.depth;
  const ridgeLength = Math.max(
    (ridgeAlongX ? bounds.width : bounds.depth) * RIDGE_LENGTH_RATIO,
    MIN_RIDGE_LENGTH_M,
  );

  const ridgeA: Vec3 = ridgeAlongX
    ? [centroid[0] - ridgeLength / 2, ridgeHeight, centroid[2]]
    : [centroid[0], ridgeHeight, centroid[2] - ridgeLength / 2];
  const ridgeB: Vec3 = ridgeAlongX
    ? [centroid[0] + ridgeLength / 2, ridgeHeight, centroid[2]]
    : [centroid[0], ridgeHeight, centroid[2] + ridgeLength / 2];

  return { ridgeA, ridgeB, ridgeAlongX };
}

function pushGableRoof(
  geometry: GeometryBuffers,
  outerRing: Vec3[],
  roofBaseHeight: number,
  topHeight: number,
): void {
  const bounds = computeBounds(outerRing);
  const ridgeHeight = Math.max(topHeight, roofBaseHeight + ROOF_EXTRA_HEIGHT_M);
  const { ridgeA, ridgeB, ridgeAlongX } = resolveRidgeForIrregularRing(
    outerRing,
    ridgeHeight,
  );

  for (let index = 0; index < outerRing.length; index += 1) {
    const current = outerRing[index];
    const next = outerRing[(index + 1) % outerRing.length];
    if (!current || !next) continue;
    const currentRidge = ridgeAlongX
      ? ([current[0], ridgeHeight, ridgeA[2]] as Vec3)
      : ([ridgeA[0], ridgeHeight, current[2]] as Vec3);
    const nextRidge = ridgeAlongX
      ? ([next[0], ridgeHeight, ridgeA[2]] as Vec3)
      : ([ridgeA[0], ridgeHeight, next[2]] as Vec3);
    pushQuad(
      geometry,
      [current[0], roofBaseHeight, current[2]],
      [next[0], roofBaseHeight, next[2]],
      nextRidge,
      currentRidge,
    );
  }

  pushTriangle(
    geometry,
    [bounds.minX, roofBaseHeight, bounds.minZ],
    [bounds.minX, roofBaseHeight, bounds.maxZ],
    ridgeA,
  );
  pushTriangle(
    geometry,
    [bounds.maxX, roofBaseHeight, bounds.maxZ],
    [bounds.maxX, roofBaseHeight, bounds.minZ],
    ridgeB,
  );
}

function pushHippedRoof(
  geometry: GeometryBuffers,
  outerRing: Vec3[],
  roofBaseHeight: number,
  topHeight: number,
): void {
  const bounds = computeBounds(outerRing);
  const ridgeHeight = Math.max(topHeight, roofBaseHeight + ROOF_EXTRA_HEIGHT_M);
  const { ridgeA, ridgeB } = resolveRidgeForIrregularRing(
    outerRing,
    ridgeHeight,
  );
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerZ = (bounds.minZ + bounds.maxZ) / 2;

  for (let index = 0; index < outerRing.length; index += 1) {
    const current = outerRing[index];
    const next = outerRing[(index + 1) % outerRing.length];
    if (!current || !next) continue;
    const isNearEnds =
      Math.abs(current[0] - bounds.minX) < 0.1 ||
      Math.abs(current[0] - bounds.maxX) < 0.1;
    const ridgePoint = isNearEnds
      ? ([current[0], ridgeHeight, centerZ] as Vec3)
      : ([
          current[0] > centerX ? ridgeB[0] : ridgeA[0],
          ridgeHeight,
          current[2],
        ] as Vec3);
    const nextRidgePoint = isNearEnds
      ? ([next[0], ridgeHeight, centerZ] as Vec3)
      : ([
          next[0] > centerX ? ridgeB[0] : ridgeA[0],
          ridgeHeight,
          next[2],
        ] as Vec3);
    pushQuad(
      geometry,
      [current[0], roofBaseHeight, current[2]],
      [next[0], roofBaseHeight, next[2]],
      nextRidgePoint,
      ridgePoint,
    );
  }
}

function pushPyramidalRoof(
  geometry: GeometryBuffers,
  outerRing: Vec3[],
  roofBaseHeight: number,
  topHeight: number,
): void {
  const bounds = computeBounds(outerRing);
  const apexHeight = Math.max(topHeight, roofBaseHeight + ROOF_EXTRA_HEIGHT_M);
  const apex: Vec3 = [
    (bounds.minX + bounds.maxX) / 2,
    apexHeight,
    (bounds.minZ + bounds.maxZ) / 2,
  ];

  for (let index = 0; index < outerRing.length; index += 1) {
    const current = outerRing[index];
    const next = outerRing[(index + 1) % outerRing.length];
    if (!current || !next) continue;
    pushTriangle(
      geometry,
      [current[0], roofBaseHeight, current[2]],
      [next[0], roofBaseHeight, next[2]],
      apex,
    );
  }
}

function resolveBuildingGeometryStrategy(
  building: SceneMeta['buildings'][number],
  holes: Vec3[][],
  outerRing: Vec3[],
): GeometryStrategy {
  if ((building.geometryStrategy ?? 'simple_extrude') === 'fallback_massing') {
    return 'fallback_massing';
  }
  if (holes.length > 0) {
    return 'courtyard_block';
  }
  if (isPolygonTooThin(outerRing)) {
    return 'fallback_massing';
  }

  const explicit = building.geometryStrategy;
  if (explicit && explicit !== 'simple_extrude') {
    return explicit;
  }

  const osm = building.osmAttributes ?? {};
  const levels = parseOsmInt(osm['building:levels']) ?? 0;
  const heightMeters = building.heightMeters ?? 0;
  const buildingType = osm['building'] ?? '';
  const roofShape = osm['roof:shape'] ?? '';

  if (levels >= 15 || heightMeters >= 50) {
    return 'stepped_tower';
  }

  if (roofShape === 'gabled' || roofShape === 'gable') {
    return 'gable_lowrise';
  }

  if (roofShape === 'hipped' || roofShape === 'hip') {
    return 'hipped_lowrise';
  }

  if (roofShape === 'pyramidal') {
    return 'pyramidal_lowrise';
  }

  if (
    (buildingType === 'retail' || buildingType === 'commercial') &&
    levels <= 4
  ) {
    return 'podium_tower';
  }

  if (levels >= 8 || heightMeters >= 28) {
    return 'podium_tower';
  }

  return 'simple_extrude';
}

function parseOsmInt(value: string | undefined): number | null {
  if (value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function computeRingAreaM2(ring: Vec3[]): number {
  if (ring.length < 3) {
    return 0;
  }
  let area = 0;
  for (let i = 0; i < ring.length; i += 1) {
    const current = ring[i];
    const next = ring[(i + 1) % ring.length];
    if (!current || !next) continue;
    area += current[0] * next[2] - next[0] * current[2];
  }
  return Math.abs(area) / 2;
}

function simplifyRing(ring: Vec3[], tolerance: number): Vec3[] {
  if (ring.length <= 4) {
    return ring;
  }
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (!first || !last) return ring;
  const result: Vec3[] = [first];
  for (let i = 1; i < ring.length - 1; i += 1) {
    const prev = result[result.length - 1];
    const curr = ring[i];
    if (!curr || !prev) continue;
    const dist = Math.sqrt((curr[0] - prev[0]) ** 2 + (curr[2] - prev[2]) ** 2);
    if (dist >= tolerance) {
      result.push(curr);
    }
  }
  result.push(last);

  if (result.length < 3) {
    return ring;
  }

  const hasArea = result.some((p, i) => {
    const next = result[(i + 1) % result.length];
    const nextNext = result[(i + 2) % result.length];
    if (!next || !nextNext) return false;
    const cross =
      (next[0] - p[0]) * (nextNext[2] - p[2]) -
      (next[2] - p[2]) * (nextNext[0] - p[0]);
    return Math.abs(cross) > SIMPLIFY_AREA_THRESHOLD;
  });

  return hasArea ? result : ring;
}
