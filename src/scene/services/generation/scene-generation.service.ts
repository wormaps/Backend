import { HttpStatus, Injectable } from '@nestjs/common';
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
import { SceneTwinBuilderService } from '../twin';
import type {
  SceneCreateOptions,
  SceneEntity,
  SceneFailureCategory,
  SceneQualityGateResult,
  SceneScale,
  StoredScene,
} from '../../types/scene.types';

@Injectable()
export class SceneGenerationService {
  private readonly maxGenerationAttempts = 2;
  private readonly generationQueue: string[] = [];
  private isProcessingQueue = false;

  constructor(
    private readonly sceneRepository: SceneRepository,
    private readonly sceneGenerationPipelineService: SceneGenerationPipelineService,
    private readonly sceneQualityGateService: SceneQualityGateService,
    private readonly sceneTwinBuilderService: SceneTwinBuilderService,
    private readonly appLoggerService: AppLoggerService,
  ) {}

  async createScene(
    query: string,
    scale: SceneScale,
    options: SceneCreateOptions = {},
  ): Promise<SceneEntity> {
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

  private buildRequestKey(query: string, scale: SceneScale): string {
    return `${query.trim().toLowerCase()}::${scale}`;
  }

  private enqueueGeneration(sceneId: string): void {
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
        await this.processGeneration(sceneId);
      }
    } finally {
      this.isProcessingQueue = false;
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
      const twinBuild = this.sceneTwinBuilderService.build({
        sceneId,
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
