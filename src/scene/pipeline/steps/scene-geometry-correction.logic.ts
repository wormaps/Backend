import type {
  SceneBuildingMeta,
  SceneDetail,
  SceneMeta,
  SceneRoadMeta,
  SceneWalkwayMeta,
} from '../../types/scene.types';
import {
  clamp01,
  distanceToPathMeters,
  normalizeRingVertexCount,
  resolveBuildingAnchors,
  resolveTerrainHeightForPoints,
  resolveTerrainOffsetForPoints,
} from './scene-geometry-correction.utils';

const COLLISION_NEAR_ROAD_METERS = 3;
const BASE_GROUND_OFFSET_ON_COLLISION_METERS = 0.06;
const MAX_GROUND_OFFSET_ON_COLLISION_METERS = 0.24;
const BUILDING_OVERLAP_PADDING_METERS = 0.35;
const BUILDING_OVERLAP_GROUND_OFFSET_METERS = 0.08;
const SEVERE_GROUNDED_GAP_OFFSET_THRESHOLD = 0.16;
const TERRAIN_RELIEF_SCALE = 0.5;
const MIN_RING_VERTICES_FOR_CLOSURE = 3;
const MIN_SETBACK_USABLE_VERTICES = 3;
const MAX_SAFE_SETBACK_LEVELS_WITHOUT_COLLAPSE = 3;

const OVERLAP_SEVERITY_LOW_THRESHOLD_M2 = 2;
const OVERLAP_SEVERITY_HIGH_THRESHOLD_M2 = 15;
const HEIGHT_STAGGER_BASE_METERS = 0.12;
const HEIGHT_STAGGER_PER_AREA_M2 = 0.008;
const MAX_HEIGHT_STAGGER_METERS = 0.8;
const LATERAL_SEPARATION_BASE_METERS = 0.05;
const LATERAL_SEPARATION_PER_AREA_M2 = 0.003;
const MAX_LATERAL_SEPARATION_METERS = 0.3;
const COMBINED_GROUND_OFFSET_REDUCTION_FACTOR = 0.6;

export interface GeometryCorrectionResult {
  meta: SceneMeta;
  detail: SceneDetail;
}

export interface OverlapMitigationOutcome {
  objectId: string;
  strategy: OverlapMitigationStrategy;
  overlapAreaM2: number;
  severity: 'low' | 'medium' | 'high';
  groundOffsetAppliedM: number;
  heightStaggerAppliedM: number;
  lateralSeparationAppliedM: number;
}

export type OverlapMitigationStrategy =
  | 'none'
  | 'ground_offset'
  | 'height_stagger'
  | 'lateral_separation'
  | 'combined';

interface GeometryCorrectionDiagnostic {
  objectId: '__geometry_correction__';
  strategy: 'fallback_massing';
  fallbackApplied: boolean;
  fallbackReason: 'NONE';
  hasHoles: false;
  polygonComplexity: 'simple';
  collisionRiskCount: number;
  buildingOverlapCount: number;
  groundedGapCount: number;
  averageGroundOffsetM: number;
  maxGroundOffsetM: number;
  openShellCount: number;
  roofWallGapCount: number;
  invalidSetbackJoinCount: number;
  terrainAnchoredBuildingCount: number;
  terrainAnchoredRoadCount: number;
  terrainAnchoredWalkwayCount: number;
  averageTerrainOffsetM: number;
  maxTerrainOffsetM: number;
  transportTerrainCoverageRatio: number;
  overlapMitigationOutcomes: OverlapMitigationOutcome[];
  totalOverlapAreaM2: number;
  highSeverityOverlapCount: number;
  mediumSeverityOverlapCount: number;
  lowSeverityOverlapCount: number;
}

