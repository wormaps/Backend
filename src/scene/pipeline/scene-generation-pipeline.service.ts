import { Injectable } from '@nestjs/common';
import { AppLoggerService } from '../../common/logging/app-logger.service';
import { SceneAssetProfileStep } from './steps/scene-asset-profile.step';
import { SceneFidelityPlanStep } from './steps/scene-fidelity-plan.step';
import { SceneGlbBuildStep } from './steps/scene-glb-build.step';
import { SceneGeometryCorrectionStep } from './steps/scene-geometry-correction.step';
import { SceneHeroOverrideStep } from './steps/scene-hero-override.step';
import { SceneMetaBuilderStep } from './steps/scene-meta-builder.step';
import { ScenePlacePackageStep } from './steps/scene-place-package.step';
import { ScenePlaceResolutionStep } from './steps/scene-place-resolution.step';
import { SceneVisualRulesStep } from './steps/scene-visual-rules.step';
import { SceneAtmosphereRecomputeService } from '../services/vision';
import { resolveSceneStaticAtmosphereProfile } from '../utils/scene-static-atmosphere.utils';
import type {
  SceneGenerationPipelineInput,
  SceneGenerationPipelineResult,
} from './scene-generation-pipeline.types';

@Injectable()
export class SceneGenerationPipelineService {
  constructor(
    private readonly scenePlaceResolutionStep: ScenePlaceResolutionStep,
    private readonly scenePlacePackageStep: ScenePlacePackageStep,
    private readonly sceneVisualRulesStep: SceneVisualRulesStep,
    private readonly sceneFidelityPlanStep: SceneFidelityPlanStep,
    private readonly sceneMetaBuilderStep: SceneMetaBuilderStep,
    private readonly sceneHeroOverrideStep: SceneHeroOverrideStep,
    private readonly sceneAtmosphereRecomputeService: SceneAtmosphereRecomputeService,
    private readonly sceneAssetProfileStep: SceneAssetProfileStep,
    private readonly sceneGeometryCorrectionStep: SceneGeometryCorrectionStep,
    private readonly sceneGlbBuildStep: SceneGlbBuildStep,
    private readonly appLoggerService: AppLoggerService,
  ) {}

