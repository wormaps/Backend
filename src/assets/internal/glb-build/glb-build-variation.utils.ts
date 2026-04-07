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
  const districtInfluence = resolveDistrictVariationInfluence(sceneDetail);

  return {
    vegetationDensityBoost: clamp(
      0.95 +
        vegetationCoverage * 0.25 +
        districtInfluence.vegetationDensityBoost,
      0.9,
      1.25,
    ),
    vegetationDetailBoost: clamp(
      0.9 + vegetationSignal * 0.4 + districtInfluence.vegetationDetailBoost,
      0.9,
      1.28,
    ),
    furnitureDetailBoost: clamp(
      0.9 + furnitureCoverage * 0.35 + districtInfluence.furnitureDetailBoost,
      0.9,
      1.28,
    ),
    furnitureVariantBoost: clamp(
      0.9 + signageSignal * 0.35 + districtInfluence.furnitureVariantBoost,
      0.9,
      1.28,
    ),
  };
}

function resolveDistrictVariationInfluence(sceneDetail: SceneDetail): {
  vegetationDensityBoost: number;
  vegetationDetailBoost: number;
  furnitureDetailBoost: number;
  furnitureVariantBoost: number;
} {
  const districtProfiles = sceneDetail.districtAtmosphereProfiles ?? [];
  if (districtProfiles.length === 0) {
    return {
      vegetationDensityBoost: 0,
      vegetationDetailBoost: 0,
      furnitureDetailBoost: 0,
      furnitureVariantBoost: 0,
    };
  }

  let vegetationBoost = 0;
  let vegetationDetailBoost = 0;
  let furnitureDetailBoost = 0;
  let furnitureVariantBoost = 0;

  for (const profile of districtProfiles) {
    const weight = clamp(profile.confidence, 0.3, 1);
    if (
      profile.vegetationProfile === 'dense_tree_line' ||
      profile.vegetationProfile === 'forest_edge'
    ) {
      vegetationBoost += 0.12 * weight;
      vegetationDetailBoost += 0.08 * weight;
    }
    if (profile.vegetationProfile === 'urban_minimal_green') {
      vegetationBoost -= 0.06 * weight;
    }
    if (
      profile.streetAtmosphere === 'nightlife_dense' ||
      profile.streetAtmosphere === 'dense_signage' ||
      profile.streetAtmosphere === 'station_busy'
    ) {
      furnitureVariantBoost += 0.09 * weight;
      furnitureDetailBoost += 0.06 * weight;
    }
    if (profile.streetAtmosphere === 'industrial_sparse') {
      furnitureVariantBoost -= 0.04 * weight;
    }
  }

  const divisor = districtProfiles.length;
  return {
    vegetationDensityBoost: vegetationBoost / divisor,
    vegetationDetailBoost: vegetationDetailBoost / divisor,
    furnitureDetailBoost: furnitureDetailBoost / divisor,
    furnitureVariantBoost: furnitureVariantBoost / divisor,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
