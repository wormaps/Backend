import { HttpStatus, Injectable, OnApplicationShutdown } from '@nestjs/common';
import { access } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { ERROR_CODES } from '../../../common/constants/error-codes';
import { AppException } from '../../../common/errors/app.exception';
import { AppLoggerService } from '../../../common/logging/app-logger.service';
import { appMetrics } from '../../../common/metrics/metrics.instance';
import { isFiniteCoordinate } from '../../../places/utils/geo.utils';
import { SceneGenerationPipelineService } from '../../pipeline/scene-generation-pipeline.service';
import { SceneRepository } from '../../storage/scene.repository';
import { getSceneDataDir } from '../../storage/scene-storage.utils';
import { SceneQualityGateService } from './scene-quality-gate.service';
import { SceneMidQaService } from '../qa';
import { SceneTwinBuilderService } from '../twin';
import { SceneQueueManagerService } from './scene-queue-manager.service';
import { SceneFailureHandlerService } from './scene-failure-handler.service';
import { SceneSnapshotService } from './scene-snapshot.service';
import type {
  SceneCreateOptions,
  SceneEntity,
  SceneScale,
  StoredScene,
} from '../../types/scene.types';

@Injectable()
export class SceneGenerationService implements OnApplicationShutdown {
  private readonly pendingCreateScenes = new Map<string, Promise<SceneEntity>>();

  constructor(
    private readonly sceneRepository: SceneRepository,
    private readonly sceneGenerationPipelineService: SceneGenerationPipelineService,
    private readonly sceneQualityGateService: SceneQualityGateService,
    private readonly sceneMidQaService: SceneMidQaService,
    private readonly sceneTwinBuilderService: SceneTwinBuilderService,
    private readonly queueManager: SceneQueueManagerService,
    private readonly failureHandler: SceneFailureHandlerService,
    private readonly snapshotService: SceneSnapshotService,
    private readonly appLoggerService: AppLoggerService,
  ) {}

  async createScene(
    query: string,
    scale: SceneScale,
    options: SceneCreateOptions = {},
  ): Promise<SceneEntity> {
    if (this.queueManager.isShuttingDownFlag) {
      throw new AppException({
        code: ERROR_CODES.SERVER_SHUTTING_DOWN,
        message: '서버 종료 중에는 Scene 생성을 시작할 수 없습니다.',
        detail: {
          reason: 'SERVER_SHUTTING_DOWN',
        },
        status: HttpStatus.SERVICE_UNAVAILABLE,
      });
    }

    const requestKey = this.buildRequestKey(query, scale);
    if (!options.forceRegenerate) {
      const pending = this.pendingCreateScenes.get(requestKey);
      if (pending) {
        return pending;
      }
    }

    const createPromise = (async () => {
      if (!options.forceRegenerate) {
        const existing = await this.sceneRepository.findByRequestKey(requestKey);
        if (
          existing &&
          existing.scene.status !== 'FAILED' &&
          (await this.isReusableScene(existing))
        ) {
          this.appLoggerService.info('scene.reused', {
            requestId: options.requestId,
            sceneId: existing.scene.sceneId,
            source: options.source ?? 'api',
            step: 'reuse',
            query,
            scale,
          });
          return existing.scene;
        }
      }

      const sceneId = this.buildSceneId(query, options.forceRegenerate);
      const createdAt = new Date().toISOString();
      const scene: SceneEntity = {
        sceneId,
        placeId: null,
        name: query,
        centerLat: 0,
        centerLng: 0,
        radiusM: this.resolveRadius(scale),
        status: 'PENDING',
        metaUrl: `/api/scenes/${sceneId}/meta`,
        assetUrl: null,
        createdAt,
        updatedAt: createdAt,
        failureReason: null,
      };

      await this.sceneRepository.save(
        {
          requestKey,
          query,
          scale,
          generationSource: options.source ?? 'api',
          requestId: options.requestId ?? null,
          curatedAssetPayload: options.curatedAssetPayload,
          attempts: 0,
          scene,
        },
        requestKey,
      );
      this.appLoggerService.info('scene.queued', {
        requestId: options.requestId,
        sceneId,
        source: options.source ?? 'api',
        step: 'queue',
        query,
        scale,
        forceRegenerate: options.forceRegenerate ?? false,
      });
      this.queueManager.enqueue(sceneId);
      void this.processQueue();

      return scene;
    })();

    if (!options.forceRegenerate) {
      this.pendingCreateScenes.set(requestKey, createPromise);
    }

    try {
      return await createPromise;
    } finally {
      if (this.pendingCreateScenes.get(requestKey) === createPromise) {
        this.pendingCreateScenes.delete(requestKey);
      }
    }
  }