interface BuildingFootprintBounds {
  objectId: string;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export function resolveClosureDiagnostics(buildings: SceneBuildingMeta[]): {
  openShellCount: number;
  roofWallGapCount: number;
  invalidSetbackJoinCount: number;
} {
  let openShellCount = 0;
  let roofWallGapCount = 0;
  let invalidSetbackJoinCount = 0;

  for (const building of buildings) {
    const vertexCount = normalizeRingVertexCount(building.outerRing.length);
    if (vertexCount < MIN_RING_VERTICES_FOR_CLOSURE) {
      openShellCount += 1;
    }

    if (building.roofType === 'gable' && vertexCount < 4) {
      roofWallGapCount += 1;
    }

    const setbackLevels = Math.max(0, building.setbackLevels ?? 0);
    if (setbackLevels > 0) {
      const estimatedRemaining = Math.max(0, vertexCount - setbackLevels);
      const likelyInvalidJoin =
        estimatedRemaining < MIN_SETBACK_USABLE_VERTICES ||
        setbackLevels > MAX_SAFE_SETBACK_LEVELS_WITHOUT_COLLAPSE;
      if (likelyInvalidJoin) {
        invalidSetbackJoinCount += 1;
      }
    }
  }

  return {
    openShellCount,
    roofWallGapCount,
    invalidSetbackJoinCount,
  };
}

export function correctBuilding(
  building: SceneBuildingMeta,
  roads: SceneRoadMeta[],
  meta: SceneMeta,
  buildingOverlapObjectIds: ReadonlySet<string>,
  overlapAreas?: Map<string, number>,
): {
  building: SceneBuildingMeta;
  mitigationOutcome?: OverlapMitigationOutcome;
} {
  const anchors = resolveBuildingAnchors(building.outerRing);
  if (anchors.length === 0) {
    return {
      building: {
        ...building,
        collisionRisk: 'none',
        groundOffsetM: 0,
      },
    };
  }

  const nearestRoadDistance = anchors.reduce<number>((minimum, anchor) => {
    const anchorDistance = roads.reduce<number>((anchorMinimum, road) => {
      const distance = distanceToPathMeters(anchor, road.path);
      return Math.min(anchorMinimum, distance);
    }, Number.POSITIVE_INFINITY);
    return Math.min(minimum, anchorDistance);
  }, Number.POSITIVE_INFINITY);

  const minClearance = resolveRoadClearanceThreshold(roads, anchors);
  const nearRoad = Number.isFinite(nearestRoadDistance)
    ? nearestRoadDistance < minClearance
    : false;
  const nearBuildingOverlap = buildingOverlapObjectIds.has(building.objectId);
  const collisionRisk = nearRoad ? 'road_overlap' : 'none';
  const gapRatio = nearRoad
    ? clamp01((minClearance - nearestRoadDistance) / Math.max(0.25, minClearance))
    : 0;
  const dynamicGroundOffset = Number(
    (
      BASE_GROUND_OFFSET_ON_COLLISION_METERS +
      gapRatio *
        (MAX_GROUND_OFFSET_ON_COLLISION_METERS -
          BASE_GROUND_OFFSET_ON_COLLISION_METERS)
    ).toFixed(3),
  );

  let overlapGroundOffset = 0;
  let heightStagger = 0;
  let lateralSeparation = 0;
  let mitigationStrategy: OverlapMitigationStrategy = 'none';
  let overlapAreaM2 = 0;
  let severity: 'low' | 'medium' | 'high' = 'low';

  if (nearBuildingOverlap) {
    overlapAreaM2 = overlapAreas?.get(building.objectId) ?? 0;
    severity = resolveOverlapSeverity(overlapAreaM2);
    mitigationStrategy = resolveMitigationStrategy(severity, nearRoad);

    switch (mitigationStrategy) {
      case 'ground_offset':
        overlapGroundOffset = BUILDING_OVERLAP_GROUND_OFFSET_METERS;
        break;
      case 'height_stagger':
        heightStagger = Number(
          Math.min(
            MAX_HEIGHT_STAGGER_METERS,
            HEIGHT_STAGGER_BASE_METERS + overlapAreaM2 * HEIGHT_STAGGER_PER_AREA_M2,
          ).toFixed(3),
        );
        overlapGroundOffset = BUILDING_OVERLAP_GROUND_OFFSET_METERS * 0.5;
        break;
      case 'lateral_separation':
        lateralSeparation = Number(
          Math.min(
            MAX_LATERAL_SEPARATION_METERS,
            LATERAL_SEPARATION_BASE_METERS +
              overlapAreaM2 * LATERAL_SEPARATION_PER_AREA_M2,
          ).toFixed(3),
        );
        overlapGroundOffset = BUILDING_OVERLAP_GROUND_OFFSET_METERS * 0.3;
        break;
      case 'combined':
        overlapGroundOffset =
          BUILDING_OVERLAP_GROUND_OFFSET_METERS *
          COMBINED_GROUND_OFFSET_REDUCTION_FACTOR;
        heightStagger = Number(
          Math.min(
            MAX_HEIGHT_STAGGER_METERS * 0.7,
            HEIGHT_STAGGER_BASE_METERS +
              overlapAreaM2 * HEIGHT_STAGGER_PER_AREA_M2 * 0.5,
          ).toFixed(3),
        );
        lateralSeparation = Number(
          Math.min(
            MAX_LATERAL_SEPARATION_METERS * 0.5,
            LATERAL_SEPARATION_BASE_METERS +
              overlapAreaM2 * LATERAL_SEPARATION_PER_AREA_M2 * 0.5,
          ).toFixed(3),
        );
        break;
      default:
        overlapGroundOffset = BUILDING_OVERLAP_GROUND_OFFSET_METERS;
        break;
    }
  }

  const groundOffsetM = Number(
    Math.max(nearRoad ? dynamicGroundOffset : 0, overlapGroundOffset).toFixed(3),
  );
  const terrainOffset = resolveTerrainOffsetForPoints(meta, anchors);
  const terrainSampleHeightMeters = resolveTerrainHeightForPoints(meta, anchors);

  const correctedBuilding: SceneBuildingMeta = {
    ...building,
    collisionRisk,
    groundOffsetM,
    terrainOffsetM: terrainOffset,
    terrainSampleHeightMeters,
  };

  if (heightStagger > 0) {
    correctedBuilding.heightMeters = Math.max(
      4,
      building.heightMeters - heightStagger,
    );
  }

  const mitigationOutcome: OverlapMitigationOutcome | undefined = nearBuildingOverlap
    ? {
        objectId: building.objectId,
        strategy: mitigationStrategy,
        overlapAreaM2: Number(overlapAreaM2.toFixed(2)),
        severity,
        groundOffsetAppliedM: groundOffsetM,
        heightStaggerAppliedM: heightStagger,
        lateralSeparationAppliedM: lateralSeparation,
      }
    : undefined;

  return { building: correctedBuilding, mitigationOutcome };
}

export function correctRoad(
  road: SceneRoadMeta,
  meta: SceneMeta,
): SceneRoadMeta {
  return {
    ...road,
    terrainOffsetM: resolveTerrainOffsetForPoints(meta, road.path),
    terrainSampleHeightMeters: resolveTerrainHeightForPoints(meta, road.path),
  };
}

export function correctWalkway(
  walkway: SceneWalkwayMeta,
  meta: SceneMeta,
): SceneWalkwayMeta {
  return {
    ...walkway,
    terrainOffsetM: resolveTerrainOffsetForPoints(meta, walkway.path),
    terrainSampleHeightMeters: resolveTerrainHeightForPoints(meta, walkway.path),
  };
}

export function resolveRoadClearanceThreshold(
  roads: SceneRoadMeta[],
  anchors: Array<{ lat: number; lng: number }>,
): number {
  let nearestRoad: SceneRoadMeta | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const road of roads) {
    const distance = anchors.reduce<number>((minimum, anchor) => {
      const candidate = distanceToPathMeters(anchor, road.path);
      return Math.min(minimum, candidate);
    }, Number.POSITIVE_INFINITY);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestRoad = road;
    }
  }

  if (!nearestRoad) {
    return COLLISION_NEAR_ROAD_METERS;
  }

  const laneWidthEstimate = Math.max(
    2.8,
    Math.min(4.2, nearestRoad.widthMeters / Math.max(1, nearestRoad.laneCount)),
  );
  return Math.max(1, Math.min(COLLISION_NEAR_ROAD_METERS, laneWidthEstimate * 0.75));
}

