import { HttpStatus, Injectable, OnApplicationShutdown } from '@nestjs/common';
import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { ERROR_CODES } from '../../../common/constants/error-codes';
import { AppException } from '../../../common/errors/app.exception';
import { AppLoggerService } from '../../../common/logging/app-logger.service';
import { isFiniteCoordinate } from '../../../places/utils/geo.utils';
import { SceneGenerationPipelineService } from '../../pipeline/scene-generation-pipeline.service';
import { SceneRepository } from '../../storage/scene.repository';
import { getSceneDataDir } from '../../storage/scene-storage.utils';
import { SceneQualityGateService } from './scene-quality-gate.service';
import { SceneMidQaService } from '../qa';
import { SceneTwinBuilderService } from '../twin';
import { SceneWeatherLiveService } from '../live/scene-weather-live.service';
import { SceneTrafficLiveService } from '../live/scene-traffic-live.service';
import type {
  SceneCreateOptions,
  SceneEntity,
  SceneFailureCategory,
  SceneQualityGateResult,
  SceneScale,
  StoredScene,
} from '../../types/scene.types';

@Injectable()
export class SceneGenerationService implements OnApplicationShutdown {
  private readonly maxGenerationAttempts = 2;
  private readonly generationQueue: string[] = [];
  private readonly queuedSceneIds = new Set<string>();
  private readonly recentFailures: Array<{
    sceneId: string;
    attempts: number;
    status: 'FAILED';
    failureCategory: SceneFailureCategory;
    failureReason: string;
    updatedAt: string;
  }> = [];
  private isProcessingQueue = false;
  private isShuttingDown = false;
  private currentProcessingSceneId: string | null = null;

  constructor(
    private readonly sceneRepository: SceneRepository,
    private readonly sceneGenerationPipelineService: SceneGenerationPipelineService,
    private readonly sceneQualityGateService: SceneQualityGateService,
    private readonly sceneMidQaService: SceneMidQaService,
    private readonly sceneTwinBuilderService: SceneTwinBuilderService,
    private readonly sceneWeatherLiveService: SceneWeatherLiveService,
    private readonly sceneTrafficLiveService: SceneTrafficLiveService,
    private readonly appLoggerService: AppLoggerService,
  ) {}

