import { Module } from '@nestjs/common';
import { PlacesModule } from '../../places/places.module';
import { SceneAssetsModule } from './scene-assets.module';
import { SceneHeroOverrideModule } from './scene-hero-override.module';
import { ScenePlanningModule } from './scene-planning.module';
import { SceneVisionModule } from './scene-vision.module';
import { SceneTerrainModule } from './scene-terrain.module';
import { SceneAssetProfileStep } from '../pipeline/steps/scene-asset-profile.step';
import { SceneFidelityPlanStep } from '../pipeline/steps/scene-fidelity-plan.step';
import { SceneGlbBuildStep } from '../pipeline/steps/scene-glb-build.step';
import { SceneGeometryCorrectionStep } from '../pipeline/steps/scene-geometry-correction.step';
import { SceneGenerationPipelineService } from '../pipeline/scene-generation-pipeline.service';
import { SceneHeroOverrideStep } from '../pipeline/steps/scene-hero-override.step';
import { SceneMetaBuilderStep } from '../pipeline/steps/scene-meta-builder.step';
import { ScenePlacePackageStep } from '../pipeline/steps/scene-place-package.step';
import { ScenePlaceResolutionStep } from '../pipeline/steps/scene-place-resolution.step';
import { SceneVisualRulesStep } from '../pipeline/steps/scene-visual-rules.step';
import { SceneTerrainFusionStep } from '../pipeline/steps/scene-terrain-fusion.step';

@Module({
  imports: [
    PlacesModule,
    SceneAssetsModule,
    SceneHeroOverrideModule,
    ScenePlanningModule,
    SceneVisionModule,
    SceneTerrainModule,
  ],
  providers: [
    ScenePlaceResolutionStep,
    ScenePlacePackageStep,
    SceneVisualRulesStep,
    SceneFidelityPlanStep,
    SceneMetaBuilderStep,
    SceneHeroOverrideStep,
    SceneTerrainFusionStep,
    SceneAssetProfileStep,
    SceneGeometryCorrectionStep,
    SceneGlbBuildStep,
    SceneGenerationPipelineService,
  ],
  exports: [
    ScenePlaceResolutionStep,
    ScenePlacePackageStep,
    SceneVisualRulesStep,
    SceneFidelityPlanStep,
    SceneMetaBuilderStep,
    SceneHeroOverrideStep,
    SceneTerrainFusionStep,
    SceneAssetProfileStep,
    SceneGeometryCorrectionStep,
    SceneGlbBuildStep,
    SceneGenerationPipelineService,
  ],
})
export class ScenePipelineModule {}
