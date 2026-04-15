import { Injectable } from '@nestjs/common';
import { appendSceneDiagnosticsLog } from '../../storage/scene-storage.utils';
import type {
  SceneDetail,
  SceneMeta,
  SceneRoadMeta,
  SceneBuildingMeta,
  SceneWalkwayMeta,
} from '../../types/scene.types';

interface GeometryCorrectionResult {
  meta: SceneMeta;
  detail: SceneDetail;
}

type OverlapMitigationStrategy =
  | 'none'
  | 'ground_offset'
  | 'height_stagger'
  | 'lateral_separation'
  | 'combined';

interface OverlapMitigationOutcome {
  objectId: string;
  strategy: OverlapMitigationStrategy;
  overlapAreaM2: number;
  severity: 'low' | 'medium' | 'high';
  groundOffsetAppliedM: number;
  heightStaggerAppliedM: number;
  lateralSeparationAppliedM: number;
}

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

const COLLISION_NEAR_ROAD_METERS = 3;
const BASE_GROUND_OFFSET_ON_COLLISION_METERS = 0.06;
const MAX_GROUND_OFFSET_ON_COLLISION_METERS = 0.24;
const BUILDING_OVERLAP_PADDING_METERS = 0.35;
const BUILDING_OVERLAP_GROUND_OFFSET_METERS = 0.08;
const SEVERE_GROUNDED_GAP_OFFSET_THRESHOLD = 0.16;
const TERRAIN_RELIEF_SCALE = 0.55;
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