  async waitForIdle(): Promise<void> {
    while (this.queueManager.processingFlag || this.queueManager.queue.length > 0) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  getQueueDebugSnapshot() {
    return this.queueManager.getDebugSnapshot();
  }

  getRecentFailures(limit = 10) {
    return this.queueManager.getRecentFailures(limit);
  }

  async onApplicationShutdown(): Promise<void> {
    this.queueManager.isShuttingDownFlag = true;

    await Promise.race([
      this.waitForIdle(),
      new Promise((resolve) => setTimeout(resolve, 30000)),
    ]);

    const pending = new Set<string>(this.queueManager.queue);
    if (this.queueManager.currentProcessingId) {
      pending.add(this.queueManager.currentProcessingId);
    }

    await Promise.all(
      [...pending].map((sceneId) => this.failSceneIfUnfinished(sceneId)),
    );
  }

  private async failSceneIfUnfinished(sceneId: string): Promise<void> {
    const updated = await this.sceneRepository.update(sceneId, (current) => {
      if (
        current.scene.status === 'READY' ||
        current.scene.status === 'FAILED'
      ) {
        return current;
      }

      return {
        ...current,
        scene: {
          ...current.scene,
          status: 'FAILED',
          failureReason:
            current.scene.failureReason ??
            'Server shutdown interrupted scene generation.',
          failureCategory: current.scene.failureCategory ?? 'GENERATION_ERROR',
          updatedAt: new Date().toISOString(),
        },
      };
    });

    if (
      updated?.scene.status === 'FAILED' &&
      updated.scene.failureReason &&
      updated.scene.failureCategory
    ) {
      this.queueManager.recordFailure({
        sceneId,
        attempts: updated.attempts,
        failureCategory: updated.scene.failureCategory,
        failureReason: updated.scene.failureReason,
        updatedAt: updated.scene.updatedAt,
      });
    }
  }

  private async processQueue(): Promise<void> {
    if (this.queueManager.processingFlag) {
      return;
    }

    this.queueManager.processingFlag = true;
    try {
      while (this.queueManager.queue.length > 0) {
        const sceneId = await this.queueManager.dequeue();
        if (!sceneId) {
          continue;
        }
        const lockAcquired = await this.queueManager.acquireLock(sceneId);
        if (!lockAcquired) {
          this.appLoggerService.warn('scene.generation.lock_skipped', {
            sceneId,
            step: 'queue',
          });
          this.queueManager.recordMetrics();
          continue;
        }

        this.queueManager.currentProcessingId = sceneId;
        this.queueManager.recordMetrics();
        try {
          await this.processGeneration(sceneId);
        } finally {
          this.queueManager.currentProcessingId = null;
          await this.queueManager.releaseLock(sceneId);
          this.queueManager.recordMetrics();
        }
      }
    } finally {
      this.queueManager.currentProcessingId = null;
      this.queueManager.processingFlag = false;
      this.queueManager.recordMetrics();
    }
  }

  private async processGeneration(sceneId: string): Promise<void> {
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
        meta: {
          ...result.meta,
          qualityGate,
        },
        detail: {
          ...result.detail,
          qualityGate,
        },
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
        meta: {
          ...result.meta,
          qualityGate,
        },
        detail: {
          ...result.detail,
          qualityGate,
        },
        twin: twinBuild.twin,
        validation: twinBuild.validation,
      });
      const qualityPass = qualityGate.state === 'PASS';
      const failureCategory = qualityPass ? null : 'QUALITY_GATE_REJECTED';

