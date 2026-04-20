import { Injectable } from '@nestjs/common';
import { AppLoggerService } from '../../../common/logging/app-logger.service';
import { SceneRepository } from '../../storage/scene.repository';
import type {
  SceneFailureCategory,
  SceneQualityGateResult,
  StoredScene,
} from '../../types/scene.types';
import { SceneQueueManagerService } from './scene-queue-manager.service';

@Injectable()
export class SceneFailureHandlerService {
  private readonly maxGenerationAttempts = 2;

  constructor(
    private readonly sceneRepository: SceneRepository,
    private readonly queueManager: SceneQueueManagerService,
    private readonly appLoggerService: AppLoggerService,
  ) {}

  async handleGenerationFailure(
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
          this.queueManager.recordFailure({
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
      this.queueManager.enqueue(sceneId);
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
    this.queueManager.recordFailure({
      sceneId,
      attempts,
      failureCategory,
      failureReason,
      updatedAt: new Date().toISOString(),
    });
  }

  buildQualityFailureReason(qualityGate: SceneQualityGateResult): string {
    const reasonCodes = qualityGate.reasonCodes;
    if (reasonCodes.length === 0) {
      return 'Quality gate rejected this scene.';
    }
    return `Quality gate rejected this scene: ${reasonCodes.join(', ')}`;
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
}
