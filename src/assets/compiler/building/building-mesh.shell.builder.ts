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

const MIN_FOUNDATION_DEPTH = 0.4;
const MAX_FOUNDATION_DEPTH = 1.1;
const SETBACK_OVERLAP = 0.05;
const MIN_SETBACK_RING_AREA_M2 = 0.5;
const FOUNDATION_TERRAIN_SCALE = 0.3;
const MAX_FOUNDATION_TERRAIN_OFFSET = 0.5;

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
        const nextRing = insetRing(currentRing, 0.12 + stage * 0.04);
        if (nextRing.length < 3) {
          metrics.invalidSetbackJoinCount += 1;
          break;
        }
        const ringArea = computeRingAreaM2(nextRing);
        if (ringArea < MIN_SETBACK_RING_AREA_M2) {
          metrics.invalidSetbackJoinCount += 1;
          break;
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
    0,
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
): void {
  const triangulated = triangulateRings(outerRing, holes, triangulate);
  if (triangulated.length === 0) {
    // Fallback: generate bounding box to ensure building has some geometry
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
  const height = Math.max(4, building.heightMeters);
  const lodLevel = (building as { lodLevel?: string }).lodLevel ?? 'HIGH';

  const simplifiedRing =
    lodLevel === 'LOW'
      ? simplifyRing(outerRing, 1.5)
      : lodLevel === 'MEDIUM'
        ? simplifyRing(outerRing, 0.8)
        : outerRing;
  const simplifiedHoles = lodLevel === 'LOW' ? [] : holes;

  switch (strategy) {
    case 'podium_tower': {
      const podiumHeight = Math.min(
        height * 0.52,
        Math.max(6, (building.podiumLevels ?? 2) * 4),
      );
      pushExtrudedPolygon(
        geometry,
        simplifiedRing,
        simplifiedHoles,
        baseY - foundationDepth,
        baseY + podiumHeight,
        triangulate,
      );
      if (lodLevel === 'HIGH') {
        const insetRatio = building.cornerChamfer ? 0.2 : 0.14;
        const towerRing = insetRing(simplifiedRing, insetRatio);
        if (towerRing.length >= 3) {
          const towerTop = Math.max(podiumHeight + 4, height);
          pushExtrudedPolygon(
            geometry,
            towerRing,
            [],
            baseY + podiumHeight - SETBACK_OVERLAP,
            baseY + towerTop,
            triangulate,
          );
        }
      }
      break;
    }
    case 'stepped_tower': {
      const baseTop = Math.max(8, height * 0.58);
      pushExtrudedPolygon(
        geometry,
        simplifiedRing,
        simplifiedHoles,
        baseY - foundationDepth,
        baseY + baseTop,
        triangulate,
      );
      if (lodLevel === 'HIGH') {
        let currentRing = simplifiedRing;
        const stageCount = Math.max(
          2,
          Math.min(3, building.setbackLevels ?? 2),
        );
        for (let stage = 0; stage < stageCount; stage += 1) {
          currentRing = insetRing(currentRing, 0.12 + stage * 0.04);
          if (currentRing.length < 3) {
            break;
          }
          const stageMin =
            stage === 0
              ? baseTop - SETBACK_OVERLAP
              : baseTop +
                stage * ((height - baseTop) / stageCount) -
                SETBACK_OVERLAP;
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
          );
        }
      }
      break;
    }
    case 'gable_lowrise': {
      const roofBaseHeight = Math.max(3.2, height * 0.72);
      pushExtrudedPolygon(
        geometry,
        simplifiedRing,
        simplifiedHoles,
        baseY - foundationDepth,
        baseY + roofBaseHeight,
        triangulate,
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
      const roofBaseHeight = Math.max(3.2, height * 0.72);
      pushExtrudedPolygon(
        geometry,
        simplifiedRing,
        simplifiedHoles,
        baseY - foundationDepth,
        baseY + roofBaseHeight,
        triangulate,
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
      const roofBaseHeight = Math.max(3.2, height * 0.72);
      pushExtrudedPolygon(
        geometry,
        simplifiedRing,
        simplifiedHoles,
        baseY - foundationDepth,
        baseY + roofBaseHeight,
        triangulate,
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
  const height = Math.max(6, building.heightMeters);
  const baseY = resolveBuildingVerticalBase(building);
  const baseMass = building.baseMass ?? 'podium_tower';
  const podiumLevels =
    building.podiumSpec?.levels ?? building.podiumLevels ?? 2;
  const setbacks = building.podiumSpec?.setbacks ?? building.setbackLevels ?? 1;
  const podiumHeight = Math.min(
    height * 0.45,
    Math.max(5.5, podiumLevels * 3.8),
  );

  if (baseMass === 'lowrise_strip') {
    pushExtrudedPolygon(
      geometry,
      outerRing,
      holes,
      baseY - foundationDepth,
      baseY + height,
      triangulate,
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
  );

  let currentRing = outerRing;
  const stageCount =
    baseMass === 'stepped_tower' || baseMass === 'corner_tower'
      ? Math.max(2, setbacks || 2)
      : 1;
  for (let stage = 0; stage < stageCount; stage += 1) {
    const insetRatio =
      baseMass === 'corner_tower'
        ? 0.18 + stage * 0.05
        : baseMass === 'slab_midrise'
          ? 0.08 + stage * 0.03
          : 0.12 + stage * 0.04;
    currentRing = insetRing(currentRing, insetRatio);
    if (currentRing.length < 3) {
      break;
    }
    const stageMin =
      stage === 0
        ? podiumHeight - SETBACK_OVERLAP
        : podiumHeight +
          stage * ((height - podiumHeight) / stageCount) -
          SETBACK_OVERLAP;
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
    );
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
  const base = MIN_FOUNDATION_DEPTH + groundOffset + terrainAdjustment;
  return Math.min(MAX_FOUNDATION_DEPTH, Number(base.toFixed(3)));
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

function pushGableRoof(
  geometry: GeometryBuffers,
  outerRing: Vec3[],
  roofBaseHeight: number,
  topHeight: number,
): void {
  const bounds = computeBounds(outerRing);
  const ridgeAlongX = bounds.width >= bounds.depth;
  const ridgeHeight = Math.max(topHeight, roofBaseHeight + 1.1);
  const ridgeA: Vec3 = ridgeAlongX
    ? [bounds.minX, ridgeHeight, (bounds.minZ + bounds.maxZ) / 2]
    : [(bounds.minX + bounds.maxX) / 2, ridgeHeight, bounds.minZ];
  const ridgeB: Vec3 = ridgeAlongX
    ? [bounds.maxX, ridgeHeight, (bounds.minZ + bounds.maxZ) / 2]
    : [(bounds.minX + bounds.maxX) / 2, ridgeHeight, bounds.maxZ];

  for (let index = 0; index < outerRing.length; index += 1) {
    const current = outerRing[index];
    const next = outerRing[(index + 1) % outerRing.length];
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
  const ridgeHeight = Math.max(topHeight, roofBaseHeight + 1.1);
  const ridgeLength = Math.max(bounds.width * 0.3, bounds.depth * 0.3);
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerZ = (bounds.minZ + bounds.maxZ) / 2;
  const ridgeA: Vec3 = [centerX - ridgeLength / 2, ridgeHeight, centerZ];
  const ridgeB: Vec3 = [centerX + ridgeLength / 2, ridgeHeight, centerZ];

  for (let index = 0; index < outerRing.length; index += 1) {
    const current = outerRing[index];
    const next = outerRing[(index + 1) % outerRing.length];
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
  const apexHeight = Math.max(topHeight, roofBaseHeight + 1.1);
  const apex: Vec3 = [
    (bounds.minX + bounds.maxX) / 2,
    apexHeight,
    (bounds.minZ + bounds.maxZ) / 2,
  ];

  for (let index = 0; index < outerRing.length; index += 1) {
    const current = outerRing[index];
    const next = outerRing[(index + 1) % outerRing.length];
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
    area += current[0] * next[2] - next[0] * current[2];
  }
  return Math.abs(area) / 2;
}

function simplifyRing(ring: Vec3[], tolerance: number): Vec3[] {
  if (ring.length <= 4) {
    return ring;
  }
  const result: Vec3[] = [ring[0]];
  for (let i = 1; i < ring.length - 1; i += 1) {
    const prev = result[result.length - 1];
    const curr = ring[i];
    const dist = Math.sqrt((curr[0] - prev[0]) ** 2 + (curr[2] - prev[2]) ** 2);
    if (dist >= tolerance) {
      result.push(curr);
    }
  }
  result.push(ring[ring.length - 1]);

  if (result.length < 3) {
    return ring;
  }

  const hasArea = result.some((p, i) => {
    const next = result[(i + 1) % result.length];
    const nextNext = result[(i + 2) % result.length];
    const cross =
      (next[0] - p[0]) * (nextNext[2] - p[2]) -
      (next[2] - p[2]) * (nextNext[0] - p[0]);
    return Math.abs(cross) > 0.001;
  });

  return hasArea ? result : ring;
}
