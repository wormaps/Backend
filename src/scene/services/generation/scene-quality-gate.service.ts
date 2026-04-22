import { Injectable } from '@nestjs/common';
import { join } from 'node:path';
import { AppLoggerService } from '../../../common/logging/app-logger.service';
import {
  SceneDetail,
  SceneMeta,
  SceneQualityGateReasonCode,
  SceneQualityGateResult,
} from '../../types/scene.types';
import {
  getSceneDataDir,
  getSceneDiagnosticsLogPath,
} from '../../storage/scene-storage.utils';
import { buildSceneFidelityMetricsReport } from '../../utils/scene-fidelity-metrics.utils';
import { buildSceneModeComparisonReport } from '../../utils/scene-mode-comparison-report.utils';
import {
  findGeometryCorrectionDiagnostics,
  hasCriticalCollision,
  hasCriticalGroundingGap,
  hasCriticalRoofWallGap,
  hasCriticalShellClosure,
  hasCriticalTerrainTransportAlignment,
} from './quality-gate/scene-quality-gate-geometry';
import { resolveSceneQualityGateMeshSummary } from './quality-gate/scene-quality-gate-mesh-summary';
import { resolveSceneOracleApproval } from './quality-gate/scene-quality-gate-oracle-approval';
import {
  resolveAdaptiveMeshWarnThresholds,
  resolveSceneQualityGateThresholds,
  shouldEnforceCriticalGeometryForPhase,
} from './quality-gate/scene-quality-gate-thresholds';

@Injectable()
export class SceneQualityGateService {
  constructor(private readonly appLoggerService: AppLoggerService) {}

