import { Injectable } from '@nestjs/common';
import { AppLoggerService } from '../../../common/logging/app-logger.service';
import { appMetrics } from '../../../common/metrics/metrics.instance';
import { SceneGenerationPipelineService } from '../../pipeline/scene-generation-pipeline.service';
import { SceneQualityGateService } from './scene-quality-gate.service';
import { SceneMidQaService } from '../qa';
import { SceneTwinBuilderService } from '../twin';
import { SceneSnapshotService } from './scene-snapshot.service';
import { SceneGenerationResultService } from './scene-generation-result.service';
import { SceneFailureHandlerService } from './scene-failure-handler.service';
import { SceneRepository } from '../../storage/scene.repository';
import type { StoredScene } from '../../types/scene.types';

@Injectable()
export class SceneGenerationExecutorService {
  constructor(
    private readonly sceneRepository: SceneRepository,
    private readonly sceneGenerationPipelineService: SceneGenerationPipelineService,
    private readonly sceneQualityGateService: SceneQualityGateService,
    private readonly sceneMidQaService: SceneMidQaService,
    private readonly sceneTwinBuilderService: SceneTwinBuilderService,
    private readonly snapshotService: SceneSnapshotService,
    private readonly resultService: SceneGenerationResultService,
    private readonly failureHandler: SceneFailureHandlerService,
    private readonly appLoggerService: AppLoggerService,
  ) {}

  async execute(sceneId: string): Promise<void> {
    const storedScene = await this.getStoredScene(sceneId);
    const logContext = {
      requestId: storedScene.requestId ?? null,
      sceneId,
      source: storedScene.generationSource ?? 'api',
    };
    const startedAt = Date.now();
    try {
      const result = await this.sceneGenerationPipelineService.execute({
        sceneId,
        storedScene,
        logContext,
      });
      const qualityGate = await this.sceneQualityGateService.evaluate(
        result.meta,
        result.detail,
      );
      const { snapshot: weatherSnapshot, observation: weatherObserved } =
        await this.snapshotService.buildWeatherSnapshot(
          result.place,
          result.meta.generatedAt.slice(0, 10),
          storedScene.requestId ?? null,
        );
      const { snapshot: trafficSnapshot, observation: trafficObserved } =
        await this.snapshotService.buildTrafficSnapshot(
          result.meta.roads.map((road) => ({
            objectId: road.objectId,
            center: road.center,
          })),
          storedScene.requestId ?? null,
        );
      const twinBuild = await this.sceneTwinBuilderService.build({
        sceneId,
        query: storedScene.query,
        scale: storedScene.scale,
        place: result.place,
        placePackage: result.placePackage,
        meta: { ...result.meta, qualityGate },
        detail: { ...result.detail, qualityGate },
        assetPath: result.assetPath,
        qualityGate,
        providerTraces: result.providerTraces,
        weatherSnapshot,
        trafficSnapshot,
        liveStateEnvelopes: {
          weather: weatherObserved.upstreamEnvelopes,
          traffic: trafficObserved.upstreamEnvelopes,
        },
      });
      const qa = await this.sceneMidQaService.buildReport({
        sceneId,
        meta: { ...result.meta, qualityGate },
        detail: { ...result.detail, qualityGate },
        twin: twinBuild.twin,
        validation: twinBuild.validation,
      });
      const qualityPass = qualityGate.state === 'PASS';

      await this.resultService.persist({
        sceneId,
        storedScene,
        result,
        qualityGate,
        twinBuild,
        qa,
        weatherSnapshot,
        weatherObserved,
        trafficSnapshot,
        trafficObserved,
        qualityPass,
        startedAt,
      });
    } catch (error) {
      this.appLoggerService.error('scene.generation.failed', {
        requestId: storedScene.requestId ?? null,
        sceneId,
        source: storedScene.generationSource ?? 'api',
        step: 'generation',
        error,
      });
      await this.failureHandler.handleGenerationFailure(
        sceneId,
        storedScene,
        error,
      );
      appMetrics.incrementCounter(
        'scene_generation_total',
        1,
        { outcome: 'failure' },
        'Total scene generation results by outcome.',
      );
      appMetrics.observeDuration(
        'scene_generation_duration_ms',
        Date.now() - startedAt,
        { outcome: 'failure' },
        'Scene generation duration in milliseconds.',
      );
    }
  }

  private async getStoredScene(sceneId: string): Promise<StoredScene> {
    const storedScene = await this.sceneRepository.findById(sceneId);
    if (!storedScene) {
      throw new Error(`Scene not found: ${sceneId}`);
    }
    return storedScene;
  }
}
