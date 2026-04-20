import type { Coordinate } from '../../../places/types/place.types';
import type {
  SceneFacadeHint,
  SceneMeta,
} from '../../../scene/types/scene.types';
import type { GeometryBuffers, Vec3 } from '../road/road-mesh.builder';
import { createEmptyGeometry } from '../road/road-mesh.builder';
import { normalizeLocalRing, toLocalRing } from './building-mesh-utils';
import type { FacadeFrame } from './building-mesh.facade-frame.utils';
import { buildFacadeFrame } from './building-mesh.facade-frame.utils';
import { pushQuad } from './building-mesh.geometry-primitives';
import { resolveBuildingVerticalBase } from './building-mesh.shell.builder';
import { FACADE_FRAME_OFFSET_FROM_SHELL, WINDOW_OFFSET_FROM_PANEL } from './building-mesh.facade-frame.utils';

export interface BuildingWindowGeometryOptions {
  maxWindowTriangles?: number;
}

export function createBuildingWindowGeometry(
  origin: Coordinate,
  buildings: SceneMeta['buildings'],
  facadeHints: SceneFacadeHint[],
  options?: BuildingWindowGeometryOptions,
): GeometryBuffers {
  const geometry = createEmptyGeometry();
  const hintMap = new Map(facadeHints.map((hint) => [hint.objectId, hint]));
  const fallbackHint = buildFallbackFacadeHint(facadeHints[0]);
  const maxWindowTriangles =
    options?.maxWindowTriangles ?? MAX_WINDOW_TRIANGLES;
  const budget = {
    remainingTriangles: maxWindowTriangles,
  };

  for (const building of buildings) {
    if (budget.remainingTriangles < WINDOW_TRIANGLES_PER_EMIT_ESTIMATE) {
      break;
    }
    const hint = hintMap.get(building.objectId) ?? fallbackHint;
    const lodLevel =
      (building as { lodLevel?: 'HIGH' | 'MEDIUM' | 'LOW' }).lodLevel ?? 'HIGH';

    const outerRing = normalizeLocalRing(
      toLocalRing(origin, building.outerRing),
      'CCW',
    );
    if (outerRing.length < 3) {
      continue;
    }

    const windowConfig = resolveWindowConfig(building, hint, lodLevel);
  const height = Math.max(MIN_WINDOW_HEIGHT_M, building.heightMeters);
    const targetEdgeIndices = resolveWindowEdgeIndices(
      outerRing,
      hint,
      lodLevel,
    );
    if (targetEdgeIndices.length === 0) {
      continue;
    }

    for (const edgeIndex of targetEdgeIndices) {
      if (budget.remainingTriangles < WINDOW_TRIANGLES_PER_EMIT_ESTIMATE) {
        break;
      }
      const frameWithBase = buildFacadeFrame(
        outerRing,
        edgeIndex,
        height,
        resolveBuildingVerticalBase(building),
      );
      if (!frameWithBase) {
        continue;
      }

      pushWindowGrid(geometry, frameWithBase, windowConfig, height, budget);
    }
  }

  return geometry;
}

interface WindowConfig {
  archetype: WindowArchetype;
  floorCount: number;
  windowsPerFloor: number;
  windowWidth: number;
  windowHeight: number;
  windowDepth: number;
  frameWidth: number;
  sillDepth: number;
  pattern: 'grid' | 'horizontal' | 'vertical' | 'scattered';
  facadeEdgeOnly: boolean;
  jitterStrength: number;
  skipChance: number;
  topBlindFloors: number;
  serviceFloorStep: number;
  groundFloorRule: 'none' | 'sparse' | 'full';
}

/** 창문 geometry 최대 triangle 수. GLB 크기 제한 기반. */
const MAX_WINDOW_TRIANGLES = 420_000;

/** 창문 1개당 예상 triangle 수 (budget 계산용). */
const WINDOW_TRIANGLES_PER_EMIT_ESTIMATE = 2;

