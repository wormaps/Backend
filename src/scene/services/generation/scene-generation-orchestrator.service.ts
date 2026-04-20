import { Injectable } from '@nestjs/common';
import { AppLoggerService } from '../../../common/logging/app-logger.service';
import { SceneRepository } from '../../storage/scene.repository';
import { SceneQueueManagerService } from './scene-queue-manager.service';
import { SceneGenerationExecutorService } from './scene-generation-executor.service';

@Injectable()
export class SceneGenerationOrchestratorService {
  constructor(
    private readonly sceneRepository: SceneRepository,
    private readonly queueManager: SceneQueueManagerService,
    private readonly executor: SceneGenerationExecutorService,
    private readonly appLoggerService: AppLoggerService,
  ) {}

  async processQueue(): Promise<void> {
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
          await this.executor.execute(sceneId);
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

  async failPendingScenes(): Promise<void> {
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
}
