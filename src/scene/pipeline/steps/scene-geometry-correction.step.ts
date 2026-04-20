import { Injectable } from '@nestjs/common';
import { appendSceneDiagnosticsLog } from '../../storage/scene-storage.utils';
import type {
  SceneDetail,
  SceneGeometryDiagnostic,
  SceneMeta,
} from '../../types/scene.types';
import {
  correctBuilding,
  correctRoad,
  correctWalkway,
  resolveBuildingOverlapObjectIds,
  resolveClosureDiagnostics,
  resolveOverlapAreas,
  type GeometryCorrectionResult,
  type OverlapMitigationOutcome,
} from './scene-geometry-correction.logic';

function createGeometryDiagnostic(
  details: SceneGeometryDiagnostic,
): SceneGeometryDiagnostic {
  return { ...details };
}

@Injectable()
export class SceneGeometryCorrectionStep {
  execute(meta: SceneMeta, detail: SceneDetail): GeometryCorrectionResult {
    const roads = meta.roads.map((road) => correctRoad(road, meta));
    const walkways = meta.walkways.map((walkway) =>
      correctWalkway(walkway, meta),
    );
    const buildingOverlapObjectIds = resolveBuildingOverlapObjectIds(meta);
    const overlapAreas = resolveOverlapAreas(meta, buildingOverlapObjectIds);
    const correctionResults = meta.buildings.map((building) =>
      correctBuilding(
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
    const correctedCount = correctedBuildings.filter(
      (building) => (building.groundOffsetM ?? 0) > 0,
    ).length;
    const groundedGapCount = correctedBuildings.filter(
      (building) =>
        (building.groundOffsetM ?? 0) > 0.16,
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
    const closureDiagnostics = resolveClosureDiagnostics(correctedBuildings);
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
          correctedCount,
        },
      ],
    };

    if (correctedCount > correctedBuildings.length * 0.5) {
      void appendSceneDiagnosticsLog(meta.sceneId, 'geometry_correction_warn', {
        correctedCount,
        totalBuildingCount: correctedBuildings.length,
        ratio: Number((correctedCount / Math.max(1, correctedBuildings.length)).toFixed(3)),
      });
    }

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
      correctedCount,
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
}
