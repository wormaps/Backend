import { Module } from '@nestjs/common';
import { CacheModule } from '../cache/cache.module';
import { PlacesModule } from '../places/places.module';
import { GlbBuilderService } from '../assets/glb-builder.service';
import { SceneGenerationPipelineService } from './pipeline/scene-generation-pipeline.service';
import { SceneAssetProfileStep } from './pipeline/steps/scene-asset-profile.step';
import { SceneFidelityPlanStep } from './pipeline/steps/scene-fidelity-plan.step';
import { SceneGlbBuildStep } from './pipeline/steps/scene-glb-build.step';
import { SceneHeroOverrideStep } from './pipeline/steps/scene-hero-override.step';
import { SceneMetaBuilderStep } from './pipeline/steps/scene-meta-builder.step';
import { ScenePlacePackageStep } from './pipeline/steps/scene-place-package.step';
import { ScenePlaceResolutionStep } from './pipeline/steps/scene-place-resolution.step';
import { SceneVisualRulesStep } from './pipeline/steps/scene-visual-rules.step';
import { SceneController } from './scene.controller';
import { SceneService } from './scene.service';
import { BuildingStyleResolverService } from './services/building-style-resolver.service';
import { SceneAssetProfileService } from './services/scene-asset-profile.service';
import { SceneFacadeVisionService } from './services/scene-facade-vision.service';
import { SceneFidelityPlannerService } from './services/scene-fidelity-planner.service';
import { SceneGeometryDiagnosticsService } from './services/scene-geometry-diagnostics.service';
import { SceneHeroOverrideApplierService } from './services/scene-hero-override-applier.service';
import { SceneHeroOverrideMatcherService } from './services/scene-hero-override-matcher.service';
import { SceneHeroOverrideService } from './services/scene-hero-override.service';
import { SceneGenerationService } from './services/scene-generation.service';
import { SceneLiveDataService } from './services/scene-live-data.service';
import { SceneRoadVisionService } from './services/scene-road-vision.service';
import { SceneReadService } from './services/scene-read.service';
import { SceneSignageVisionService } from './services/scene-signage-vision.service';
import { SceneStateLiveService } from './services/scene-state-live.service';
import { SceneTrafficLiveService } from './services/scene-traffic-live.service';
import { SceneVisionService } from './services/scene-vision.service';
import { SceneWeatherLiveService } from './services/scene-weather-live.service';
import { SceneRepository } from './storage/scene.repository';

@Module({
  imports: [PlacesModule, CacheModule],
  controllers: [SceneController],
  providers: [
    GlbBuilderService,
    SceneRepository,
    BuildingStyleResolverService,
    SceneAssetProfileService,
    SceneRoadVisionService,
    SceneFacadeVisionService,
    SceneFidelityPlannerService,
    SceneGeometryDiagnosticsService,
    SceneSignageVisionService,
    SceneHeroOverrideMatcherService,
    SceneHeroOverrideApplierService,
    SceneVisionService,
    SceneHeroOverrideService,
    ScenePlaceResolutionStep,
    ScenePlacePackageStep,
    SceneVisualRulesStep,
    SceneFidelityPlanStep,
    SceneMetaBuilderStep,
    SceneHeroOverrideStep,
    SceneAssetProfileStep,
    SceneGlbBuildStep,
    SceneGenerationPipelineService,
    SceneReadService,
    SceneStateLiveService,
    SceneWeatherLiveService,
    SceneTrafficLiveService,
    SceneLiveDataService,
    SceneGenerationService,
    SceneService,
  ],
})
export class SceneModule {}