/** 층고 기본값 (m). 상업용 건물 기준. */
const DEFAULT_FLOOR_HEIGHT_M = 3.6;

/** LOD별 최대 표시 층 수. */
const LOD_FLOOR_LIMITS = { LOW: 4, MEDIUM: 6, HIGH: 9 } as const;

/** 창문 최소 높이 (m). */
const MIN_WINDOW_HEIGHT_M = 4;

/** 건물 높이 최소값 (m). shell builder와 공유. */
const MIN_BUILDING_HEIGHT_M = 4;

/** 창문 floor 시작 비율 (floor 높이의 25%). */
const FLOOR_START_RATIO = 0.25;

/** 창문 상단 마진 (m). */
const WINDOW_TOP_MARGIN_M = 0.25;

/** 창문 edge 길이 최소값 (m). */
const MIN_WINDOW_EDGE_LENGTH_M = 1e-6;

/** Office 창문 너비 (dense). */
const OFFICE_WINDOW_WIDTH_DENSE_M = 1.5;

/** Office 창문 너비 (medium). */
const OFFICE_WINDOW_WIDTH_MEDIUM_M = 1.4;

/** Office 창문 높이 (m). */
const OFFICE_WINDOW_HEIGHT_M = 2.1;

/** Office 창문 깊이 (dense, m). */
const OFFICE_WINDOW_DEPTH_DENSE_M = 0.17;

/** Office 창문 깊이 (medium, m). */
const OFFICE_WINDOW_DEPTH_MEDIUM_M = 0.16;

/** Office 서비스 층 간격. */
const OFFICE_SERVICE_FLOOR_STEP = 12;

/** Office top blind floors 임계 층 수. */
const OFFICE_TOP_BLIND_FLOOR_THRESHOLD = 14;

/** Apartment 창문 너비 (dense, m). */
const APARTMENT_WINDOW_WIDTH_DENSE_M = 1.08;

/** Apartment 창문 너비 (medium, m). */
const APARTMENT_WINDOW_WIDTH_MEDIUM_M = 0.98;

/** Apartment 창문 높이 (dense, m). */
const APARTMENT_WINDOW_HEIGHT_DENSE_M = 1.5;

/** Apartment 창문 높이 (medium, m). */
const APARTMENT_WINDOW_HEIGHT_MEDIUM_M = 1.42;

/** Apartment jitter strength (dense). */
const APARTMENT_JITTER_DENSE = 0.012;

/** Apartment jitter strength (medium). */
const APARTMENT_JITTER_MEDIUM = 0.016;

/** Apartment skip chance (dense). */
const APARTMENT_SKIP_CHANCE_DENSE = 0.01;

/** Apartment skip chance (medium). */
const APARTMENT_SKIP_CHANCE_MEDIUM = 0.02;

/** Apartment top blind floor 임계 층 수. */
const APARTMENT_TOP_BLIND_FLOOR_THRESHOLD = 12;

/** Retail 창문 너비 (m). */
const RETAIL_WINDOW_WIDTH_M = 1.95;

/** Retail 창문 높이 (dense, m). */
const RETAIL_WINDOW_HEIGHT_DENSE_M = 1.38;

/** Retail 창문 높이 (medium, m). */
const RETAIL_WINDOW_HEIGHT_MEDIUM_M = 1.26;

/** Retail 창문 sill 깊이 (m). */
const RETAIL_SILL_DEPTH_M = 0.14;

/** Retail jitter strength. */
const RETAIL_JITTER_STRENGTH = 0.008;

/** Retail skip chance (dense). */
const RETAIL_SKIP_CHANCE_DENSE = 0.008;

/** Retail skip chance (medium). */
const RETAIL_SKIP_CHANCE_MEDIUM = 0.015;

/** Retail floor 비율 (최대 40%). */
const RETAIL_FLOOR_RATIO = 0.4;

/** Retail 최대 층 수. */
const RETAIL_MAX_FLOORS = 3;

/** Retail 최소 층 수. */
const RETAIL_MIN_FLOORS = 1;