interface BuildingFootprintBounds {
  objectId: string;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

@Injectable()
export class SceneGeometryCorrectionStep {
  execute(meta: SceneMeta, detail: SceneDetail): GeometryCorrectionResult {
    const roads = meta.roads.map((road) => this.correctRoad(road, meta));
    const walkways = meta.walkways.map((walkway) =>
      this.correctWalkway(walkway, meta),
    );
    const buildingOverlapObjectIds = this.resolveBuildingOverlapObjectIds(meta);
    const overlapAreas = this.resolveOverlapAreas(
      meta,
      buildingOverlapObjectIds,
    );
    const correctionResults = meta.buildings.map((building) =>
      this.correctBuilding(
        building,
        roads,
        meta,
        buildingOverlapObjectIds,
        overlapAreas,
      ),
    );
    const correctedBuildings = correctionResults.map(
      (result) => result.building,
    );
    const overlapMitigationOutcomes = correctionResults
      .map((result) => result.mitigationOutcome)
      .filter(
        (outcome): outcome is OverlapMitigationOutcome => outcome !== undefined,
      );

    const collisionRiskCount = correctedBuildings.filter(
      (building) => building.collisionRisk === 'road_overlap',
    ).length;
    const buildingOverlapCount = correctedBuildings.filter((building) =>
      buildingOverlapObjectIds.has(building.objectId),
    ).length;
    const groundedGapCount = correctedBuildings.filter(
      (building) =>
        (building.groundOffsetM ?? 0) > SEVERE_GROUNDED_GAP_OFFSET_THRESHOLD,
    ).length;
    const appliedGroundOffsets = correctedBuildings
      .map((building) => building.groundOffsetM ?? 0)
      .filter((offset) => offset > 0);
    const averageGroundOffsetM =
      appliedGroundOffsets.length > 0
        ? Number(
            (
              appliedGroundOffsets.reduce((sum, value) => sum + value, 0) /
              appliedGroundOffsets.length
            ).toFixed(3),
          )
        : 0;
    const maxGroundOffsetM =
      appliedGroundOffsets.length > 0
        ? Number(Math.max(...appliedGroundOffsets).toFixed(3))
        : 0;
    const terrainOffsets = [
      ...roads.map((road) => road.terrainOffsetM ?? 0),
      ...walkways.map((walkway) => walkway.terrainOffsetM ?? 0),
      ...correctedBuildings.map((building) => building.terrainOffsetM ?? 0),
    ].filter((offset) => Math.abs(offset) > 0);
    const averageTerrainOffsetM =
      terrainOffsets.length > 0
        ? Number(
            (
              terrainOffsets.reduce((sum, value) => sum + value, 0) /
              terrainOffsets.length
            ).toFixed(3),
          )
        : 0;
    const maxTerrainOffsetM =
      terrainOffsets.length > 0
        ? Number(Math.max(...terrainOffsets).toFixed(3))
        : 0;
    const terrainAnchoredBuildingCount = correctedBuildings.filter((building) =>
      Number.isFinite(building.terrainSampleHeightMeters ?? Number.NaN),
    ).length;
    const terrainAnchoredRoadCount = roads.filter((road) =>
      Number.isFinite(road.terrainSampleHeightMeters ?? Number.NaN),
    ).length;
    const terrainAnchoredWalkwayCount = walkways.filter((walkway) =>
      Number.isFinite(walkway.terrainSampleHeightMeters ?? Number.NaN),
    ).length;
    const transportCount = roads.length + walkways.length;
    const transportTerrainCoverageRatio =
      transportCount > 0
        ? Number(
            (
              (terrainAnchoredRoadCount + terrainAnchoredWalkwayCount) /
              transportCount
            ).toFixed(3),
          )
        : 1;
    const closureDiagnostics =
      this.resolveClosureDiagnostics(correctedBuildings);
    const { openShellCount, roofWallGapCount, invalidSetbackJoinCount } =
      closureDiagnostics;

    const totalOverlapAreaM2 = Number(
      overlapMitigationOutcomes
        .reduce((sum, outcome) => sum + outcome.overlapAreaM2, 0)
        .toFixed(2),
    );
    const highSeverityOverlapCount = overlapMitigationOutcomes.filter(
      (outcome) => outcome.severity === 'high',
    ).length;
    const mediumSeverityOverlapCount = overlapMitigationOutcomes.filter(
      (outcome) => outcome.severity === 'medium',
    ).length;
    const lowSeverityOverlapCount = overlapMitigationOutcomes.filter(
      (outcome) => outcome.severity === 'low',
    ).length;

    const correctedMeta: SceneMeta = {
      ...meta,
      roads,
      buildings: correctedBuildings,
      walkways,
    };
    const existingDiagnostics = detail.geometryDiagnostics ?? [];
    const correctedDetail: SceneDetail = {
      ...detail,
      geometryDiagnostics: [
        ...existingDiagnostics,
        {
          objectId: '__geometry_correction__',
          strategy: 'fallback_massing',
          fallbackApplied:
            collisionRiskCount > 0 ||
            buildingOverlapCount > 0 ||
            groundedGapCount > 0 ||
            openShellCount > 0 ||
            roofWallGapCount > 0 ||
            invalidSetbackJoinCount > 0,
          fallbackReason: 'NONE',
          hasHoles: false,
          polygonComplexity: 'simple',
          collisionRiskCount,
          buildingOverlapCount,
          groundedGapCount,
          averageGroundOffsetM,
          maxGroundOffsetM,
          openShellCount,
          roofWallGapCount,
          invalidSetbackJoinCount,
          terrainAnchoredBuildingCount,
          terrainAnchoredRoadCount,
          terrainAnchoredWalkwayCount,
          averageTerrainOffsetM,
          maxTerrainOffsetM,
          transportTerrainCoverageRatio,
          overlapMitigationOutcomes,
          totalOverlapAreaM2,
          highSeverityOverlapCount,
          mediumSeverityOverlapCount,
          lowSeverityOverlapCount,
        } as GeometryCorrectionDiagnostic,
      ],
    };

    void appendSceneDiagnosticsLog(meta.sceneId, 'geometry_correction', {
      collisionRiskCount,
      buildingOverlapCount,
      groundedGapCount,
      averageGroundOffsetM,
      maxGroundOffsetM,
      openShellCount,
      roofWallGapCount,
      invalidSetbackJoinCount,
      terrainAnchoredBuildingCount,
      terrainAnchoredRoadCount,
      terrainAnchoredWalkwayCount,
      averageTerrainOffsetM,
      maxTerrainOffsetM,
      transportTerrainCoverageRatio,
      buildingCount: correctedBuildings.length,
      roadCount: roads.length,
      walkwayCount: walkways.length,
      correctedCount: correctedBuildings.filter(
        (building) => building.collisionRisk === 'road_overlap',
      ).length,
      totalOverlapAreaM2,
      highSeverityOverlapCount,
      mediumSeverityOverlapCount,
      lowSeverityOverlapCount,
      mitigationStrategies: overlapMitigationOutcomes.map((o) => o.strategy),
    });

    return {
      meta: correctedMeta,
      detail: correctedDetail,
    };
  }