  async execute(
    input: SceneGenerationPipelineInput,
  ): Promise<SceneGenerationPipelineResult> {
    const pipelineStartedAt = Date.now();
    const { sceneId, storedScene, logContext } = input;

    this.appLoggerService.info('scene.google_search.started', {
      ...logContext,
      provider: 'google_places',
      step: 'google_search',
      query: storedScene.query,
    });
    const resolvedPlace = await this.scenePlaceResolutionStep.execute(
      storedScene.query,
      storedScene.scale,
    );
    this.appLoggerService.info('scene.google_search.completed', {
      ...logContext,
      provider: 'google_places',
      step: 'google_search',
      candidateCount: resolvedPlace.candidateCount,
    });
    this.appLoggerService.info('scene.google_detail.completed', {
      ...logContext,
      provider: 'google_places',
      step: 'google_detail',
      placeId: resolvedPlace.place.placeId,
    });

    this.appLoggerService.info('scene.overpass.started', {
      ...logContext,
      provider: 'overpass',
      step: 'overpass',
      radiusM: resolvedPlace.radiusM,
      bounds: resolvedPlace.bounds,
    });
    const placePackage = await this.scenePlacePackageStep.execute(
      sceneId,
      storedScene.requestId ?? null,
      resolvedPlace.place,
      resolvedPlace.bounds,
    );
    this.appLoggerService.info('scene.overpass.completed', {
      ...logContext,
      provider: 'overpass',
      step: 'overpass',
      buildingCount: placePackage.buildings.length,
      roadCount: placePackage.roads.length,
      walkwayCount: placePackage.walkways.length,
      poiCount: placePackage.pois.length,
    });

    const vision = await this.sceneVisualRulesStep.execute(
      sceneId,
      resolvedPlace.place,
      resolvedPlace.bounds,
      placePackage,
    );
    this.appLoggerService.info('scene.mapillary.completed', {
      ...logContext,
      provider: 'mapillary',
      step: 'vision',
      mapillaryUsed: vision.detail.provenance.mapillaryUsed,
      imageCount: vision.detail.provenance.mapillaryImageCount,
      featureCount: vision.detail.provenance.mapillaryFeatureCount,
    });

    const fidelityPlan = await this.sceneFidelityPlanStep.execute(
      sceneId,
      resolvedPlace.place,
      storedScene.scale,
      placePackage,
      vision.detail,
    );

    const baseMeta = this.sceneMetaBuilderStep.buildBaseMeta(
      sceneId,
      storedScene.scale,
      resolvedPlace.radiusM,
      placePackage,
      resolvedPlace.place,
      resolvedPlace.bounds,
      vision.detail,
      vision.metaPatch,
      fidelityPlan,
    );
    vision.detail.fidelityPlan = fidelityPlan;
    const merged = this.sceneHeroOverrideStep.execute(
      resolvedPlace.place,
      baseMeta,
      vision.detail,
    );
    const recomputedAtmosphere = this.sceneAtmosphereRecomputeService.recompute(
      merged.meta,
      merged.detail,
    );
    const mergedWithAtmosphere = {
      meta: recomputedAtmosphere.meta,
      detail: recomputedAtmosphere.detail,
    };
    const finalFidelityPlan = await this.sceneFidelityPlanStep.execute(
      sceneId,
      resolvedPlace.place,
      storedScene.scale,
      placePackage,
      mergedWithAtmosphere.detail,
      'fidelity_plan_final',
    );
    mergedWithAtmosphere.detail.fidelityPlan = finalFidelityPlan;
    mergedWithAtmosphere.detail.staticAtmosphere =
      resolveSceneStaticAtmosphereProfile(mergedWithAtmosphere.detail);
    mergedWithAtmosphere.meta.fidelityPlan = finalFidelityPlan;
    this.appLoggerService.info('scene.atmosphere.recomputed', {
      ...logContext,
      step: 'atmosphere_recompute',
      districtProfileCount:
        mergedWithAtmosphere.detail.districtAtmosphereProfiles?.length ?? 0,
      sceneWideTone:
        mergedWithAtmosphere.detail.sceneWideAtmosphereProfile?.cityTone ??
        'balanced_mixed',
      staticAtmosphere:
        mergedWithAtmosphere.detail.staticAtmosphere?.preset ?? 'DAY_CLEAR',
    });
    this.appLoggerService.info('scene.hero_override.completed', {
      ...logContext,
      step: 'hero_override',
      overrideCount: mergedWithAtmosphere.detail.annotationsApplied.length,
    });

    const corrected = this.sceneGeometryCorrectionStep.execute(
      mergedWithAtmosphere.meta,
      mergedWithAtmosphere.detail,
    );

    const finalizedMeta = await this.sceneAssetProfileStep.execute(
      corrected.meta,
      corrected.detail,
      storedScene.scale,
    );
    this.appLoggerService.info('scene.glb_build.started', {
      ...logContext,
      step: 'glb_build',
      detailStatus: mergedWithAtmosphere.detail.detailStatus,
      geometryDiagnostics: corrected.detail.geometryDiagnostics,
      selected: finalizedMeta.assetProfile.selected,
    });
    const assetPath = await this.sceneGlbBuildStep.execute(
      finalizedMeta,
      corrected.detail,
      {
        pipelineMs: Date.now() - pipelineStartedAt,
      },
    );
    this.appLoggerService.info('scene.glb_build.completed', {
      ...logContext,
      step: 'glb_build',
      assetPath,
    });

    return {
      place: resolvedPlace.place,
      placePackage,
      meta: finalizedMeta,
      detail: corrected.detail,
      assetPath,
    };
  }
}