/** Hotel 창문 너비 (dense, m). */
const HOTEL_WINDOW_WIDTH_DENSE_M = 1.16;

/** Hotel 창문 너비 (medium, m). */
const HOTEL_WINDOW_WIDTH_MEDIUM_M = 1.1;

/** Hotel 창문 높이 (m). */
const HOTEL_WINDOW_HEIGHT_M = 1.6;

/** Hotel 창문 깊이 (m). */
const HOTEL_WINDOW_DEPTH_M = 0.16;

/** Hotel jitter strength. */
const HOTEL_JITTER_STRENGTH = 0.008;

/** Hotel skip chance. */
const HOTEL_SKIP_CHANCE = 0.01;

/** Hotel 서비스 층 간격. */
const HOTEL_SERVICE_FLOOR_STEP = 10;

/** Hotel top blind floor 임계 층 수. */
const HOTEL_TOP_BLIND_FLOOR_THRESHOLD = 16;

/** Industrial 창문 너비 (m). */
const INDUSTRIAL_WINDOW_WIDTH_M = 2.4;

/** Industrial 창문 높이 (dense, m). */
const INDUSTRIAL_WINDOW_HEIGHT_DENSE_M = 1.22;

/** Industrial 창문 높이 (medium, m). */
const INDUSTRIAL_WINDOW_HEIGHT_MEDIUM_M = 1.12;

/** Industrial 창문 깊이 (m). */
const INDUSTRIAL_WINDOW_DEPTH_M = 0.14;

/** Industrial jitter strength. */
const INDUSTRIAL_JITTER_STRENGTH = 0.005;

/** Industrial skip chance. */
const INDUSTRIAL_SKIP_CHANCE = 0.03;

/** Industrial floor 비율 (최대 40%). */
const INDUSTRIAL_FLOOR_RATIO = 0.4;

/** Industrial 최대 층 수. */
const INDUSTRIAL_MAX_FLOORS = 3;

/** Industrial 최소 층 수. */
const INDUSTRIAL_MIN_FLOORS = 1;

/** 기본 jitter strength. */
const DEFAULT_JITTER_STRENGTH = 0.01;

/** 기본 skip chance. */
const DEFAULT_SKIP_CHANCE = 0.015;

/** Retail ground floor 창문 너비 배율. */
const RETAIL_GROUND_FLOOR_WIDTH_SCALE = 1.28;

/** Retail ground floor 창문 높이 배율. */
const RETAIL_GROUND_FLOOR_HEIGHT_SCALE = 1.35;

/** Retail ground floor 창문 높이 비율 (floor 높이의 68%). */
const RETAIL_GROUND_FLOOR_HEIGHT_RATIO = 0.68;

/** Retail ground floor yOffset 비율 (floor 높이의 8%). */
const RETAIL_GROUND_FLOOR_Y_OFFSET_RATIO = 0.08;

/** Industrial 창문 너비 배율. */
const INDUSTRIAL_WINDOW_WIDTH_SCALE = 1.2;

/** Industrial 창문 높이 배율. */
const INDUSTRIAL_WINDOW_HEIGHT_SCALE = 0.84;

/** Industrial yOffset 비율 (floor 높이의 18%). */
const INDUSTRIAL_Y_OFFSET_RATIO = 0.18;

/** Apartment ground floor 창문 높이 배율. */
const APARTMENT_GROUND_FLOOR_HEIGHT_SCALE = 0.9;

/** Apartment ground floor yOffset 비율 (floor 높이의 4%). */
const APARTMENT_GROUND_FLOOR_Y_OFFSET_RATIO = 0.04;

/** Fallback hint glazing ratio. */
const FALLBACK_GLAZING_RATIO = 0.28;

/** Hash 초기값 (FNV-1a). */
const FNV1A_HASH_INIT = 2166136261;

/** Hash 곱셈 상수 (FNV-1a). */
const FNV1A_HASH_MULTIPLIER = 16777619;

/** Hash 나눗셈 상수 (2^32). */
const FNV1A_HASH_DIVISOR = 4294967295;

