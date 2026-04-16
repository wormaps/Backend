import { Module } from '@nestjs/common';
import { CacheModule } from '../cache/cache.module';
import { MetricsModule } from '../common/metrics/metrics.module';
import { PlacesModule } from '../places/places.module';
import { GlbBuilderService } from '../assets/glb-builder.service';
import { GlbBuildRunner } from '../assets/internal/glb-build';
import { SceneGenerationPipelineService } from './pipeline/scene-generation-pipeline.service';
import { SceneAssetProfileStep } from './pipeline/steps/scene-asset-profile.step';
import { SceneFidelityPlanStep } from './pipeline/steps/scene-fidelity-plan.step';
import { SceneGlbBuildStep } from './pipeline/steps/scene-glb-build.step';
import { SceneGeometryCorrectionStep } from './pipeline/steps/scene-geometry-correction.step';
import { SceneHeroOverrideStep } from './pipeline/steps/scene-hero-override.step';
import { SceneMetaBuilderStep } from './pipeline/steps/scene-meta-builder.step';
import { ScenePlacePackageStep } from './pipeline/steps/scene-place-package.step';
import { ScenePlaceResolutionStep } from './pipeline/steps/scene-place-resolution.step';
import { SceneVisualRulesStep } from './pipeline/steps/scene-visual-rules.step';
import { SceneController } from './scene.controller';
import { SceneService } from './scene.service';
import {
  CuratedAssetResolverService,
  BuildingStyleResolverService,
  SceneAtmosphereRecomputeService,
  SceneAssetProfileService,
  SceneFacadeVisionService,
  SceneFidelityPlannerService,
  SceneGenerationService,
  SceneQualityGateService,
  SceneMidQaService,
  SceneGeometryDiagnosticsService,
  SceneHeroOverrideApplierService,
  SceneHeroOverrideMatcherService,
  SceneHeroOverrideService,
  SceneLiveDataService,
  SceneReadService,
  SceneRoadVisionService,
  SceneSignageVisionService,
  SceneStateLiveService,
  SceneTrafficLiveService,
  SceneTerrainProfileService,
  SceneTwinBuilderService,
  SceneVisionService,
  SceneWeatherLiveService,
} from './services';
import { SceneRepository } from './storage/scene.repository';

@Module({
  imports: [PlacesModule, CacheModule, MetricsModule],
  controllers: [SceneController],
  providers: [
    GlbBuilderService,
    GlbBuildRunner,
    SceneRepository,
    BuildingStyleResolverService,
    SceneAssetProfileService,
    SceneRoadVisionService,
    SceneFacadeVisionService,
    SceneAtmosphereRecomputeService,
    CuratedAssetResolverService,
    SceneFidelityPlannerService,
    SceneQualityGateService,
    SceneMidQaService,
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
    SceneGeometryCorrectionStep,
    SceneGlbBuildStep,
    SceneGenerationPipelineService,
    SceneReadService,
    SceneStateLiveService,
    SceneWeatherLiveService,
    SceneTrafficLiveService,
    SceneLiveDataService,
    SceneGenerationService,
    SceneTerrainProfileService,
    SceneTwinBuilderService,
    SceneService,
  ],
})
export class SceneModule {}