  private resolveClosureDiagnostics(buildings: SceneBuildingMeta[]): {
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

  private correctBuilding(
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

    const minClearance = this.resolveRoadClearanceThreshold(roads, anchors);
    const nearRoad = Number.isFinite(nearestRoadDistance)
      ? nearestRoadDistance < minClearance
      : false;
    const nearBuildingOverlap = buildingOverlapObjectIds.has(building.objectId);
    const collisionRisk = nearRoad ? 'road_overlap' : 'none';
    const gapRatio = nearRoad
      ? clamp01(
          (minClearance - nearestRoadDistance) / Math.max(0.25, minClearance),
        )
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
      severity = this.resolveOverlapSeverity(overlapAreaM2);
      mitigationStrategy = this.resolveMitigationStrategy(severity, nearRoad);

      switch (mitigationStrategy) {
        case 'ground_offset':
          overlapGroundOffset = BUILDING_OVERLAP_GROUND_OFFSET_METERS;
          break;
        case 'height_stagger':
          heightStagger = Number(
            Math.min(
              MAX_HEIGHT_STAGGER_METERS,
              HEIGHT_STAGGER_BASE_METERS +
                overlapAreaM2 * HEIGHT_STAGGER_PER_AREA_M2,
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
      Math.max(nearRoad ? dynamicGroundOffset : 0, overlapGroundOffset).toFixed(
        3,
      ),
    );
    const terrainOffset = resolveTerrainOffsetForPoints(meta, anchors);
    const terrainSampleHeightMeters = resolveTerrainHeightForPoints(
      meta,
      anchors,
    );

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

    const mitigationOutcome: OverlapMitigationOutcome | undefined =
      nearBuildingOverlap
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

  private correctRoad(road: SceneRoadMeta, meta: SceneMeta): SceneRoadMeta {
    return {
      ...road,
      terrainOffsetM: resolveTerrainOffsetForPoints(meta, road.path),
      terrainSampleHeightMeters: resolveTerrainHeightForPoints(meta, road.path),
    };
  }

  private correctWalkway(
    walkway: SceneWalkwayMeta,
    meta: SceneMeta,
  ): SceneWalkwayMeta {
    return {
      ...walkway,
      terrainOffsetM: resolveTerrainOffsetForPoints(meta, walkway.path),
      terrainSampleHeightMeters: resolveTerrainHeightForPoints(
        meta,
        walkway.path,
      ),
    };
  }

  private resolveRoadClearanceThreshold(
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
      Math.min(
        4.2,
        nearestRoad.widthMeters / Math.max(1, nearestRoad.laneCount),
      ),
    );
    return Math.max(
      1,
      Math.min(COLLISION_NEAR_ROAD_METERS, laneWidthEstimate * 0.75),
    );
  }

  private resolveBuildingOverlapObjectIds(meta: SceneMeta): Set<string> {
    const boxes = meta.buildings
      .map((building) =>
        this.toBuildingFootprintBounds(
          building,
          meta.origin.lat,
          meta.origin.lng,
        ),
      )
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

        if (
          this.hasAabbOverlap(
            current,
            candidate,
            BUILDING_OVERLAP_PADDING_METERS,
          )
        ) {
          overlapObjectIds.add(current.objectId);
          overlapObjectIds.add(candidate.objectId);
        }
      }
    }

    return overlapObjectIds;
  }

  private toBuildingFootprintBounds(
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

  private hasAabbOverlap(
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

  private resolveOverlapAreas(
    meta: SceneMeta,
    overlapObjectIds: ReadonlySet<string>,
  ): Map<string, number> {
    const areas = new Map<string, number>();
    const boxes = meta.buildings
      .map((building) =>
        this.toBuildingFootprintBounds(
          building,
          meta.origin.lat,
          meta.origin.lng,
        ),
      )
      .filter((item): item is BuildingFootprintBounds => item !== null);

    for (let i = 0; i < boxes.length; i += 1) {
      for (let j = i + 1; j < boxes.length; j += 1) {
        const left = boxes[i];
        const right = boxes[j];
        if (
          !overlapObjectIds.has(left.objectId) &&
          !overlapObjectIds.has(right.objectId)
        ) {
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
          areas.set(
            left.objectId,
            (areas.get(left.objectId) ?? 0) + overlapArea,
          );
          areas.set(
            right.objectId,
            (areas.get(right.objectId) ?? 0) + overlapArea,
          );
        }
      }
    }
    return areas;
  }

  private resolveOverlapSeverity(
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

  private resolveMitigationStrategy(
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
}

function resolveTerrainHeightForPoints(
  meta: SceneMeta,
  points: Array<{ lat: number; lng: number }>,
): number | undefined {
  const terrainProfile = meta.terrainProfile;
  if (!terrainProfile || terrainProfile.samples.length === 0) {
    return undefined;
  }

  const anchors = points.length > 0 ? points : [meta.origin];
  const heights = anchors
    .map((point) => sampleTerrainHeight(meta, point))
    .filter((value): value is number => Number.isFinite(value));

  if (heights.length === 0) {
    return undefined;
  }
  return Number(
    (heights.reduce((sum, value) => sum + value, 0) / heights.length).toFixed(
      3,
    ),
  );
}

function resolveTerrainOffsetForPoints(
  meta: SceneMeta,
  points: Array<{ lat: number; lng: number }>,
): number {
  const terrainProfile = meta.terrainProfile;
  if (!terrainProfile || terrainProfile.samples.length === 0) {
    return 0;
  }

  const sampledHeight = resolveTerrainHeightForPoints(meta, points);
  if (!Number.isFinite(sampledHeight)) {
    return 0;
  }

  const delta = (sampledHeight ?? 0) - terrainProfile.baseHeightMeters;
  return Number((delta * TERRAIN_RELIEF_SCALE).toFixed(3));
}

function sampleTerrainHeight(
  meta: SceneMeta,
  point: { lat: number; lng: number },
): number | null {
  const terrainProfile = meta.terrainProfile;
  if (!terrainProfile || terrainProfile.samples.length === 0) {
    return null;
  }

  const weighted = terrainProfile.samples
    .map((sample) => {
      const distance = distanceMeters(point, sample.location);
      const weight = 1 / Math.max(0.5, distance);
      return {
        heightMeters: sample.heightMeters,
        weight,
      };
    })
    .sort((left, right) => right.weight - left.weight)
    .slice(0, 4);

  const totalWeight = weighted.reduce((sum, item) => sum + item.weight, 0);
  if (totalWeight <= 0) {
    return null;
  }

  return (
    weighted.reduce((sum, item) => sum + item.heightMeters * item.weight, 0) /
    totalWeight
  );
}

function resolveBuildingAnchors(
  points: Array<{ lat: number; lng: number }>,
): Array<{ lat: number; lng: number }> {
  const anchors: Array<{ lat: number; lng: number }> = [];
  const center = averageCoordinate(points);
  if (center) {
    anchors.push(center);
  }
  anchors.push(...points);

  const uniqueAnchors = new Map<string, { lat: number; lng: number }>();
  for (const anchor of anchors) {
    const key = `${anchor.lat.toFixed(7)}:${anchor.lng.toFixed(7)}`;
    if (!uniqueAnchors.has(key)) {
      uniqueAnchors.set(key, anchor);
    }
  }
  return [...uniqueAnchors.values()];
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function averageCoordinate(
  points: Array<{ lat: number; lng: number }>,
): { lat: number; lng: number } | null {
  if (points.length === 0) {
    return null;
  }

  const sum = points.reduce(
    (acc, point) => ({
      lat: acc.lat + point.lat,
      lng: acc.lng + point.lng,
    }),
    { lat: 0, lng: 0 },
  );

  return {
    lat: sum.lat / points.length,
    lng: sum.lng / points.length,
  };
}

function distanceToPathMeters(
  point: { lat: number; lng: number },
  path: Array<{ lat: number; lng: number }>,
): number {
  if (path.length === 0) {
    return Number.POSITIVE_INFINITY;
  }
  if (path.length === 1) {
    return distanceMeters(point, path[0]);
  }

  let minDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < path.length - 1; index += 1) {
    const start = path[index];
    const end = path[index + 1];
    const dist = distanceToSegmentMeters(point, start, end);
    if (dist < minDistance) {
      minDistance = dist;
    }
  }

  return minDistance;
}

function distanceToSegmentMeters(
  point: { lat: number; lng: number },
  start: { lat: number; lng: number },
  end: { lat: number; lng: number },
): number {
  const metersPerLat = 111_320;
  const metersPerLng =
    111_320 * Math.cos((((start.lat + end.lat) / 2) * Math.PI) / 180);
  const ax = start.lng * metersPerLng;
  const ay = start.lat * metersPerLat;
  const bx = end.lng * metersPerLng;
  const by = end.lat * metersPerLat;
  const px = point.lng * metersPerLng;
  const py = point.lat * metersPerLat;

  const vx = bx - ax;
  const vy = by - ay;
  const wx = px - ax;
  const wy = py - ay;
  const len2 = vx * vx + vy * vy;
  if (len2 <= 1e-6) {
    return Math.hypot(px - ax, py - ay);
  }
  const t = Math.max(0, Math.min(1, (wx * vx + wy * vy) / len2));
  const cx = ax + vx * t;
  const cy = ay + vy * t;
  return Math.hypot(px - cx, py - cy);
}

function distanceMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const metersPerLat = 111_320;
  const metersPerLng =
    111_320 * Math.cos((((a.lat + b.lat) / 2) * Math.PI) / 180);
  return Math.hypot(
    (a.lat - b.lat) * metersPerLat,
    (a.lng - b.lng) * metersPerLng,
  );
}

function normalizeRingVertexCount(count: number): number {
  return Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
}
