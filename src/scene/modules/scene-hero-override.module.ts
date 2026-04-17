import { Module } from '@nestjs/common';
import {
  SceneHeroOverrideApplierService,
  SceneHeroOverrideMatcherService,
  SceneHeroOverrideService,
} from '../services/hero-override';

@Module({
  providers: [
    SceneHeroOverrideMatcherService,
    SceneHeroOverrideApplierService,
    SceneHeroOverrideService,
  ],
  exports: [
    SceneHeroOverrideMatcherService,
    SceneHeroOverrideApplierService,
    SceneHeroOverrideService,
  ],
})
export class SceneHeroOverrideModule {}
