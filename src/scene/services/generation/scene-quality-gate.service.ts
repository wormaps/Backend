import { Injectable } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { AppLoggerService } from '../../../common/logging/app-logger.service';
import {
  SceneDetail,
  SceneMeta,
  SceneOracleApprovalStatus,
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
  'building_roof_surfaces_cool',
  'building_roof_surfaces_warm',
  'building_roof_surfaces_neutral',
  'building_roof_accents_cool',
  'building_roof_accents_warm',
  'building_roof_accents_neutral',
]);
const CRITICAL_MESH_PREFIXES = ['building_shells_'];
const COLLISION_RATIO_HARD_FAIL_THRESHOLD = 0.015;

interface ParsedDiagnosticsEntry {
  stage?: string;
  meshNodes?: Array<{
    name?: string;
    skipped?: boolean;
    skippedReason?: string;
  }>;
}

interface GeometryDiagnosticsShape {
  collisionRiskCount?: number;
  groundedGapCount?: number;
  openShellCount?: number;
  roofWallGapCount?: number;
  invalidSetbackJoinCount?: number;
}
type SceneGeometryDiagnosticWithCorrection = {
  objectId?: string;
  collisionRiskCount?: number;
  groundedGapCount?: number;
  openShellCount?: number;
  roofWallGapCount?: number;
  invalidSetbackJoinCount?: number;
};

interface OracleApprovalFilePayload {
  state?: 'APPROVED' | 'REJECTED';
  approvedBy?: string;
  approvedAt?: string;
  note?: string;
}

@Injectable()
export class SceneQualityGateService {
  constructor(
    private readonly appLoggerService: AppLoggerService = new AppLoggerService(),
  ) {}

