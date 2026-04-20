import type { SceneFidelityMode, SceneMeta, SceneScale } from '../../types/scene.types';
import { resolveSceneFidelityModeSignal } from '../../utils/scene-fidelity-mode-signal.utils';

export function resolveAssetBudget(
  scale: SceneScale,
): SceneMeta['assetProfile']['budget'] {
  if (scale === 'SMALL') {
    return {
      buildingCount: 300,
      roadCount: 220,
      walkwayCount: 300,
      poiCount: 140,
      crossingCount: 32,
      trafficLightCount: 24,
      streetLightCount: 36,
      signPoleCount: 48,
      treeClusterCount: 40,
      billboardPanelCount: 72,
    };
  }

  if (scale === 'LARGE') {
    return {
      buildingCount: 1800,
      roadCount: 900,
      walkwayCount: 1100,
      poiCount: 340,
      crossingCount: 140,
      trafficLightCount: 140,
      streetLightCount: 200,
      signPoleCount: 240,
      treeClusterCount: 160,
      billboardPanelCount: 280,
    };
  }

  return {
    buildingCount: 760,
    roadCount: 260,
    walkwayCount: 320,
    poiCount: 120,
    crossingCount: 156,
    trafficLightCount: 48,
    streetLightCount: 64,
    signPoleCount: 80,
    treeClusterCount: 56,
    billboardPanelCount: 72,
  };
}

export function resolveAdaptiveAssetBudget(
  baseBudget: SceneMeta['assetProfile']['budget'],
  targetMode?: SceneFidelityMode,
  sceneMeta?: SceneMeta,
): SceneMeta['assetProfile']['budget'] {
  let scaledBudget = baseBudget;

  if (targetMode) {
    const multiplier = resolveSceneFidelityModeSignal(targetMode).budgetMultiplier;
    const isLandmarkTarget = targetMode === 'LANDMARK_ENRICHED';
    const targetMultiplier = isLandmarkTarget ? 1.1 : multiplier;
    if (targetMultiplier !== 1) {
      scaledBudget = {
        buildingCount: scaleCount(baseBudget.buildingCount, targetMultiplier),
        roadCount: scaleCount(baseBudget.roadCount, targetMultiplier),
        walkwayCount: scaleCount(baseBudget.walkwayCount, targetMultiplier),
        poiCount: scaleCount(baseBudget.poiCount, targetMultiplier),
        crossingCount: scaleCount(baseBudget.crossingCount, targetMultiplier),
        trafficLightCount: scaleCount(
          baseBudget.trafficLightCount,
          targetMultiplier * (isLandmarkTarget ? 1.14 : 1),
        ),
        streetLightCount: scaleCount(
          baseBudget.streetLightCount,
          targetMultiplier * (isLandmarkTarget ? 1.18 : 1),
        ),
        signPoleCount: scaleCount(
          baseBudget.signPoleCount,
          targetMultiplier * (isLandmarkTarget ? 1.2 : 1),
        ),
        treeClusterCount: scaleCount(
          baseBudget.treeClusterCount,
          targetMultiplier,
        ),
        billboardPanelCount: scaleCount(
          baseBudget.billboardPanelCount,
          targetMultiplier * (isLandmarkTarget ? 1.16 : 1),
        ),
      };

      if (isLandmarkTarget) {
        const boostedCrossingFloor = Math.max(
          scaledBudget.crossingCount,
          Math.round(baseBudget.crossingCount * 1.38),
        );
        scaledBudget = {
          ...scaledBudget,
          crossingCount: boostedCrossingFloor,
        };
      }
    }
  }

  if (!sceneMeta) {
    return scaledBudget;
  }

  return applyDensityRecoveryFloor(sceneMeta, scaledBudget);
}

function applyDensityRecoveryFloor(
  sceneMeta: SceneMeta,
  budget: SceneMeta['assetProfile']['budget'],
): SceneMeta['assetProfile']['budget'] {
  const floorRatio = 0.56;
  const walkwayFloorRatio = 0.52;
  const buildingCountFloor = Math.max(
    budget.buildingCount,
    Math.round(sceneMeta.buildings.length * floorRatio),
  );
  const roadCountFloor = Math.max(
    budget.roadCount,
    Math.round(sceneMeta.roads.length * floorRatio),
  );
  const walkwayCountFloor = Math.max(
    budget.walkwayCount,
    Math.round(sceneMeta.walkways.length * walkwayFloorRatio),
  );
  const poiCountFloor = Math.max(
    budget.poiCount,
    Math.round(sceneMeta.pois.length * 0.16),
  );

  return {
    ...budget,
    buildingCount: buildingCountFloor,
    roadCount: roadCountFloor,
    walkwayCount: walkwayCountFloor,
    poiCount: poiCountFloor,
  };
}

function scaleCount(value: number, multiplier: number): number {
  return Math.max(1, Math.round(value * multiplier));
}