export function resolveBuildingOverlapObjectIds(
  meta: SceneMeta,
): Set<string> {
  const boxes = meta.buildings
    .map((building) => toBuildingFootprintBounds(building, meta.origin.lat, meta.origin.lng))
    .filter((item): item is BuildingFootprintBounds => item !== null)
    .sort((left, right) => left.minX - right.minX);
  const overlapObjectIds = new Set<string>();

  for (let index = 0; index < boxes.length; index += 1) {
    const current = boxes[index];
    for (
      let candidateIndex = index + 1;
      candidateIndex < boxes.length;
      candidateIndex += 1
    ) {
      const candidate = boxes[candidateIndex];
      if (candidate.minX > current.maxX + BUILDING_OVERLAP_PADDING_METERS) {
        break;
      }

      if (hasAabbOverlap(current, candidate, BUILDING_OVERLAP_PADDING_METERS)) {
        overlapObjectIds.add(current.objectId);
        overlapObjectIds.add(candidate.objectId);
      }
    }
  }

  return overlapObjectIds;
}

export function resolveOverlapAreas(
  meta: SceneMeta,
  overlapObjectIds: ReadonlySet<string>,
): Map<string, number> {
  const areas = new Map<string, number>();
  const boxes = meta.buildings
    .map((building) => toBuildingFootprintBounds(building, meta.origin.lat, meta.origin.lng))
    .filter((item): item is BuildingFootprintBounds => item !== null);

  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = i + 1; j < boxes.length; j += 1) {
      const left = boxes[i];
      const right = boxes[j];
      if (!overlapObjectIds.has(left.objectId) && !overlapObjectIds.has(right.objectId)) {
        continue;
      }
      const overlapWidth = Math.max(
        0,
        Math.min(left.maxX, right.maxX) - Math.max(left.minX, right.minX),
      );
      const overlapDepth = Math.max(
        0,
        Math.min(left.maxY, right.maxY) - Math.max(left.minY, right.minY),
      );
      const overlapArea = overlapWidth * overlapDepth;
      if (overlapArea > 0) {
        areas.set(left.objectId, (areas.get(left.objectId) ?? 0) + overlapArea);
        areas.set(right.objectId, (areas.get(right.objectId) ?? 0) + overlapArea);
      }
    }
  }
  return areas;
}

