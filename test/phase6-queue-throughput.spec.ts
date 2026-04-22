import { afterEach, beforeEach, describe, expect, it, vi } from 'bun:test';
import { Test, TestingModule } from '@nestjs/testing';
import { AppLoggerService } from '../src/common/logging/app-logger.service';
import { appMetrics } from '../src/common/metrics/metrics.instance';
import { SceneQueueManagerService } from '../src/scene/services/generation/scene-queue-manager.service';
import { writeSceneGenerationQueueSnapshot } from '../src/scene/storage/scene-storage.utils';

vi.mock('../src/scene/storage/scene-storage.utils', () => ({
  writeSceneGenerationQueueSnapshot: vi.fn().mockResolvedValue(undefined),
  tryAcquireSceneGenerationLock: vi.fn().mockResolvedValue(true),
  releaseSceneGenerationLock: vi.fn().mockResolvedValue(undefined),
  getSceneGenerationQueuePath: vi.fn().mockReturnValue('/tmp/test-queue.json'),
}));

describe('SceneQueueManagerService - idle signaling & snapshot debounce', () => {
  let queueManager: SceneQueueManagerService;
  let mockLogger: { info: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  const getSnapshotWriteCount = () =>
    (writeSceneGenerationQueueSnapshot as ReturnType<typeof vi.fn>).mock.calls.length;

  beforeEach(async () => {
    appMetrics.reset();
    vi.clearAllMocks();

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

  afterEach(() => {
    vi.useRealTimers();
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
    it('debounces rapid recordMetrics calls', async () => {
      vi.useFakeTimers();
      for (let i = 0; i < 10; i += 1) {
        queueManager.enqueue(`scene-${i}`);
      }

      expect(getSnapshotWriteCount()).toBe(0);

      vi.advanceTimersByTime(250);
      await Promise.resolve();

      expect(getSnapshotWriteCount()).toBe(1);
    });

    it('eventually writes the snapshot after debounce window', async () => {
      queueManager.enqueue('scene-a');
      await new Promise((r) => setTimeout(r, 300));
      expect(getSnapshotWriteCount()).toBeGreaterThanOrEqual(1);
    });

    it('flushSnapshot forces immediate write', async () => {
      queueManager.enqueue('scene-a');
      expect(getSnapshotWriteCount()).toBe(0);

      await queueManager.flushSnapshot();
      expect(getSnapshotWriteCount()).toBe(1);
    });

    it('flushSnapshot is idempotent when no pending snapshot', async () => {
      await queueManager.flushSnapshot();
      const countAfterFirst = getSnapshotWriteCount();
      await queueManager.flushSnapshot();
      expect(getSnapshotWriteCount()).toBe(countAfterFirst);
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
      expect(getSnapshotWriteCount()).toBe(1);
    });
  });
});