/** MurmurHash3-style numeric seed multiplier. */
const NUMERIC_HASH_MULTIPLIER_1 = 2654435761;

/** MurmurHash3-style mix constant. */
const NUMERIC_HASH_MIX_1 = 2246822519;

/** MurmurHash3-style mix constant. */
const NUMERIC_HASH_MIX_2 = 3266489917;

type WindowArchetype =
  | 'apartment'
  | 'office'
  | 'retail'
  | 'hotel'
  | 'industrial';

function resolveWindowConfig(
  building: SceneMeta['buildings'][number],
  hint: SceneFacadeHint,
  lodLevel: 'HIGH' | 'MEDIUM' | 'LOW',
): WindowConfig {
  const archetype = resolveWindowArchetype(building, hint);
  const density = hint.windowPatternDensity ?? 'medium';
  const height = Math.max(4, building.heightMeters);

  const floorHeight = DEFAULT_FLOOR_HEIGHT_M;
  const rawFloorCount = Math.max(MIN_BUILDING_HEIGHT_M, Math.floor(height / floorHeight));
  const floorLimit = lodLevel === 'LOW' ? LOD_FLOOR_LIMITS.LOW : lodLevel === 'MEDIUM' ? LOD_FLOOR_LIMITS.MEDIUM : LOD_FLOOR_LIMITS.HIGH;
  const floorCount = Math.min(rawFloorCount, floorLimit);

  const baseConfig: WindowConfig = {
    archetype,
    floorCount,
    windowsPerFloor: 3,
    windowWidth: 1.2,
    windowHeight: 1.8,
    windowDepth: 0.15,
    frameWidth: 0.08,
    sillDepth: 0.12,
    pattern: 'grid',
    facadeEdgeOnly: false,
    jitterStrength: 0.006,
    skipChance: 0,
    topBlindFloors: 0,
    serviceFloorStep: 0,
    groundFloorRule: 'full',
  };

  switch (archetype) {
    case 'office':
      return {
        ...baseConfig,
        windowsPerFloor: density === 'dense' ? 4 : density === 'medium' ? 4 : 3,
        windowWidth: density === 'dense' ? OFFICE_WINDOW_WIDTH_DENSE_M : OFFICE_WINDOW_WIDTH_MEDIUM_M,
        windowHeight: OFFICE_WINDOW_HEIGHT_M,
        windowDepth: density === 'dense' ? OFFICE_WINDOW_DEPTH_DENSE_M : OFFICE_WINDOW_DEPTH_MEDIUM_M,
        pattern: 'grid',
        topBlindFloors: floorCount >= OFFICE_TOP_BLIND_FLOOR_THRESHOLD ? 1 : 0,
        serviceFloorStep: OFFICE_SERVICE_FLOOR_STEP,
        groundFloorRule: 'sparse',
      };
    case 'apartment':
      return {
        ...baseConfig,
        windowsPerFloor: density === 'dense' ? 3 : density === 'medium' ? 3 : 2,
        windowWidth: density === 'dense' ? APARTMENT_WINDOW_WIDTH_DENSE_M : APARTMENT_WINDOW_WIDTH_MEDIUM_M,
        windowHeight: density === 'dense' ? APARTMENT_WINDOW_HEIGHT_DENSE_M : APARTMENT_WINDOW_HEIGHT_MEDIUM_M,
        pattern: 'grid',
        jitterStrength: density === 'dense' ? APARTMENT_JITTER_DENSE : APARTMENT_JITTER_MEDIUM,
        skipChance: density === 'dense' ? APARTMENT_SKIP_CHANCE_DENSE : APARTMENT_SKIP_CHANCE_MEDIUM,
        topBlindFloors: floorCount >= APARTMENT_TOP_BLIND_FLOOR_THRESHOLD ? 1 : 0,
        groundFloorRule: 'sparse',
      };
    case 'retail':
      return {
        ...baseConfig,
        floorCount: Math.max(RETAIL_MIN_FLOORS, Math.min(RETAIL_MAX_FLOORS, Math.floor(floorCount * RETAIL_FLOOR_RATIO))),
        windowsPerFloor: density === 'dense' ? 3 : density === 'medium' ? 2 : 1,
        windowWidth: RETAIL_WINDOW_WIDTH_M,
        windowHeight: density === 'dense' ? RETAIL_WINDOW_HEIGHT_DENSE_M : RETAIL_WINDOW_HEIGHT_MEDIUM_M,
        sillDepth: RETAIL_SILL_DEPTH_M,
        pattern: 'horizontal',
        facadeEdgeOnly: false,
        jitterStrength: RETAIL_JITTER_STRENGTH,
        skipChance: density === 'dense' ? RETAIL_SKIP_CHANCE_DENSE : RETAIL_SKIP_CHANCE_MEDIUM,
        topBlindFloors: 0,
        groundFloorRule: 'full',
      };
    case 'hotel':
      return {
        ...baseConfig,
        windowsPerFloor: density === 'dense' ? 5 : density === 'medium' ? 4 : 3,
        windowWidth: density === 'dense' ? HOTEL_WINDOW_WIDTH_DENSE_M : HOTEL_WINDOW_WIDTH_MEDIUM_M,
        windowHeight: HOTEL_WINDOW_HEIGHT_M,
        windowDepth: HOTEL_WINDOW_DEPTH_M,
        pattern: 'grid',
        jitterStrength: HOTEL_JITTER_STRENGTH,
        skipChance: HOTEL_SKIP_CHANCE,
        topBlindFloors: floorCount >= HOTEL_TOP_BLIND_FLOOR_THRESHOLD ? 1 : 0,
        serviceFloorStep: HOTEL_SERVICE_FLOOR_STEP,
        groundFloorRule: 'sparse',
      };
    case 'industrial':
      return {
        ...baseConfig,
        floorCount: Math.max(INDUSTRIAL_MIN_FLOORS, Math.min(INDUSTRIAL_MAX_FLOORS, Math.floor(floorCount * INDUSTRIAL_FLOOR_RATIO))),
        windowsPerFloor: density === 'dense' ? 3 : density === 'medium' ? 2 : 1,
        windowWidth: INDUSTRIAL_WINDOW_WIDTH_M,
        windowHeight: density === 'dense' ? INDUSTRIAL_WINDOW_HEIGHT_DENSE_M : INDUSTRIAL_WINDOW_HEIGHT_MEDIUM_M,
        windowDepth: INDUSTRIAL_WINDOW_DEPTH_M,
        pattern: 'horizontal',
        facadeEdgeOnly: false,
        jitterStrength: INDUSTRIAL_JITTER_STRENGTH,
        skipChance: INDUSTRIAL_SKIP_CHANCE,
        topBlindFloors: 0,
        groundFloorRule: 'none',
      };
    default:
      return {
        ...baseConfig,
        pattern: 'grid',
        jitterStrength: DEFAULT_JITTER_STRENGTH,
        skipChance: DEFAULT_SKIP_CHANCE,
      };
  }
}

