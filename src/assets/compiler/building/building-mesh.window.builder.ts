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
    const height = Math.max(4, building.heightMeters);
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

const MAX_WINDOW_TRIANGLES = 900_000;
const WINDOW_TRIANGLES_PER_EMIT_ESTIMATE = 8;

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

  const floorHeight = 3.6;
  const rawFloorCount = Math.max(2, Math.floor(height / floorHeight));
  const floorLimit = lodLevel === 'LOW' ? 6 : lodLevel === 'MEDIUM' ? 12 : 18;
  const floorCount = Math.min(rawFloorCount, floorLimit);

  const baseConfig: WindowConfig = {
    archetype,
    floorCount,
    windowsPerFloor: 4,
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
        windowsPerFloor: density === 'dense' ? 6 : density === 'medium' ? 5 : 4,
        windowWidth: density === 'dense' ? 1.5 : 1.4,
        windowHeight: 2.1,
        windowDepth: density === 'dense' ? 0.17 : 0.16,
        pattern: 'grid',
        topBlindFloors: floorCount >= 14 ? 1 : 0,
        serviceFloorStep: 12,
        groundFloorRule: 'sparse',
      };
    case 'apartment':
      return {
        ...baseConfig,
        windowsPerFloor: density === 'dense' ? 5 : density === 'medium' ? 4 : 3,
        windowWidth: density === 'dense' ? 1.08 : 0.98,
        windowHeight: density === 'dense' ? 1.5 : 1.42,
        pattern: 'grid',
        jitterStrength: density === 'dense' ? 0.012 : 0.016,
        skipChance: density === 'dense' ? 0.01 : 0.02,
        topBlindFloors: floorCount >= 12 ? 1 : 0,
        groundFloorRule: 'sparse',
      };
    case 'retail':
      return {
        ...baseConfig,
        floorCount: Math.max(1, Math.min(4, Math.floor(floorCount * 0.45))),
        windowsPerFloor: density === 'dense' ? 4 : density === 'medium' ? 3 : 2,
        windowWidth: 1.95,
        windowHeight: density === 'dense' ? 1.38 : 1.26,
        sillDepth: 0.14,
        pattern: 'horizontal',
        facadeEdgeOnly: false,
        jitterStrength: 0.008,
        skipChance: density === 'dense' ? 0.008 : 0.015,
        topBlindFloors: 0,
        groundFloorRule: 'full',
      };
    case 'hotel':
      return {
        ...baseConfig,
        windowsPerFloor: density === 'dense' ? 7 : density === 'medium' ? 6 : 5,
        windowWidth: density === 'dense' ? 1.16 : 1.1,
        windowHeight: 1.6,
        windowDepth: 0.16,
        pattern: 'grid',
        jitterStrength: 0.008,
        skipChance: 0.01,
        topBlindFloors: floorCount >= 16 ? 1 : 0,
        serviceFloorStep: 10,
        groundFloorRule: 'sparse',
      };
    case 'industrial':
      return {
        ...baseConfig,
        floorCount: Math.max(1, Math.min(4, Math.floor(floorCount * 0.5))),
        windowsPerFloor: density === 'dense' ? 4 : density === 'medium' ? 3 : 2,
        windowWidth: 2.4,
        windowHeight: density === 'dense' ? 1.22 : 1.12,
        windowDepth: 0.14,
        pattern: 'horizontal',
        facadeEdgeOnly: false,
        jitterStrength: 0.005,
        skipChance: 0.03,
        topBlindFloors: 0,
        groundFloorRule: 'none',
      };
    default:
      return {
        ...baseConfig,
        pattern: 'grid',
        jitterStrength: 0.01,
        skipChance: 0.015,
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
  if (edgeLength <= 1e-6) {
    return;
  }

  const floorHeight = buildingHeight / Math.max(1, config.floorCount);

  for (let floor = 0; floor < config.floorCount; floor += 1) {
    const floorY = floor * floorHeight + floorHeight * 0.28;
    const floorTopY = floorY + config.windowHeight;

    if (floorTopY > buildingHeight - 0.5) {
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
      const randomBase = stableUnitNoise(
        `${frame.a[0].toFixed(2)}:${frame.a[2].toFixed(2)}:${floor}:${col}:${config.pattern}`,
      );
      if (!shouldEmitWindow(config, floor, col, randomBase)) {
        continue;
      }
      const floorSpec = resolveFloorWindowSpec(config, floor, floorHeight);
      const tBase = (col + 0.5) / config.windowsPerFloor;
      const t = clamp01(tBase + (randomBase - 0.5) * config.jitterStrength);
      const centerX = frame.a[0] + (frame.b[0] - frame.a[0]) * t;
      const centerZ = frame.a[2] + (frame.b[2] - frame.a[2]) * t;
      const sizeScale =
        0.96 +
        stableUnitNoise(`${floor}:${col}:${config.windowsPerFloor}`) * 0.08;

      pushWindowFrame(
        geometry,
        frame,
        centerX,
        centerZ,
        floorY + floorSpec.yOffset,
        floorSpec.windowWidth * sizeScale,
        floorSpec.windowHeight * sizeScale,
        config.windowDepth,
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
      windowWidth: config.windowWidth * 1.28,
      windowHeight: Math.max(config.windowHeight * 1.35, floorHeight * 0.68),
      yOffset: floorHeight * 0.08,
    };
  }
  if (config.archetype === 'industrial') {
    return {
      windowWidth: config.windowWidth * 1.2,
      windowHeight: config.windowHeight * 0.84,
      yOffset: floorHeight * 0.18,
    };
  }
  if (config.archetype === 'apartment' && floor === 0) {
    return {
      windowWidth: config.windowWidth,
      windowHeight: config.windowHeight * 0.9,
      yOffset: floorHeight * 0.04,
    };
  }

  return {
    windowWidth: config.windowWidth,
    windowHeight: config.windowHeight,
    yOffset: 0,
  };
}

function stableUnitNoise(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
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
    glazingRatio: seedHint?.glazingRatio ?? 0.28,
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
  windowDepth: number,
  frameWidth: number,
  sillDepth: number,
): void {
  const edgeDx = frame.b[0] - frame.a[0];
  const edgeDz = frame.b[2] - frame.a[2];
  const edgeLength = Math.hypot(edgeDx, edgeDz);
  if (edgeLength <= 1e-6) {
    return;
  }

  const tangent: Vec3 = [edgeDx / edgeLength, 0, edgeDz / edgeLength];
  const halfWidth = windowWidth / 2;

  const leftX = centerX - tangent[0] * halfWidth;
  const leftZ = centerZ - tangent[2] * halfWidth;
  const rightX = centerX + tangent[0] * halfWidth;
  const rightZ = centerZ + tangent[2] * halfWidth;

  const frontOffset = 0.02;
  const frontLeftX = leftX + frame.normal[0] * frontOffset;
  const frontLeftZ = leftZ + frame.normal[2] * frontOffset;
  const frontRightX = rightX + frame.normal[0] * frontOffset;
  const frontRightZ = rightZ + frame.normal[2] * frontOffset;

  const frameDepth = Math.max(0.05, Math.min(windowDepth, 0.12));

  const y0 = floorY;
  const y1 = floorY + windowHeight;

  pushQuad(
    geometry,
    [frontLeftX, y0, frontLeftZ],
    [frontRightX, y0, frontRightZ],
    [frontRightX, y1, frontRightZ],
    [frontLeftX, y1, frontLeftZ],
  );

  const frameHalfWidth = frameWidth / 2;
  pushWindowFrameEdge(
    geometry,
    frame,
    leftX,
    leftZ,
    y0,
    y1,
    frameDepth,
    frameHalfWidth,
  );
  pushWindowFrameEdge(
    geometry,
    frame,
    rightX,
    rightZ,
    y0,
    y1,
    frameDepth,
    frameHalfWidth,
  );
  pushWindowSill(geometry, frame, centerX, centerZ, y0, windowWidth, sillDepth);
}

function pushWindowFrameEdge(
  geometry: GeometryBuffers,
  frame: FacadeFrame,
  x: number,
  z: number,
  y0: number,
  y1: number,
  depth: number,
  halfWidth: number,
): void {
  const frontX = x + frame.normal[0] * 0.02;
  const frontZ = z + frame.normal[2] * 0.02;
  const backX = x - frame.normal[0] * depth;
  const backZ = z - frame.normal[2] * depth;

  pushQuad(
    geometry,
    [
      frontX - frame.normal[0] * halfWidth,
      y0,
      frontZ - frame.normal[2] * halfWidth,
    ],
    [
      backX - frame.normal[0] * halfWidth,
      y0,
      backZ - frame.normal[2] * halfWidth,
    ],
    [
      backX - frame.normal[0] * halfWidth,
      y1,
      backZ - frame.normal[2] * halfWidth,
    ],
    [
      frontX - frame.normal[0] * halfWidth,
      y1,
      frontZ - frame.normal[2] * halfWidth,
    ],
  );
}

function pushWindowSill(
  geometry: GeometryBuffers,
  frame: FacadeFrame,
  centerX: number,
  centerZ: number,
  y: number,
  windowWidth: number,
  sillDepth: number,
): void {
  const sillHeight = 0.06;
  const sillWidth = windowWidth + 0.1;
  const halfWidth = sillWidth / 2;

  const frontX = centerX + frame.normal[0] * sillDepth;
  const frontZ = centerZ + frame.normal[2] * sillDepth;
  pushQuad(
    geometry,
    [frontX - halfWidth, y - sillHeight, frontZ - halfWidth * 0.3],
    [frontX + halfWidth, y - sillHeight, frontZ + halfWidth * 0.3],
    [frontX + halfWidth, y - sillHeight * 0.4, frontZ + halfWidth * 0.3],
    [frontX - halfWidth, y - sillHeight * 0.4, frontZ - halfWidth * 0.3],
  );
}
