export interface SceneVariationProfile {
  vegetationDensityBoost: number;
  vegetationDetailBoost: number;
  furnitureDetailBoost: number;
  furnitureVariantBoost: number;
}

export const DEFAULT_SCENE_VARIATION_PROFILE: SceneVariationProfile = {
  vegetationDensityBoost: 1,
  vegetationDetailBoost: 1,
  furnitureDetailBoost: 1,
  furnitureVariantBoost: 1,
};