function resolveWindowEdgeIndices(
  outerRing: Vec3[],
  hint: SceneFacadeHint,
  lodLevel: 'HIGH' | 'MEDIUM' | 'LOW',
): number[] {
  if (hint.facadeEdgeIndex !== null && hint.facadeEdgeIndex !== undefined) {
    const normalized = normalizeEdgeIndex(
      hint.facadeEdgeIndex,
      outerRing.length,
    );
    if (normalized !== null) {
      return [normalized];
    }
  }

  const edgeIndices = Array.from(
    { length: outerRing.length },
    (_, index) => index,
  );
  if (lodLevel === 'HIGH') {
    return edgeIndices;
  }

  if (lodLevel === 'MEDIUM') {
    return edgeIndices.filter((_, index) => index % 2 === 0);
  }

  const longest = edgeIndices
    .map((index) => ({
      index,
      length: edgeLengthAt(outerRing, index),
    }))
    .sort((a, b) => b.length - a.length)
    .slice(0, 1)
    .map((item) => item.index);

  return longest;
}

function normalizeEdgeIndex(index: number, ringLength: number): number | null {
  if (!Number.isFinite(index) || ringLength <= 0) {
    return null;
  }
  const normalized = Math.trunc(index) % ringLength;
  return normalized >= 0 ? normalized : normalized + ringLength;
}