  async evaluate(
    sceneMeta: SceneMeta,
    sceneDetail: SceneDetail,
  ): Promise<SceneQualityGateResult> {
    const fidelityPlan = sceneDetail.fidelityPlan ?? sceneMeta.fidelityPlan;
    const thresholds = resolveSceneQualityGateThresholds(fidelityPlan?.phase);
    const enforceCriticalGeometry = shouldEnforceCriticalGeometryForPhase(
      fidelityPlan?.phase,
    );
    const oracleApproval = await resolveSceneOracleApproval({
      sceneId: sceneMeta.sceneId,
      phase: fidelityPlan?.phase,
    });
    const metrics = buildSceneFidelityMetricsReport(sceneMeta, sceneDetail);
    const modeComparison = buildSceneModeComparisonReport(
      sceneMeta,
      sceneDetail,
      {
        generationMs: 0,
        glbBytes: 0,
      },
    );
    const meshSummary = await resolveSceneQualityGateMeshSummary(
      sceneMeta.sceneId,
    );
    const adaptiveWarnThresholds = resolveAdaptiveMeshWarnThresholds({
      thresholds,
      totalMeshNodeCount: meshSummary.totalMeshNodeCount,
    });
    const effectiveThresholds = {
      ...thresholds,
      ...adaptiveWarnThresholds,
    };
    const reasonCodes: SceneQualityGateReasonCode[] = [];

    if ((fidelityPlan?.coverageGapRatio ?? 0) > effectiveThresholds.coverageGapMax) {
      reasonCodes.push('COVERAGE_GAP_PRESENT');
    }
    if (metrics.score.overall < effectiveThresholds.overallMin) {
      reasonCodes.push('OVERALL_SCORE_BELOW_MIN');
    }
    if (metrics.score.breakdown.structure < effectiveThresholds.structureMin) {
      reasonCodes.push('STRUCTURE_SCORE_BELOW_MIN');
    }
    if (
      metrics.score.breakdown.placeReadability <
        effectiveThresholds.placeReadabilityMin
    ) {
      reasonCodes.push('PLACE_READABILITY_SCORE_BELOW_MIN');
    }
    if (modeComparison.delta.overallScore < effectiveThresholds.modeDeltaOverallMin) {
      reasonCodes.push('MODE_DELTA_BELOW_MIN');
    }
    if (
      meshSummary.criticalPolygonBudgetExceededCount >
      effectiveThresholds.criticalPolygonBudgetExceededMax
    ) {
      reasonCodes.push('CRITICAL_BUDGET_SKIP');
    }
    if (
      meshSummary.criticalEmptyOrInvalidGeometryCount >
      effectiveThresholds.criticalInvalidGeometryMax
    ) {
      reasonCodes.push('CRITICAL_INVALID_GEOMETRY');
    }
    if (
      enforceCriticalGeometry &&
      hasCriticalCollision({
        geometryDiagnostics: sceneDetail.geometryDiagnostics,
        totalBuildingCount: sceneMeta.buildings.length,
      })
    ) {
      reasonCodes.push('CRITICAL_COLLISION_DETECTED');
    }
    if (
      enforceCriticalGeometry &&
      hasCriticalGroundingGap({
        geometryDiagnostics: sceneDetail.geometryDiagnostics,
        totalBuildingCount: sceneMeta.buildings.length,
      })
    ) {
      reasonCodes.push('CRITICAL_GROUNDING_GAP_DETECTED');
    }
    if (
      enforceCriticalGeometry &&
      hasCriticalShellClosure(sceneDetail.geometryDiagnostics)
    ) {
      reasonCodes.push('CRITICAL_SHELL_CLOSURE_DETECTED');
    }
    if (
      enforceCriticalGeometry &&
      hasCriticalRoofWallGap(sceneDetail.geometryDiagnostics)
    ) {
      reasonCodes.push('CRITICAL_ROOF_WALL_GAP_DETECTED');
    }
    if (
      enforceCriticalGeometry &&
      sceneMeta.terrainProfile?.hasElevationModel &&
      hasCriticalTerrainTransportAlignment({
        geometryDiagnostics: sceneDetail.geometryDiagnostics,
        totalTransportCount: sceneMeta.roads.length + sceneMeta.walkways.length,
      })
    ) {
      reasonCodes.push('CRITICAL_TERRAIN_TRANSPORT_ALIGNMENT_DETECTED');
    }
    if (oracleApproval.required && oracleApproval.state !== 'APPROVED') {
      reasonCodes.push('ORACLE_APPROVAL_REQUIRED');
    }
    if (meshSummary.totalSkipped > effectiveThresholds.maxSkippedMeshesWarn) {
      reasonCodes.push('MESH_SKIPPED_COUNT_ABOVE_WARN_MAX');
    }
    if (
      meshSummary.missingSourceCount > effectiveThresholds.maxMissingSourceWarn
    ) {
      reasonCodes.push('MISSING_SOURCE_COUNT_ABOVE_WARN_MAX');
    }

    const artifactRefs = {
      diagnosticsLogPath: getSceneDiagnosticsLogPath(sceneMeta.sceneId),
      modeComparisonPath: join(
        getSceneDataDir(),
        `${sceneMeta.sceneId}.mode-comparison.json`,
      ),
    };

    this.appLoggerService.info('scene.quality_gate.geometry_marker', {
      sceneId: sceneMeta.sceneId,
      step: 'quality_gate',
      geometryMarker: findGeometryCorrectionDiagnostics(
        sceneDetail.geometryDiagnostics,
      ),
      reasonCodes,
    });

    return {
      version: 'qg.v1',
      state: reasonCodes.length === 0 ? 'PASS' : 'FAIL',
      failureCategory:
        reasonCodes.length === 0 ? undefined : 'QUALITY_GATE_REJECTED',
      reasonCodes,
      scores: {
        overall: metrics.score.overall,
        breakdown: {
          structure: metrics.score.breakdown.structure,
          atmosphere: metrics.score.breakdown.atmosphere,
          placeReadability: metrics.score.breakdown.placeReadability,
        },
        modeDeltaOverallScore: modeComparison.delta.overallScore,
      },
        thresholds: effectiveThresholds,
        meshSummary,
        artifactRefs,
        oracleApproval,
      decidedAt: new Date().toISOString(),
    };
  }
}
