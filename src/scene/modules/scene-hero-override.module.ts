import { Module } from '@nestjs/common';
import {
  SceneHeroOverrideApplierService,
  SceneHeroOverrideMatcherService,
  SceneHeroOverrideService,
  SceneLandmarkApplierService,
  SceneFacadeHintMergerService,
  SceneCrossingDecalBuilderService,
  SceneSignageMergerService,
  SceneFurnitureMergerService,
  SceneHeroPromotionService,
} from '../services/hero-override';

@Module({
  providers: [
    SceneHeroOverrideMatcherService,
    SceneLandmarkApplierService,
    SceneFacadeHintMergerService,
    SceneCrossingDecalBuilderService,
    SceneSignageMergerService,
    SceneFurnitureMergerService,
    SceneHeroPromotionService,
    SceneHeroOverrideApplierService,
    SceneHeroOverrideService,
  ],
  exports: [
    SceneHeroOverrideMatcherService,
    SceneLandmarkApplierService,
    SceneFacadeHintMergerService,
    SceneCrossingDecalBuilderService,
    SceneSignageMergerService,
    SceneFurnitureMergerService,
    SceneHeroPromotionService,
    SceneHeroOverrideApplierService,
    SceneHeroOverrideService,
  ],
})
export class SceneHeroOverrideModule {}