  async createScene(
    query: string,
    scale: SceneScale,
    options: SceneCreateOptions = {},
  ): Promise<SceneEntity> {
    if (this.isShuttingDown) {
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
    this.enqueueGeneration(sceneId);

    return scene;
  }

  async waitForIdle(): Promise<void> {
    while (this.isProcessingQueue || this.generationQueue.length > 0) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  getQueueDebugSnapshot(): {
    isProcessingQueue: boolean;
    isShuttingDown: boolean;
    currentProcessingSceneId: string | null;
    queuedSceneIds: string[];
    queueDepth: number;
  } {
    return {
      isProcessingQueue: this.isProcessingQueue,
      isShuttingDown: this.isShuttingDown,
      currentProcessingSceneId: this.currentProcessingSceneId,
      queuedSceneIds: [...this.queuedSceneIds],
      queueDepth: this.generationQueue.length,
    };
  }

  getRecentFailures(limit = 10): Array<{
    sceneId: string;
    attempts: number;
    status: 'FAILED';
    failureCategory: SceneFailureCategory;
    failureReason: string;
    updatedAt: string;
  }> {
    return this.recentFailures.slice(0, Math.max(1, limit));
  }

  private buildRequestKey(query: string, scale: SceneScale): string {
    return `${query.trim().toLowerCase()}::${scale}`;
  }

  private enqueueGeneration(sceneId: string): void {
    if (this.isShuttingDown) {
      return;
    }

    if (this.queuedSceneIds.has(sceneId)) {
      return;
    }

    this.queuedSceneIds.add(sceneId);
    this.generationQueue.push(sceneId);
    void this.processQueue();
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue) {
      return;
    }

    this.isProcessingQueue = true;
    try {
      while (this.generationQueue.length > 0) {
        const sceneId = this.generationQueue.shift();
        if (!sceneId) {
          continue;
        }
        this.queuedSceneIds.delete(sceneId);
        this.currentProcessingSceneId = sceneId;
        await this.processGeneration(sceneId);
        this.currentProcessingSceneId = null;
      }
    } finally {
      this.currentProcessingSceneId = null;
      this.isProcessingQueue = false;
    }
  }

  async onApplicationShutdown(): Promise<void> {
    this.isShuttingDown = true;

    await Promise.race([
      this.waitForIdle(),
      new Promise((resolve) => setTimeout(resolve, 30000)),
    ]);

    const pending = new Set<string>(this.generationQueue);
    if (this.currentProcessingSceneId) {
      pending.add(this.currentProcessingSceneId);
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
      this.recordFailure({
        sceneId,
        attempts: updated.attempts,
        failureCategory: updated.scene.failureCategory,
        failureReason: updated.scene.failureReason,
        updatedAt: updated.scene.updatedAt,
      });
    }
  }

  private async processGeneration(sceneId: string): Promise<void> {
    const storedScene = await this.getStoredScene(sceneId);
    const logContext = {
      requestId: storedScene.requestId ?? null,
      sceneId,
      source: storedScene.generationSource ?? 'api',
    };
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
      const weatherObserved =
        await this.sceneWeatherLiveService.sampleWeatherByPlace(
          result.place,
          result.meta.generatedAt.slice(0, 10),
          'DAY',
        );
      const weatherSnapshot = {
        updatedAt: new Date().toISOString(),
        weatherCode: resolveWeatherCode(weatherObserved.observation),
        temperature: weatherObserved.observation?.temperatureCelsius ?? null,
        preset:
          weatherObserved.observation?.resolvedWeather.toLowerCase() ?? 'clear',
        source: weatherObserved.observation?.source ?? 'OPEN_METEO_HISTORICAL',
        observedAt: weatherObserved.observation?.localTime ?? null,
      };
      const trafficObserved =
        await this.sceneTrafficLiveService.sampleTrafficByRoads(
          result.meta.roads.map((road) => ({
            objectId: road.objectId,
            center: road.center,
          })),
        );
      const trafficSnapshot = {
        updatedAt: new Date().toISOString(),
        segments: trafficObserved.segments,
        degraded: trafficObserved.failedSegmentCount > 0,
        failedSegmentCount: trafficObserved.failedSegmentCount,
      };
      const twinBuild = this.sceneTwinBuilderService.build({
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
          resolvedWeather: this.toWeatherType(weatherSnapshot.preset),
          temperatureCelsius: weatherSnapshot.temperature,
          precipitationMm: null,
          capturedAt: weatherSnapshot.updatedAt,
          upstreamEnvelopes: weatherObserved.upstreamEnvelopes,
        },
        latestTrafficSnapshot: {
          provider: 'TOMTOM_TRAFFIC_FLOW',
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
            : this.buildQualityFailureReason(qualityGate),
          failureCategory,
          qualityGate,
          updatedAt: new Date().toISOString(),
        },
      }));
      if (qualityPass) {
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
        this.recordFailure({
          sceneId,
          attempts: storedScene.attempts + 1,
          failureCategory: 'QUALITY_GATE_REJECTED',
          failureReason: this.buildQualityFailureReason(qualityGate),
          updatedAt: new Date().toISOString(),
        });
      }
    } catch (error) {
      this.appLoggerService.error('scene.generation.failed', {
        ...logContext,
        step: 'generation',
        error,
      });
      await this.handleGenerationFailure(sceneId, storedScene, error);
    }
  }

  private async handleGenerationFailure(
    sceneId: string,
    storedScene: StoredScene,
    error: unknown,
  ): Promise<void> {
    const attempts = storedScene.attempts + 1;
    const failureReason =
      error instanceof Error ? error.message : 'Scene generation failed';
    const qualityGate = this.resolveQualityGateFromError(error);
    const failureCategory: SceneFailureCategory = qualityGate
      ? 'QUALITY_GATE_REJECTED'
      : 'GENERATION_ERROR';

    if (attempts < this.maxGenerationAttempts) {
      if (failureCategory === 'QUALITY_GATE_REJECTED') {
        const updated = await this.sceneRepository.update(sceneId, (current) => ({
          ...current,
          attempts,
          scene: {
            ...current.scene,
            status: 'FAILED',
            failureReason,
            failureCategory,
            qualityGate,
            updatedAt: new Date().toISOString(),
          },
        }));
        if (updated?.scene.failureReason && updated.scene.failureCategory) {
          this.recordFailure({
            sceneId,
            attempts,
            failureCategory: updated.scene.failureCategory,
            failureReason: updated.scene.failureReason,
            updatedAt: updated.scene.updatedAt,
          });
        }
        this.appLoggerService.warn('scene.quality_gate.non_retry', {
          requestId: storedScene.requestId ?? null,
          sceneId,
          source: storedScene.generationSource ?? 'api',
          step: 'quality_gate',
          attempts,
          failureReason,
          failureCategory,
        });
        return;
      }

      this.appLoggerService.warn('scene.retrying', {
        requestId: storedScene.requestId ?? null,
        sceneId,
        source: storedScene.generationSource ?? 'api',
        step: 'retry',
        attempts,
        maxAttempts: this.maxGenerationAttempts,
        failureReason,
        failureCategory,
      });
      await this.sceneRepository.update(sceneId, (current) => ({
        ...current,
        attempts,
        scene: {
          ...current.scene,
          status: 'PENDING',
          failureReason,
          failureCategory,
          qualityGate,
          updatedAt: new Date().toISOString(),
        },
      }));
      this.enqueueGeneration(sceneId);
      return;
    }

    await this.sceneRepository.update(sceneId, (current) => ({
      ...current,
      attempts,
      scene: {
        ...current.scene,
        status: 'FAILED',
        failureReason,
        failureCategory,
        qualityGate,
        updatedAt: new Date().toISOString(),
      },
    }));
    this.appLoggerService.error('scene.failed', {
      requestId: storedScene.requestId ?? null,
      sceneId,
      source: storedScene.generationSource ?? 'api',
      step: 'failed',
      attempts,
      failureReason,
      failureCategory,
    });
    this.recordFailure({
      sceneId,
      attempts,
      failureCategory,
      failureReason,
      updatedAt: new Date().toISOString(),
    });
  }

  private resolveQualityGateFromError(
    error: unknown,
  ): SceneQualityGateResult | null {
    if (!(error instanceof Error)) {
      return null;
    }

    const maybeResult = (
      error as Error & {
        qualityGate?: SceneQualityGateResult;
      }
    ).qualityGate;
    if (!maybeResult) {
      return null;
    }

    return maybeResult;
  }

  private buildQualityFailureReason(
    qualityGate: SceneQualityGateResult,
  ): string {
    const reasonCodes = qualityGate.reasonCodes;
    if (reasonCodes.length === 0) {
      return 'Quality gate rejected this scene.';
    }
    return `Quality gate rejected this scene: ${reasonCodes.join(', ')}`;
  }

  private recordFailure(entry: {
    sceneId: string;
    attempts: number;
    failureCategory: SceneFailureCategory;
    failureReason: string;
    updatedAt: string;
  }): void {
    this.recentFailures.unshift({
      sceneId: entry.sceneId,
      attempts: entry.attempts,
      status: 'FAILED',
      failureCategory: entry.failureCategory,
      failureReason: entry.failureReason,
      updatedAt: entry.updatedAt,
    });
    if (this.recentFailures.length > 20) {
      this.recentFailures.length = 20;
    }
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

  private toWeatherType(preset: string): 'CLEAR' | 'CLOUDY' | 'RAIN' | 'SNOW' {
    if (preset === 'cloudy') {
      return 'CLOUDY';
    }
    if (preset === 'rain') {
      return 'RAIN';
    }
    if (preset === 'snow') {
      return 'SNOW';
    }
    return 'CLEAR';
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

function resolveWeatherCode(
  observation: {
    resolvedWeather: string;
  } | null,
): number | null {
  if (!observation) {
    return null;
  }
  if (observation.resolvedWeather === 'CLOUDY') {
    return 3;
  }
  if (observation.resolvedWeather === 'RAIN') {
    return 61;
  }
  if (observation.resolvedWeather === 'SNOW') {
    return 71;
  }
  return 0;
}
