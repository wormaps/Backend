import type {
  SceneFidelityPlan,
  SceneQualityGateThresholds,
} from '../../../types/scene.types';

const ADAPTIVE_SKIPPED_WARN_RATIO = 0.12;
const ADAPTIVE_MISSING_SOURCE_WARN_RATIO = 0.012;

export function shouldEnforceCriticalGeometryForPhase(
  phase?: SceneFidelityPlan['phase'],
): boolean {
  return phase !== 'PHASE_1_BASELINE';
}

export function resolveSceneQualityGateThresholds(
  phase?: SceneFidelityPlan['phase'],
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

export function resolveAdaptiveMeshWarnThresholds(input: {
  thresholds: Pick<
    SceneQualityGateThresholds,
    'maxSkippedMeshesWarn' | 'maxMissingSourceWarn'
  >;
  totalMeshNodeCount?: number;
}): Pick<SceneQualityGateThresholds, 'maxSkippedMeshesWarn' | 'maxMissingSourceWarn'> {
  const totalMeshNodeCount = Math.max(0, Math.floor(input.totalMeshNodeCount ?? 0));
  const scaledSkippedWarn = Math.ceil(
    totalMeshNodeCount * ADAPTIVE_SKIPPED_WARN_RATIO,
  );
  const scaledMissingSourceWarn = Math.ceil(
    totalMeshNodeCount * ADAPTIVE_MISSING_SOURCE_WARN_RATIO,
  );

  return {
    maxSkippedMeshesWarn: Math.max(
      input.thresholds.maxSkippedMeshesWarn,
      scaledSkippedWarn,
    ),
    maxMissingSourceWarn: Math.max(
      input.thresholds.maxMissingSourceWarn,
      scaledMissingSourceWarn,
    ),
  };
}
