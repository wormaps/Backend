import { Injectable } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  SceneDetail,
  SceneMeta,
  SceneQualityGateMeshSummary,
  SceneQualityGateReasonCode,
  SceneQualityGateResult,
  SceneQualityGateThresholds,
} from '../../types/scene.types';
import {
  getSceneDataDir,
  getSceneDiagnosticsLogPath,
} from '../../storage/scene-storage.utils';
import { buildSceneFidelityMetricsReport } from '../../utils/scene-fidelity-metrics.utils';
import { buildSceneModeComparisonReport } from '../../utils/scene-mode-comparison-report.utils';

const CRITICAL_MESH_NAMES = new Set([
  'road_base',
  'road_markings',
  'lane_overlay',
  'crosswalk_overlay',
  'junction_overlay',
  'building_windows',
]);

interface ParsedDiagnosticsEntry {
  stage?: string;
  meshNodes?: Array<{
    name?: string;
    skipped?: boolean;
    skippedReason?: string;
  }>;
}

@Injectable()
export class SceneQualityGateService {
  async evaluate(
    sceneMeta: SceneMeta,
    sceneDetail: SceneDetail,
  ): Promise<SceneQualityGateResult> {
    const fidelityPlan = sceneDetail.fidelityPlan ?? sceneMeta.fidelityPlan;
    const thresholds = this.resolveThresholds(fidelityPlan?.phase);
    const metrics = buildSceneFidelityMetricsReport(sceneMeta, sceneDetail);
    const modeComparison = buildSceneModeComparisonReport(
      sceneMeta,
      sceneDetail,
      {
        generationMs: 0,
        glbBytes: 0,
      },
    );
    const meshSummary = await this.resolveMeshSummary(sceneMeta.sceneId);
    const reasonCodes: SceneQualityGateReasonCode[] = [];

    if ((fidelityPlan?.coverageGapRatio ?? 0) > thresholds.coverageGapMax) {
      reasonCodes.push('COVERAGE_GAP_PRESENT');
    }
    if (metrics.score.overall < thresholds.overallMin) {
      reasonCodes.push('OVERALL_SCORE_BELOW_MIN');
    }
    if (metrics.score.breakdown.structure < thresholds.structureMin) {
      reasonCodes.push('STRUCTURE_SCORE_BELOW_MIN');
    }
    if (
      metrics.score.breakdown.placeReadability < thresholds.placeReadabilityMin
    ) {
      reasonCodes.push('PLACE_READABILITY_SCORE_BELOW_MIN');
    }
    if (modeComparison.delta.overallScore < thresholds.modeDeltaOverallMin) {
      reasonCodes.push('MODE_DELTA_BELOW_MIN');
    }
    if (
      meshSummary.criticalPolygonBudgetExceededCount >
      thresholds.criticalPolygonBudgetExceededMax
    ) {
      reasonCodes.push('CRITICAL_BUDGET_SKIP');
    }
    if (
      meshSummary.criticalEmptyOrInvalidGeometryCount >
      thresholds.criticalInvalidGeometryMax
    ) {
      reasonCodes.push('CRITICAL_INVALID_GEOMETRY');
    }

    const artifactRefs = {
      diagnosticsLogPath: getSceneDiagnosticsLogPath(sceneMeta.sceneId),
      modeComparisonPath: join(
        getSceneDataDir(),
        `${sceneMeta.sceneId}.mode-comparison.json`,
      ),
    };

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
      thresholds,
      meshSummary,
      artifactRefs,
      decidedAt: new Date().toISOString(),
    };
  }

  private resolveThresholds(
    phase?: 'PHASE_1_BASELINE' | 'PHASE_2_HYBRID_FOUNDATION',
  ): SceneQualityGateThresholds {
    if (phase === 'PHASE_2_HYBRID_FOUNDATION') {
      return {
        coverageGapMax: 0,
        overallMin: 0.7,
        structureMin: 0.62,
        placeReadabilityMin: 0.35,
        modeDeltaOverallMin: 0,
        criticalPolygonBudgetExceededMax: 0,
        criticalInvalidGeometryMax: 0,
      };
    }

    return {
      coverageGapMax: 1,
      overallMin: 0.45,
      structureMin: 0.45,
      placeReadabilityMin: 0,
      modeDeltaOverallMin: -0.2,
      criticalPolygonBudgetExceededMax: 0,
      criticalInvalidGeometryMax: 0,
    };
  }

  private async resolveMeshSummary(
    sceneId: string,
  ): Promise<SceneQualityGateMeshSummary> {
    const emptySummary: SceneQualityGateMeshSummary = {
      totalSkipped: 0,
      polygonBudgetExceededCount: 0,
      criticalPolygonBudgetExceededCount: 0,
      emptyOrInvalidGeometryCount: 0,
      criticalEmptyOrInvalidGeometryCount: 0,
      selectionCutCount: 0,
      missingSourceCount: 0,
    };

    let raw = '';
    try {
      raw = await readFile(getSceneDiagnosticsLogPath(sceneId), 'utf8');
    } catch {
      return emptySummary;
    }

    const glbBuildEntries = raw
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => {
        try {
          return JSON.parse(line) as ParsedDiagnosticsEntry;
        } catch {
          return null;
        }
      })
      .filter((entry): entry is ParsedDiagnosticsEntry => {
        if (!entry) {
          return false;
        }
        return entry.stage === 'glb_build';
      });

    const latest = glbBuildEntries.at(-1);
    const meshNodes = latest?.meshNodes;
    if (!meshNodes?.length) {
      return emptySummary;
    }

    const skippedNodes = meshNodes.filter((node) => node.skipped === true);
    const polygonBudgetNodes = skippedNodes.filter(
      (node) => node.skippedReason === 'polygon_budget_exceeded',
    );
    const invalidNodes = skippedNodes.filter(
      (node) => node.skippedReason === 'empty_or_invalid_geometry',
    );

    return {
      totalSkipped: skippedNodes.length,
      polygonBudgetExceededCount: polygonBudgetNodes.length,
      criticalPolygonBudgetExceededCount: polygonBudgetNodes.filter((node) =>
        CRITICAL_MESH_NAMES.has(node.name ?? ''),
      ).length,
      emptyOrInvalidGeometryCount: invalidNodes.length,
      criticalEmptyOrInvalidGeometryCount: invalidNodes.filter((node) =>
        CRITICAL_MESH_NAMES.has(node.name ?? ''),
      ).length,
      selectionCutCount: skippedNodes.filter(
        (node) => node.skippedReason === 'selection_cut',
      ).length,
      missingSourceCount: skippedNodes.filter(
        (node) => node.skippedReason === 'missing_source',
      ).length,
    };
  }
}
