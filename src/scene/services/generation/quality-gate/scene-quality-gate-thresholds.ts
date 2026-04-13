import type {
  SceneFidelityPlan,
  SceneQualityGateThresholds,
} from '../../../types/scene.types';

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