      await this.sceneRepository.update(sceneId, (current) => ({
        ...current,
        attempts: current.attempts + 1,
        place: result.place,
        meta: {
          ...result.meta,
          qualityGate,
        },
        detail: {
          ...result.detail,
          qualityGate,
        },
        twin: twinBuild.twin,
        validation: twinBuild.validation,
        qa,
        latestWeatherSnapshot: {
          provider: weatherSnapshot.source,
          date:
            weatherObserved.observation?.date ??
            weatherSnapshot.updatedAt.slice(0, 10),
          localTime: weatherSnapshot.observedAt ?? weatherSnapshot.updatedAt,
          resolvedWeather: this.snapshotService.toWeatherType(weatherSnapshot.preset),
          temperatureCelsius: weatherSnapshot.temperature,
          precipitationMm: null,
          capturedAt: weatherSnapshot.updatedAt,
          upstreamEnvelopes: weatherObserved.upstreamEnvelopes,
        },
        latestTrafficSnapshot: {
          provider: trafficObserved.provider,
          observedAt: trafficSnapshot.updatedAt,
          segmentCount: trafficSnapshot.segments.length,
          averageCongestionScore:
            trafficSnapshot.segments.length > 0
              ? Number(
                  (
                    trafficSnapshot.segments.reduce(
                      (sum, segment) => sum + segment.congestionScore,
                      0,
                    ) / trafficSnapshot.segments.length
                  ).toFixed(3),
                )
              : 0,
          segments: trafficSnapshot.segments,
          degraded: trafficSnapshot.degraded,
          failedSegmentCount: trafficSnapshot.failedSegmentCount,
          capturedAt: trafficSnapshot.updatedAt,
          upstreamEnvelopes: trafficObserved.upstreamEnvelopes,
        },
        scene: {
          ...current.scene,
          placeId: result.place.placeId,
          name: result.place.displayName,
          centerLat: result.place.location.lat,
          centerLng: result.place.location.lng,
          status: qualityPass ? 'READY' : 'FAILED',
          assetUrl: result.assetPath
            ? `/api/scenes/${sceneId}/assets/base.glb`
            : null,
          failureReason: qualityPass
            ? null
            : this.failureHandler.buildQualityFailureReason(qualityGate),
          failureCategory,
          qualityGate,
          updatedAt: new Date().toISOString(),
        },
      }));
      if (qualityPass) {
        appMetrics.incrementCounter(
          'scene_generation_total',
          1,
          { outcome: 'success' },
          'Total scene generation results by outcome.',
        );
        appMetrics.observeDuration(
          'scene_generation_duration_ms',
          Date.now() - startedAt,
          { outcome: 'success' },
          'Scene generation duration in milliseconds.',
        );
        this.appLoggerService.info('scene.ready', {
          ...logContext,
          step: 'complete',
          status: 'READY',
          qualityGate: {
            version: qualityGate.version,
            state: qualityGate.state,
            reasonCodes: qualityGate.reasonCodes,
          },
        });
      } else {
        this.appLoggerService.warn('scene.quality_gate.rejected', {
          ...logContext,
          step: 'quality_gate',
          status: 'FAILED',
          failureCategory,
          qualityGate: {
            version: qualityGate.version,
            state: qualityGate.state,
            reasonCodes: qualityGate.reasonCodes,
            scores: qualityGate.scores,
            thresholds: qualityGate.thresholds,
          },
        });
        this.queueManager.recordFailure({
          sceneId,
          attempts: storedScene.attempts + 1,
          failureCategory: 'QUALITY_GATE_REJECTED',
          failureReason: this.failureHandler.buildQualityFailureReason(qualityGate),
          updatedAt: new Date().toISOString(),
        });
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
    } catch (error) {
      this.appLoggerService.error('scene.generation.failed', {
        ...logContext,
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

  private buildRequestKey(query: string, scale: SceneScale): string {
    return `${query.trim().toLowerCase()}::${scale}`;
  }

  private buildSceneId(name: string, unique = false): string {
    const slug = name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48);

    const base = `scene-${slug || Date.now().toString(36)}`;
    if (!unique) {
      return base;
    }

    return `${base}-${Date.now().toString(36)}`;
  }

  private resolveRadius(scale: SceneScale): number {
    if (scale === 'SMALL') {
      return 300;
    }
    if (scale === 'LARGE') {
      return 1000;
    }
    return 600;
  }

  private async getStoredScene(sceneId: string): Promise<StoredScene> {
    const storedScene = await this.sceneRepository.findById(sceneId);
    if (!storedScene) {
      throw new AppException({
        code: ERROR_CODES.SCENE_NOT_FOUND,
        message: 'Scene을 찾을 수 없습니다.',
        detail: { sceneId },
        status: HttpStatus.NOT_FOUND,
      });
    }

    return storedScene;
  }

  private async isReusableScene(storedScene: StoredScene): Promise<boolean> {
    if (storedScene.scene.status !== 'READY' || !storedScene.scene.assetUrl) {
      return false;
    }

    if (
      !storedScene.place ||
      !storedScene.meta ||
      !storedScene.detail ||
      !isFiniteCoordinate(storedScene.place.location) ||
      !isFiniteCoordinate(storedScene.meta.origin)
    ) {
      return false;
    }

    try {
      await access(join(getSceneDataDir(), `${storedScene.scene.sceneId}.glb`));
      await access(
        join(getSceneDataDir(), `${storedScene.scene.sceneId}.detail.json`),
      );
      return true;
    } catch {
      return false;
    }
  }
}
