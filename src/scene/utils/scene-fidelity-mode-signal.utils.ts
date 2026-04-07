import type { SceneFidelityMode } from '../types/scene.types';

export interface SceneFidelityModeSignal {
  budgetMultiplier: number;
  emissiveMultiplier: number;
  roadRoughnessMultiplier: number;
  wetRoadOffset: number;
  vegetationDensityOffset: number;
  vegetationDetailOffset: number;
  furnitureDetailOffset: number;
  furnitureVariantOffset: number;
}

const BASE_SIGNAL: SceneFidelityModeSignal = {
  budgetMultiplier: 1,
  emissiveMultiplier: 1,
  roadRoughnessMultiplier: 1,
  wetRoadOffset: 0,
  vegetationDensityOffset: 0,
  vegetationDetailOffset: 0,
  furnitureDetailOffset: 0,
  furnitureVariantOffset: 0,
};

export function resolveSceneFidelityModeSignal(
  targetMode?: SceneFidelityMode,
): SceneFidelityModeSignal {
  if (targetMode === 'REALITY_OVERLAY_READY') {
    return {
      budgetMultiplier: 1.2,
      emissiveMultiplier: 1.08,
      roadRoughnessMultiplier: 0.96,
      wetRoadOffset: 0.05,
      vegetationDensityOffset: 0.04,
      vegetationDetailOffset: 0.05,
      furnitureDetailOffset: 0.08,
      furnitureVariantOffset: 0.08,
    };
  }
  if (targetMode === 'LANDMARK_ENRICHED') {
    return {
      budgetMultiplier: 1.1,
      emissiveMultiplier: 1.04,
      roadRoughnessMultiplier: 0.98,
      wetRoadOffset: 0.02,
      vegetationDensityOffset: 0.02,
      vegetationDetailOffset: 0.03,
      furnitureDetailOffset: 0.05,
      furnitureVariantOffset: 0.05,
    };
  }
  if (targetMode === 'MATERIAL_ENRICHED') {
    return {
      budgetMultiplier: 1.03,
      emissiveMultiplier: 1.02,
      roadRoughnessMultiplier: 1,
      wetRoadOffset: 0.01,
      vegetationDensityOffset: 0.01,
      vegetationDetailOffset: 0.01,
      furnitureDetailOffset: 0.02,
      furnitureVariantOffset: 0.02,
    };
  }
  return BASE_SIGNAL;
}
