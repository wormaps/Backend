import { HttpStatus, Injectable, OnApplicationShutdown } from '@nestjs/common';
import { ERROR_CODES } from '../../../common/constants/error-codes';
import { AppException } from '../../../common/errors/app.exception';
import { AppLoggerService } from '../../../common/logging/app-logger.service';
import { SceneRepository } from '../../storage/scene.repository';
import { SceneQueueManagerService } from './scene-queue-manager.service';
import { SceneGenerationOrchestratorService } from './scene-generation-orchestrator.service';
import { checkSceneReusability } from './scene-reusability.utils';
import type {
  SceneCreateOptions,
  SceneEntity,
  SceneScale,
} from '../../types/scene.types';

@Injectable()
export class SceneGenerationService implements OnApplicationShutdown {
  private readonly pendingCreateScenes = new Map<string, Promise<SceneEntity>>();

  constructor(
    private readonly sceneRepository: SceneRepository,
    private readonly queueManager: SceneQueueManagerService,
    private readonly orchestrator: SceneGenerationOrchestratorService,
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
        detail: { reason: 'SERVER_SHUTTING_DOWN' },
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
          (await checkSceneReusability(existing))
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
      void this.orchestrator.processQueue();

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

    await this.orchestrator.failPendingScenes();
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
}
