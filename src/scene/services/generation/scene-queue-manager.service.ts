import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AppLoggerService } from '../../../common/logging/app-logger.service';
import { appMetrics } from '../../../common/metrics/metrics.instance';
import {
  getSceneGenerationQueuePath,
  releaseSceneGenerationLock,
  tryAcquireSceneGenerationLock,
  writeSceneGenerationQueueSnapshot,
} from '../../storage/scene-storage.utils';
import type { SceneFailureCategory } from '../../types/scene.types';
import type { FailureEntry, QueueDebugSnapshot } from './scene-queue-manager.types';

const SNAPSHOT_DEBOUNCE_MS = 250;

@Injectable()
export class SceneQueueManagerService {
  private readonly generationLockOwnerId = randomUUID();
  private readonly generationQueue: string[] = [];
  private readonly queuedSceneIds = new Set<string>();
  private readonly recentFailures: FailureEntry[] = [];
  private readonly idleListeners: Array<() => void> = [];
  private isProcessingQueue = false;
  private isShuttingDown = false;
  private currentProcessingSceneId: string | null = null;
  private snapshotTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingSnapshot = false;

  constructor(private readonly appLoggerService: AppLoggerService) {}

  get isShuttingDownFlag(): boolean {
    return this.isShuttingDown;
  }

  set isShuttingDownFlag(value: boolean) {
    this.isShuttingDown = value;
  }

  get currentProcessingId(): string | null {
    return this.currentProcessingSceneId;
  }

  set currentProcessingId(value: string | null) {
    this.currentProcessingSceneId = value;
  }

  get processingFlag(): boolean {
    return this.isProcessingQueue;
  }

  set processingFlag(value: boolean) {
    this.isProcessingQueue = value;
    if (!value) {
      this.notifyIdleIfApplicable();
    }
  }

  get queue(): string[] {
    return this.generationQueue;
  }

  enqueue(sceneId: string): void {
    if (this.isShuttingDown) {
      return;
    }
    if (this.queuedSceneIds.has(sceneId)) {
      return;
    }
    this.queuedSceneIds.add(sceneId);
    this.generationQueue.push(sceneId);
    this.recordMetrics();
  }

  async dequeue(): Promise<string | undefined> {
    const sceneId = this.generationQueue.shift();
    if (sceneId) {
      this.queuedSceneIds.delete(sceneId);
      this.notifyIdleIfApplicable();
    }
    return sceneId;
  }

  async acquireLock(sceneId: string): Promise<boolean> {
    return tryAcquireSceneGenerationLock(sceneId, this.generationLockOwnerId);
  }

  async releaseLock(sceneId: string): Promise<void> {
    await releaseSceneGenerationLock(sceneId, this.generationLockOwnerId);
  }

  recordMetrics(): void {
    appMetrics.setGauge(
      'scene_queue_depth',
      this.generationQueue.length,
      {},
      'Current scene generation queue depth.',
    );
    appMetrics.setGauge(
      'scene_queue_processing',
      this.isProcessingQueue ? 1 : 0,
      {},
      'Whether the scene generation queue is currently processing.',
    );
    this.schedulePersistSnapshot();
    this.notifyIdleIfApplicable();
  }

  getDebugSnapshot(): QueueDebugSnapshot {
    return {
      isProcessingQueue: this.isProcessingQueue,
      isShuttingDown: this.isShuttingDown,
      currentProcessingSceneId: this.currentProcessingSceneId,
      queuedSceneIds: [...this.queuedSceneIds],
      queueDepth: this.generationQueue.length,
    };
  }

  getRecentFailures(limit = 10): FailureEntry[] {
    return this.recentFailures.slice(0, Math.max(1, limit));
  }

  /**
   * Returns a promise that resolves when the queue becomes idle
   * (not processing and empty). If already idle, resolves immediately.
   */
  waitForIdle(): Promise<void> {
    if (!this.isProcessingQueue && this.generationQueue.length === 0) {
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      this.idleListeners.push(resolve);
    });
  }

  /**
   * Immediately flush any pending debounced snapshot write.
   * Useful during shutdown to ensure the final state is persisted.
   */
  async flushSnapshot(): Promise<void> {
    if (this.snapshotTimer !== null) {
      clearTimeout(this.snapshotTimer);
      this.snapshotTimer = null;
    }
    if (this.pendingSnapshot) {
      this.pendingSnapshot = false;
      await this.persistQueueSnapshot();
    }
  }

  private schedulePersistSnapshot(): void {
    this.pendingSnapshot = true;
    if (this.snapshotTimer !== null) {
      return;
    }
    this.snapshotTimer = setTimeout(() => {
      this.snapshotTimer = null;
      this.pendingSnapshot = false;
      void this.persistQueueSnapshot();
    }, SNAPSHOT_DEBOUNCE_MS);
  }

  private notifyIdleIfApplicable(): void {
    if (this.isProcessingQueue || this.generationQueue.length > 0) {
      return;
    }
    const listeners = this.idleListeners.splice(0, this.idleListeners.length);
    for (const listener of listeners) {
      listener();
    }
  }

  recordFailure(entry: {
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
    appMetrics.incrementCounter(
      'scene_failures_total',
      1,
      { failureCategory: entry.failureCategory },
      'Total recorded scene failures by category.',
    );
  }

  private async persistQueueSnapshot(): Promise<void> {
    try {
      await writeSceneGenerationQueueSnapshot({
        ownerId: this.generationLockOwnerId,
        updatedAt: new Date().toISOString(),
        isProcessingQueue: this.isProcessingQueue,
        isShuttingDown: this.isShuttingDown,
        currentProcessingSceneId: this.currentProcessingSceneId,
        queuedSceneIds: [...this.queuedSceneIds],
        queueDepth: this.generationQueue.length,
      });
    } catch (error) {
      this.appLoggerService.warn('scene.queue.snapshot_failed', {
        ownerId: this.generationLockOwnerId,
        sceneGenerationQueuePath: getSceneGenerationQueuePath(),
        error,
      });
    }
  }
}