function edgeLengthAt(ring: Vec3[], edgeIndex: number): number {
  if (ring.length === 0) {
    return 0;
  }
  const a = ring[edgeIndex % ring.length];
  const b = ring[(edgeIndex + 1) % ring.length];
  if (!a || !b) return 0;
  return Math.hypot(b[0] - a[0], b[2] - a[2]);
}

function resolveWindowArchetype(
  building: SceneMeta['buildings'][number],
  hint: SceneFacadeHint,
): WindowArchetype {
  const archetype = (building.visualArchetype ??
    hint.visualArchetype ??
    'commercial_midrise') as string;
  if (archetype === 'apartment_block' || archetype === 'house_compact') {
    return 'apartment';
  }
  if (archetype === 'hotel_tower') {
    return 'hotel';
  }
  if (archetype === 'lowrise_shop' || archetype === 'mall_podium') {
    return 'retail';
  }
  if (archetype === 'station_like') {
    return 'industrial';
  }
  if (archetype === 'highrise_office' || archetype === 'commercial_midrise') {
    return 'office';
  }

  if (hint.facadePreset === 'station_metal') {
    return 'industrial';
  }
  if (
    hint.facadePreset === 'retail_sign_band' ||
    hint.facadePreset === 'mall_panel'
  ) {
    return 'retail';
  }
  if (hint.materialClass === 'metal') {
    return 'industrial';
  }

  return 'office';
}

function pushWindowGrid(
  geometry: GeometryBuffers,
  frame: FacadeFrame,
  config: WindowConfig,
  buildingHeight: number,
  budget: { remainingTriangles: number },
): void {
  const edgeLength = Math.hypot(
    frame.b[0] - frame.a[0],
    frame.b[2] - frame.a[2],
  );
  if (edgeLength <= MIN_WINDOW_EDGE_LENGTH_M) {
    return;
  }

  const floorHeight = buildingHeight / Math.max(1, config.floorCount);

  for (let floor = 0; floor < config.floorCount; floor += 1) {
    const floorY = floor * floorHeight + floorHeight * FLOOR_START_RATIO;
    const floorTopY = floorY + config.windowHeight;

    if (floorTopY > buildingHeight - WINDOW_TOP_MARGIN_M) {
      continue;
    }

    if (floor >= config.floorCount - config.topBlindFloors) {
      continue;
    }

    for (let col = 0; col < config.windowsPerFloor; col += 1) {
      if (budget.remainingTriangles < WINDOW_TRIANGLES_PER_EMIT_ESTIMATE) {
        return;
      }
      if (config.facadeEdgeOnly && col > 0) {
        continue;
      }
      const seed = numericWindowSeed(frame.a[0], frame.a[2], floor, col, config.pattern);
      const randomBase = stableUnitNoiseNumeric(seed);
      if (!shouldEmitWindow(config, floor, col, randomBase)) {
        continue;
      }
      const floorSpec = resolveFloorWindowSpec(config, floor, floorHeight);
      const tBase = (col + 0.5) / config.windowsPerFloor;
      const t = clamp01(tBase + (randomBase - 0.5) * config.jitterStrength);
      const centerX = frame.a[0] + (frame.b[0] - frame.a[0]) * t;
      const centerZ = frame.a[2] + (frame.b[2] - frame.a[2]) * t;
      const sizeScale =
        0.96 + stableUnitNoiseNumeric(numericWindowSeed(frame.a[0], frame.a[2], floor, col, 'size')) * 0.08;

      pushWindowFrame(
        geometry,
        frame,
        centerX,
        centerZ,
        floorY + floorSpec.yOffset,
        floorSpec.windowWidth * sizeScale,
        floorSpec.windowHeight * sizeScale,
        config.frameWidth,
        config.sillDepth,
      );
      budget.remainingTriangles = Math.max(
        0,
        budget.remainingTriangles - WINDOW_TRIANGLES_PER_EMIT_ESTIMATE,
      );
    }
  }
}