function resolveOverlapSeverity(
  overlapAreaM2: number,
): 'low' | 'medium' | 'high' {
  if (overlapAreaM2 >= OVERLAP_SEVERITY_HIGH_THRESHOLD_M2) {
    return 'high';
  }
  if (overlapAreaM2 >= OVERLAP_SEVERITY_LOW_THRESHOLD_M2) {
    return 'medium';
  }
  return 'low';
}

function resolveMitigationStrategy(
  severity: 'low' | 'medium' | 'high',
  nearRoad: boolean,
): OverlapMitigationStrategy {
  if (severity === 'high') {
    return nearRoad ? 'combined' : 'height_stagger';
  }
  if (severity === 'medium') {
    return nearRoad ? 'ground_offset' : 'lateral_separation';
  }
  return 'ground_offset';
}

function toBuildingFootprintBounds(
  building: SceneBuildingMeta,
  referenceLat: number,
  referenceLng: number,
): BuildingFootprintBounds | null {
  if (building.outerRing.length === 0) {
    return null;
  }

  const metersPerLat = 111_320;
  const metersPerLng = 111_320 * Math.cos((referenceLat * Math.PI) / 180);
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const point of building.outerRing) {
    const x = (point.lng - referenceLng) * metersPerLng;
    const y = (point.lat - referenceLat) * metersPerLat;
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }

  if (
    !Number.isFinite(minX) ||
    !Number.isFinite(minY) ||
    !Number.isFinite(maxX) ||
    !Number.isFinite(maxY)
  ) {
    return null;
  }

  return {
    objectId: building.objectId,
    minX,
    maxX,
    minY,
    maxY,
  };
}

function hasAabbOverlap(
  left: BuildingFootprintBounds,
  right: BuildingFootprintBounds,
  paddingMeters: number,
): boolean {
  return (
    left.minX - paddingMeters <= right.maxX &&
    left.maxX + paddingMeters >= right.minX &&
    left.minY - paddingMeters <= right.maxY &&
    left.maxY + paddingMeters >= right.minY
  );
}
