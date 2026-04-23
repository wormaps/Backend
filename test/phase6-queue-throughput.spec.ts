import { afterEach, beforeEach, describe, expect, it, vi } from 'bun:test';
import { Test, TestingModule } from '@nestjs/testing';
import { AppLoggerService } from '../src/common/logging/app-logger.service';
import { appMetrics } from '../src/common/metrics/metrics.instance';
import { SceneQueueManagerService } from '../src/scene/services/generation/scene-queue-manager.service';
import {
  getSceneDataDir,
  readSceneGenerationQueueSnapshot,
} from '../src/scene/storage/scene-storage.utils';
import { join } from 'node:path';
import { unlink } from 'node:fs/promises';

const QUEUE_SNAPSHOT_PATH = join(getSceneDataDir(), 'generation-queue.json');

async function safeUnlink(path: string): Promise<void> {
  try { await unlink(path); } catch { /* ignore */ }
}

describe('SceneQueueManagerService - idle signaling & snapshot debounce', () => {
  let queueManager: SceneQueueManagerService;
  let mockLogger: { info: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    appMetrics.reset();
    await safeUnlink(QUEUE_SNAPSHOT_PATH);

    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SceneQueueManagerService,
        { provide: AppLoggerService, useValue: mockLogger },
      ],
    }).compile();

    queueManager = module.get(SceneQueueManagerService);
  });

  afterEach(async () => {
    vi.useRealTimers();
    await safeUnlink(QUEUE_SNAPSHOT_PATH);
  });

  describe('waitForIdle - event-based idle', () => {
    it('resolves immediately when already idle', async () => {
      const start = Date.now();
      await queueManager.waitForIdle();
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(10);
    });

    it('resolves when processing finishes and queue is empty', async () => {
      queueManager.processingFlag = true;
      queueManager.enqueue('scene-a');
      await queueManager.dequeue();
      queueManager.processingFlag = false;

      const idlePromise = queueManager.waitForIdle();
      await expect(idlePromise).resolves.toBeUndefined();
    });

    it('resolves when queue drains while processing', async () => {
      queueManager.processingFlag = true;
      queueManager.enqueue('scene-a');

      const idlePromise = queueManager.waitForIdle();

      await queueManager.dequeue();
      queueManager.processingFlag = false;

      await expect(idlePromise).resolves.toBeUndefined();
    });

    it('does not resolve while items remain in queue', async () => {
      queueManager.enqueue('scene-a');
      queueManager.enqueue('scene-b');

      const idlePromise = queueManager.waitForIdle();

      await queueManager.dequeue();

      let resolved = false;
      idlePromise.then(() => { resolved = true; });
      await new Promise((r) => setTimeout(r, 10));
      expect(resolved).toBe(false);

      await queueManager.dequeue();
      await idlePromise;
    });

    it('notifies multiple concurrent waiters', async () => {
      queueManager.enqueue('scene-a');

      const [p1, p2, p3] = [
        queueManager.waitForIdle(),
        queueManager.waitForIdle(),
        queueManager.waitForIdle(),
      ];

      await queueManager.dequeue();

      const results = await Promise.allSettled([p1, p2, p3]);
      expect(results.every((r) => r.status === 'fulfilled')).toBe(true);
    });
  });

  describe('snapshot debounce', () => {
    it('writes snapshot after debounce window', async () => {
      for (let i = 0; i < 10; i += 1) {
        queueManager.enqueue(`scene-${i}`);
      }

      const snap1 = await readSceneGenerationQueueSnapshot();
      expect(snap1).toBeNull();

      await new Promise((r) => setTimeout(r, 300));
      const snap2 = await readSceneGenerationQueueSnapshot();
      expect(snap2).not.toBeNull();
      expect(snap2!.queuedSceneIds).toHaveLength(10);
    });

    it('flushSnapshot forces immediate write', async () => {
      queueManager.enqueue('scene-a');
      const before = await readSceneGenerationQueueSnapshot();
      expect(before).toBeNull();

      await queueManager.flushSnapshot();
      const after = await readSceneGenerationQueueSnapshot();
      expect(after).not.toBeNull();
      expect(after!.queuedSceneIds).toContain('scene-a');
    });

    it('flushSnapshot is idempotent when no pending snapshot', async () => {
      queueManager.enqueue('scene-b');
      await queueManager.flushSnapshot();
      const snap1 = await readSceneGenerationQueueSnapshot();
      expect(snap1).not.toBeNull();

      await queueManager.flushSnapshot();
      const snap2 = await readSceneGenerationQueueSnapshot();
      expect(snap2).not.toBeNull();
    });
  });

  describe('metrics accuracy', () => {
    it('keeps scene_queue_depth accurate during enqueue/dequeue', async () => {
      queueManager.enqueue('scene-a');
      queueManager.enqueue('scene-b');
      expect(appMetrics.snapshot().scene_queue_depth?.[0]?.value).toBe(2);

      await queueManager.dequeue();
      queueManager.recordMetrics();
      expect(appMetrics.snapshot().scene_queue_depth?.[0]?.value).toBe(1);

      await queueManager.dequeue();
      queueManager.recordMetrics();
      expect(appMetrics.snapshot().scene_queue_depth?.[0]?.value).toBe(0);
    });

    it('keeps scene_queue_processing accurate during processing lifecycle', async () => {
      queueManager.recordMetrics();
      expect(appMetrics.snapshot().scene_queue_processing?.[0]?.value).toBe(0);

      queueManager.processingFlag = true;
      queueManager.recordMetrics();
      expect(appMetrics.snapshot().scene_queue_processing?.[0]?.value).toBe(1);

      queueManager.processingFlag = false;
      queueManager.recordMetrics();
      expect(appMetrics.snapshot().scene_queue_processing?.[0]?.value).toBe(0);
    });
  });

  describe('shutdown behavior', () => {
    it('prevents enqueue during shutdown', () => {
      queueManager.isShuttingDownFlag = true;
      queueManager.enqueue('scene-a');
      expect(queueManager.queue.length).toBe(0);
    });

    it('flushSnapshot persists final state before failPendingScenes', async () => {
      queueManager.enqueue('scene-a');
      queueManager.processingFlag = true;
      queueManager.currentProcessingId = 'scene-a';

      await queueManager.flushSnapshot();
      const snap = await readSceneGenerationQueueSnapshot();
      expect(snap).not.toBeNull();
      expect(snap!.queuedSceneIds).toContain('scene-a');
      expect(snap!.currentProcessingSceneId).toBe('scene-a');
    });
  });
});