function shouldEmitWindow(
  config: WindowConfig,
  floor: number,
  col: number,
  randomBase: number,
): boolean {
  if (config.groundFloorRule === 'none' && floor === 0) {
    return false;
  }
  if (config.groundFloorRule === 'sparse' && floor === 0 && col % 2 === 1) {
    return false;
  }
  if (
    config.serviceFloorStep > 0 &&
    floor > 0 &&
    floor % config.serviceFloorStep === 0
  ) {
    if (config.archetype === 'office') {
      return col % 3 !== 1;
    }
    if (config.archetype === 'hotel') {
      return col % 4 !== 0;
    }
  }
  if (config.archetype === 'apartment' && floor % 2 === 1 && col % 5 === 0) {
    return false;
  }
  if (config.archetype === 'industrial' && floor > 0 && col % 3 === 2) {
    return false;
  }
  if (config.skipChance > 0 && randomBase < config.skipChance) {
    return false;
  }
  return true;
}

function resolveFloorWindowSpec(
  config: WindowConfig,
  floor: number,
  floorHeight: number,
): { windowWidth: number; windowHeight: number; yOffset: number } {
  if (config.archetype === 'retail' && floor === 0) {
    return {
      windowWidth: config.windowWidth * RETAIL_GROUND_FLOOR_WIDTH_SCALE,
      windowHeight: Math.max(config.windowHeight * RETAIL_GROUND_FLOOR_HEIGHT_SCALE, floorHeight * RETAIL_GROUND_FLOOR_HEIGHT_RATIO),
      yOffset: floorHeight * RETAIL_GROUND_FLOOR_Y_OFFSET_RATIO,
    };
  }
  if (config.archetype === 'industrial') {
    return {
      windowWidth: config.windowWidth * INDUSTRIAL_WINDOW_WIDTH_SCALE,
      windowHeight: config.windowHeight * INDUSTRIAL_WINDOW_HEIGHT_SCALE,
      yOffset: floorHeight * INDUSTRIAL_Y_OFFSET_RATIO,
    };
  }
  if (config.archetype === 'apartment' && floor === 0) {
    return {
      windowWidth: config.windowWidth,
      windowHeight: config.windowHeight * APARTMENT_GROUND_FLOOR_HEIGHT_SCALE,
      yOffset: floorHeight * APARTMENT_GROUND_FLOOR_Y_OFFSET_RATIO,
    };
  }

  return {
    windowWidth: config.windowWidth,
    windowHeight: config.windowHeight,
    yOffset: 0,
  };
}

function stableUnitNoise(seed: string): number {
  let hash = FNV1A_HASH_INIT;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, FNV1A_HASH_MULTIPLIER);
  }
  return (hash >>> 0) / FNV1A_HASH_DIVISOR;
}

function stableUnitNoiseNumeric(seed: number): number {
  let hash = Math.imul(seed, NUMERIC_HASH_MULTIPLIER_1);
  hash = Math.imul(hash ^ (hash >>> 16), NUMERIC_HASH_MIX_1);
  hash = Math.imul(hash ^ (hash >>> 13), NUMERIC_HASH_MIX_2);
  return (hash >>> 0) / FNV1A_HASH_DIVISOR;
}

function numericWindowSeed(
  ax: number,
  az: number,
  floor: number,
  col: number,
  pattern: string,
): number {
  const patternHash = stableUnitNoise(pattern);
  const axBits = Math.trunc(ax * 100) & 0xffff;
  const azBits = Math.trunc(az * 100) & 0xffff;
  return (axBits << 24) | (azBits << 16) | ((floor & 0xff) << 8) | ((col & 0xff) << 4) | Math.trunc(patternHash * 0xf);
}