  async evaluate(
    sceneMeta: SceneMeta,
    sceneDetail: SceneDetail,
  ): Promise<SceneQualityGateResult> {
    const fidelityPlan = sceneDetail.fidelityPlan ?? sceneMeta.fidelityPlan;
    const thresholds = this.resolveThresholds(fidelityPlan?.phase);
    const oracleApproval = await this.resolveOracleApproval(
      sceneMeta.sceneId,
      fidelityPlan?.phase,
    );
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
    if (
      this.hasCriticalCollision(
        sceneDetail.geometryDiagnostics,
        sceneMeta.buildings.length,
      )
    ) {
      reasonCodes.push('CRITICAL_COLLISION_DETECTED');
    }
    if (this.hasCriticalGroundingGap(sceneDetail.geometryDiagnostics)) {
      reasonCodes.push('CRITICAL_GROUNDING_GAP_DETECTED');
    }
    if (this.hasCriticalShellClosure(sceneDetail.geometryDiagnostics)) {
      reasonCodes.push('CRITICAL_SHELL_CLOSURE_DETECTED');
    }
    if (this.hasCriticalRoofWallGap(sceneDetail.geometryDiagnostics)) {
      reasonCodes.push('CRITICAL_ROOF_WALL_GAP_DETECTED');
    }
    if (oracleApproval.required && oracleApproval.state !== 'APPROVED') {
      reasonCodes.push('ORACLE_APPROVAL_REQUIRED');
    }
    if (meshSummary.totalSkipped > thresholds.maxSkippedMeshesWarn) {
      reasonCodes.push('MESH_SKIPPED_COUNT_ABOVE_WARN_MAX');
    }
    if (meshSummary.missingSourceCount > thresholds.maxMissingSourceWarn) {
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
      geometryMarker: this.findGeometryCorrectionDiagnostics(
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
      thresholds,
      meshSummary,
      artifactRefs,
      oracleApproval,
      decidedAt: new Date().toISOString(),
    };
  }

  private resolveThresholds(
    phase?:
      | 'PHASE_1_BASELINE'
      | 'PHASE_2_HYBRID_FOUNDATION'
      | 'PHASE_3_PRODUCTION_LOCK',
  ): SceneQualityGateThresholds {
    if (phase === 'PHASE_3_PRODUCTION_LOCK') {
      return {
        coverageGapMax: 0,
        overallMin: 0.78,
        structureMin: 0.68,
        placeReadabilityMin: 0.45,
        modeDeltaOverallMin: 0,
        criticalPolygonBudgetExceededMax: 0,
        criticalInvalidGeometryMax: 0,
        maxSkippedMeshesWarn: 80,
        maxMissingSourceWarn: 20,
      };
    }

    if (phase === 'PHASE_2_HYBRID_FOUNDATION') {
      return {
        coverageGapMax: 0,
        overallMin: 0.7,
        structureMin: 0.62,
        placeReadabilityMin: 0.35,
        modeDeltaOverallMin: 0,
        criticalPolygonBudgetExceededMax: 0,
        criticalInvalidGeometryMax: 0,
        maxSkippedMeshesWarn: 120,
        maxMissingSourceWarn: 32,
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
      maxSkippedMeshesWarn: 180,
      maxMissingSourceWarn: 48,
    };
  }

  private async resolveOracleApproval(
    sceneId: string,
    phase?:
      | 'PHASE_1_BASELINE'
      | 'PHASE_2_HYBRID_FOUNDATION'
      | 'PHASE_3_PRODUCTION_LOCK',
  ): Promise<SceneOracleApprovalStatus> {
    if (phase !== 'PHASE_3_PRODUCTION_LOCK') {
      return {
        required: false,
        state: 'NOT_REQUIRED',
        source: 'auto',
      };
    }

    const approvalFilePath = join(
      getSceneDataDir(),
      `${sceneId}.oracle-approval.json`,
    );

    let raw = '';
    try {
      raw = await readFile(approvalFilePath, 'utf8');
    } catch {
      return {
        required: true,
        state: 'PENDING',
        source: 'approval_file',
        approvalFilePath,
        note: 'Oracle approval file is missing.',
      };
    }

    let parsed: OracleApprovalFilePayload | null = null;
    try {
      parsed = JSON.parse(raw) as OracleApprovalFilePayload;
    } catch {
      return {
        required: true,
        state: 'PENDING',
        source: 'approval_file',
        approvalFilePath,
        note: 'Oracle approval file is not valid JSON.',
      };
    }

    if (parsed?.state === 'APPROVED') {
      return {
        required: true,
        state: 'APPROVED',
        source: 'approval_file',
        approvalFilePath,
        approvedBy: parsed.approvedBy,
        approvedAt: parsed.approvedAt,
        note: parsed.note,
      };
    }

    if (parsed?.state === 'REJECTED') {
      return {
        required: true,
        state: 'REJECTED',
        source: 'approval_file',
        approvalFilePath,
        approvedBy: parsed.approvedBy,
        approvedAt: parsed.approvedAt,
        note: parsed.note,
      };
    }

    return {
      required: true,
      state: 'PENDING',
      source: 'approval_file',
      approvalFilePath,
      note: 'Oracle approval state must be APPROVED or REJECTED.',
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
      (node) =>
        node.skippedReason === 'polygon_budget_exceeded' ||
        node.skippedReason === 'polygon_budget_reserved_for_critical',
    );
    const invalidNodes = skippedNodes.filter(
      (node) => node.skippedReason === 'empty_or_invalid_geometry',
    );

    return {
      totalSkipped: skippedNodes.length,
      polygonBudgetExceededCount: polygonBudgetNodes.length,
      criticalPolygonBudgetExceededCount: polygonBudgetNodes.filter((node) =>
        this.isCriticalMeshNode(node.name),
      ).length,
      emptyOrInvalidGeometryCount: invalidNodes.length,
      criticalEmptyOrInvalidGeometryCount: invalidNodes.filter((node) =>
        this.isCriticalMeshNode(node.name),
      ).length,
      selectionCutCount: skippedNodes.filter(
        (node) => node.skippedReason === 'selection_cut',
      ).length,
      missingSourceCount: skippedNodes.filter(
        (node) => node.skippedReason === 'missing_source',
      ).length,
    };
  }

  private hasCriticalCollision(
    geometryDiagnostics: SceneDetail['geometryDiagnostics'] | undefined,
    totalBuildingCount: number,
  ): boolean {
    const marker = this.findGeometryCorrectionDiagnostics(geometryDiagnostics);
    const collisionCount = marker?.collisionRiskCount ?? 0;
    if (collisionCount === 0) {
      return false;
    }
    const denominator = Math.max(1, totalBuildingCount);
    return collisionCount / denominator >= COLLISION_RATIO_HARD_FAIL_THRESHOLD;
  }

  private hasCriticalGroundingGap(
    geometryDiagnostics: SceneDetail['geometryDiagnostics'] | undefined,
  ): boolean {
    const marker = this.findGeometryCorrectionDiagnostics(geometryDiagnostics);
    return (marker?.groundedGapCount ?? 0) > 0;
  }

  private hasCriticalShellClosure(
    geometryDiagnostics: SceneDetail['geometryDiagnostics'] | undefined,
  ): boolean {
    const marker = this.findGeometryCorrectionDiagnostics(geometryDiagnostics);
    const openShellCount = marker?.openShellCount ?? 0;
    const invalidSetbackJoinCount = marker?.invalidSetbackJoinCount ?? 0;
    return openShellCount > 0 || invalidSetbackJoinCount > 0;
  }

  private hasCriticalRoofWallGap(
    geometryDiagnostics: SceneDetail['geometryDiagnostics'] | undefined,
  ): boolean {
    const marker = this.findGeometryCorrectionDiagnostics(geometryDiagnostics);
    return (marker?.roofWallGapCount ?? 0) > 0;
  }

  private isCriticalMeshNode(name?: string): boolean {
    if (!name) {
      return false;
    }
    if (CRITICAL_MESH_NAMES.has(name)) {
      return true;
    }
    return CRITICAL_MESH_PREFIXES.some((prefix) => name.startsWith(prefix));
  }

  private findGeometryCorrectionDiagnostics(
    geometryDiagnostics: SceneDetail['geometryDiagnostics'] | undefined,
  ): GeometryDiagnosticsShape | null {
    if (!geometryDiagnostics || geometryDiagnostics.length === 0) {
      return null;
    }
    const marker = geometryDiagnostics.find(
      (item) => item.objectId === '__geometry_correction__',
    ) as SceneGeometryDiagnosticWithCorrection | null;
    if (!marker) {
      return null;
    }
    return {
      collisionRiskCount: marker.collisionRiskCount,
      groundedGapCount: marker.groundedGapCount,
      openShellCount: marker.openShellCount,
      roofWallGapCount: marker.roofWallGapCount,
      invalidSetbackJoinCount: marker.invalidSetbackJoinCount,
    };
  }
}
