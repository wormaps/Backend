import { Module } from '@nestjs/common';
import { CacheModule } from '../cache/cache.module';
import { PlacesModule } from '../places/places.module';
import { GlbBuilderService } from '../assets/glb-builder.service';
import { SceneGenerationPipelineService } from './pipeline/scene-generation-pipeline.service';
import { SceneAssetProfileStep } from './pipeline/steps/scene-asset-profile.step';
import { SceneGlbBuildStep } from './pipeline/steps/scene-glb-build.step';
import { SceneHeroOverrideStep } from './pipeline/steps/scene-hero-override.step';
import { SceneMetaBuilderStep } from './pipeline/steps/scene-meta-builder.step';
import { ScenePlacePackageStep } from './pipeline/steps/scene-place-package.step';
import { ScenePlaceResolutionStep } from './pipeline/steps/scene-place-resolution.step';
import { SceneVisualRulesStep } from './pipeline/steps/scene-visual-rules.step';
import { SceneController } from './scene.controller';
import { SceneService } from './scene.service';
import { SceneHeroOverrideService } from './services/scene-hero-override.service';
import { SceneGenerationService } from './services/scene-generation.service';
import { SceneLiveDataService } from './services/scene-live-data.service';
import { SceneReadService } from './services/scene-read.service';
import { SceneVisionService } from './services/scene-vision.service';
import { SceneRepository } from './storage/scene.repository';

@Module({
  imports: [PlacesModule, CacheModule],
  controllers: [SceneController],
  providers: [
    GlbBuilderService,
    SceneRepository,
    SceneVisionService,
    SceneHeroOverrideService,
    ScenePlaceResolutionStep,
    ScenePlacePackageStep,
    SceneVisualRulesStep,
    SceneMetaBuilderStep,
    SceneHeroOverrideStep,
    SceneAssetProfileStep,
    SceneGlbBuildStep,
    SceneGenerationPipelineService,
    SceneReadService,
    SceneLiveDataService,
    SceneGenerationService,
    SceneService,
  ],
})
export class SceneModule {}