function buildFallbackFacadeHint(seedHint?: SceneFacadeHint): SceneFacadeHint {
  return {
    objectId: '__fallback__',
    anchor: { lat: 0, lng: 0 },
    facadeEdgeIndex: null,
    windowBands: 0,
    billboardEligible: false,
    palette: seedHint?.palette ?? ['#b0b4bc'],
    materialClass: seedHint?.materialClass ?? 'mixed',
    signageDensity: seedHint?.signageDensity ?? 'low',
    emissiveStrength: seedHint?.emissiveStrength ?? 0,
    glazingRatio: seedHint?.glazingRatio ?? FALLBACK_GLAZING_RATIO,
    visualArchetype: seedHint?.visualArchetype,
    geometryStrategy: seedHint?.geometryStrategy,
    facadePreset: seedHint?.facadePreset,
    podiumLevels: seedHint?.podiumLevels,
    setbackLevels: seedHint?.setbackLevels,
    cornerChamfer: seedHint?.cornerChamfer,
    roofAccentType: seedHint?.roofAccentType,
    windowPatternDensity: seedHint?.windowPatternDensity ?? 'medium',
    signBandLevels: seedHint?.signBandLevels,
    shellPalette: seedHint?.shellPalette,
    panelPalette: seedHint?.panelPalette,
    mainColor: seedHint?.mainColor,
    accentColor: seedHint?.accentColor,
    trimColor: seedHint?.trimColor,
    roofColor: seedHint?.roofColor,
    weakEvidence: true,
    contextProfile: seedHint?.contextProfile,
    districtCluster: seedHint?.districtCluster,
    districtConfidence: seedHint?.districtConfidence,
    evidenceStrength: seedHint?.evidenceStrength,
    contextualMaterialUpgrade: seedHint?.contextualMaterialUpgrade,
    visualRole: seedHint?.visualRole,
    baseMass: seedHint?.baseMass,
    facadeSpec: seedHint?.facadeSpec,
    podiumSpec: seedHint?.podiumSpec,
    signageSpec: seedHint?.signageSpec,
    roofSpec: seedHint?.roofSpec,
  };
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function pushWindowFrame(
  geometry: GeometryBuffers,
  frame: FacadeFrame,
  centerX: number,
  centerZ: number,
  floorY: number,
  windowWidth: number,
  windowHeight: number,
  frameWidth: number,
  sillDepth: number,
): void {
  const edgeDx = frame.b[0] - frame.a[0];
  const edgeDz = frame.b[2] - frame.a[2];
  const edgeLength = Math.hypot(edgeDx, edgeDz);
  if (edgeLength <= MIN_WINDOW_EDGE_LENGTH_M) {
    return;
  }

  const tangent: Vec3 = [edgeDx / edgeLength, 0, edgeDz / edgeLength];
  const halfWidth = windowWidth / 2;

  const leftX = centerX - tangent[0] * halfWidth;
  const leftZ = centerZ - tangent[2] * halfWidth;
  const rightX = centerX + tangent[0] * halfWidth;
  const rightZ = centerZ + tangent[2] * halfWidth;

  const frontOffset = FACADE_FRAME_OFFSET_FROM_SHELL + WINDOW_OFFSET_FROM_PANEL;
  const frontLeftX = leftX + frame.normal[0] * frontOffset;
  const frontLeftZ = leftZ + frame.normal[2] * frontOffset;
  const frontRightX = rightX + frame.normal[0] * frontOffset;
  const frontRightZ = rightZ + frame.normal[2] * frontOffset;

  const y0 = floorY;
  const y1 = floorY + windowHeight;

  pushQuad(
    geometry,
    [frontLeftX, y0, frontLeftZ],
    [frontRightX, y0, frontRightZ],
    [frontRightX, y1, frontRightZ],
    [frontLeftX, y1, frontLeftZ],
  );

  void frameWidth;
  void sillDepth;
}
