import type { SceneVariationProfile } from '../../compiler/scene-variation';
import type { SceneDetail, SceneMeta } from '../../../scene/types/scene.types';

export function resolveSceneVariationProfile(
  sceneMeta: SceneMeta,
  sceneDetail: SceneDetail,
): SceneVariationProfile {
  const selected = sceneMeta.assetProfile.selected;
  const budget = sceneMeta.assetProfile.budget;
  const vegetationCoverage =
    budget.treeClusterCount > 0
      ? selected.treeClusterCount / budget.treeClusterCount
      : 0;
  const furnitureCoverage =
    budget.streetLightCount + budget.signPoleCount > 0
      ? (selected.streetLightCount + selected.signPoleCount) /
        (budget.streetLightCount + budget.signPoleCount)
      : 0;

  const signageSignal = Math.min(
    1,
    sceneDetail.signageClusters.length /
      Math.max(10, selected.billboardPanelCount),
  );
  const vegetationSignal = Math.min(1, sceneDetail.vegetation.length / 80);

  return {
    vegetationDensityBoost: clamp(0.95 + vegetationCoverage * 0.25, 0.9, 1.2),
    vegetationDetailBoost: clamp(0.9 + vegetationSignal * 0.4, 0.9, 1.25),
    furnitureDetailBoost: clamp(0.9 + furnitureCoverage * 0.35, 0.9, 1.25),
    furnitureVariantBoost: clamp(0.9 + signageSignal * 0.35, 0.9, 1.25),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
