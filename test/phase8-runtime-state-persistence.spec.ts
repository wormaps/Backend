import { afterEach, beforeEach, describe, expect, it, vi } from 'bun:test';
import { Test, type TestingModule } from '@nestjs/testing';
import { mkdir, rm, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { AppLoggerService } from '../src/common/logging/app-logger.service';
import { appMetrics } from '../src/common/metrics/metrics.instance';
import { SceneQueueManagerService } from '../src/scene/services/generation/scene-queue-manager.service';
import { SceneRepository } from '../src/scene/storage/scene.repository';
import {
  getSceneDataDir,
  readSceneGenerationQueueSnapshot,
  readSceneRecentFailuresSnapshot,
  writeSceneGenerationQueueSnapshot,
  writeSceneRecentFailuresSnapshot,
} from '../src/scene/storage/scene-storage.utils';
import type { StoredScene } from '../src/scene/types/scene.types';

const QUEUE_SNAPSHOT_PATH = join(getSceneDataDir(), 'generation-queue.json');
const FAILURES_SNAPSHOT_PATH = join(getSceneDataDir(), 'recent-failures.json');

function makeStoredScene(sceneId: string, status: 'PENDING' | 'FAILED' | 'READY' = 'PENDING'): StoredScene {
  return {
    requestKey: `req-${sceneId}`,
    requestId: `req-${sceneId}`,
    attempts: status === 'FAILED' ? 2 : 0,
    generationSource: 'api',
    query: 'test',
    scale: 'MEDIUM',
    scene: {
      sceneId,
      placeId: 'test-place',
      name: 'Test Place',
      centerLat: 37.5665,
      centerLng: 126.978,
      radiusM: 500,
      status,
      metaUrl: `/api/scenes/${sceneId}/meta`,
      assetUrl: null,
      failureReason: status === 'FAILED' ? 'test failure' : null,
      failureCategory: status === 'FAILED' ? 'GENERATION_ERROR' : null,
      qualityGate: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  };
}

async function safeUnlink(path: string): Promise<void> {
  try { await unlink(path); } catch { /* ignore */ }
}

describe('Phase 8 runtime state persistence groundwork', () => {
  let queueManager: SceneQueueManagerService;
  let repository: SceneRepository;
  let mockLogger: { info: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

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
        SceneRepository,
        { provide: AppLoggerService, useValue: mockLogger },
      ],
    }).compile();

    queueManager = module.get(SceneQueueManagerService);
    repository = module.get(SceneRepository);
    await safeUnlink(QUEUE_SNAPSHOT_PATH);
    await safeUnlink(FAILURES_SNAPSHOT_PATH);
  });

  afterEach(async () => {
    await safeUnlink(QUEUE_SNAPSHOT_PATH);
    await safeUnlink(FAILURES_SNAPSHOT_PATH);
  });

  describe('recent failures persistence', () => {
    it('persists recent failures to disk after recordFailure', async () => {
      queueManager.recordFailure({
        sceneId: 'scene-fail-1',
        attempts: 2,
        failureCategory: 'GENERATION_ERROR',
        failureReason: 'timeout',
        updatedAt: new Date().toISOString(),
      });

      await new Promise((r) => setTimeout(r, 300));

      const snapshot = await readSceneRecentFailuresSnapshot();
      expect(snapshot).not.toBeNull();
      expect(snapshot!.failures).toHaveLength(1);
      expect(snapshot!.failures[0]!.sceneId).toBe('scene-fail-1');
    });

    it('persists multiple failures and caps at 20', async () => {
      for (let i = 0; i < 25; i += 1) {
        queueManager.recordFailure({
          sceneId: `scene-fail-${i}`,
          attempts: 1,
          failureCategory: 'GENERATION_ERROR',
          failureReason: `error ${i}`,
          updatedAt: new Date().toISOString(),
        });
      }

      await new Promise((r) => setTimeout(r, 300));

      const snapshot = await readSceneRecentFailuresSnapshot();
      expect(snapshot).not.toBeNull();
      expect(snapshot!.failures).toHaveLength(20);
    });
  });

  describe('restoreFromSnapshot', () => {
    it('restores queued sceneIds that are still PENDING on disk', async () => {
      await writeSceneGenerationQueueSnapshot({
        ownerId: 'test-owner',
        updatedAt: new Date().toISOString(),
        isProcessingQueue: false,
        isShuttingDown: false,
        currentProcessingSceneId: null,
        queuedSceneIds: ['scene-a', 'scene-b', 'scene-c'],
        queueDepth: 3,
      });

      await repository.save(makeStoredScene('scene-a', 'PENDING'));
      await repository.save(makeStoredScene('scene-b', 'PENDING'));
      await repository.save(makeStoredScene('scene-c', 'FAILED'));

      const freshModule: TestingModule = await Test.createTestingModule({
        providers: [
          SceneQueueManagerService,
          { provide: AppLoggerService, useValue: mockLogger },
        ],
      }).compile();
      const freshQueueManager = freshModule.get(SceneQueueManagerService);

      await freshQueueManager.restoreFromSnapshot(async (sceneIds) => {
        const pending: string[] = [];
        for (const sceneId of sceneIds) {
          const stored = await repository.findById(sceneId);
          if (stored?.scene.status === 'PENDING') {
            pending.push(sceneId);
          }
        }
        return pending;
      });

      expect(freshQueueManager.queue).toContain('scene-a');
      expect(freshQueueManager.queue).toContain('scene-b');
      expect(freshQueueManager.queue).not.toContain('scene-c');
      expect(freshQueueManager.queue).toHaveLength(2);
    });

    it('restores recent failures from disk snapshot', async () => {
      await writeSceneRecentFailuresSnapshot({
        failures: [
          {
            sceneId: 'scene-old-fail',
            attempts: 2,
            status: 'FAILED',
            failureCategory: 'GENERATION_ERROR',
            failureReason: 'old failure',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        updatedAt: '2026-01-01T00:00:00.000Z',
      });

      const freshModule: TestingModule = await Test.createTestingModule({
        providers: [
          SceneQueueManagerService,
          { provide: AppLoggerService, useValue: mockLogger },
        ],
      }).compile();
      const freshQueueManager = freshModule.get(SceneQueueManagerService);

      await freshQueueManager.restoreFromSnapshot(async () => []);

      const failures = freshQueueManager.getRecentFailures();
      expect(failures).toHaveLength(1);
      expect(failures[0]!.sceneId).toBe('scene-old-fail');
    });

    it('handles missing snapshot files gracefully', async () => {
      const freshModule: TestingModule = await Test.createTestingModule({
        providers: [
          SceneQueueManagerService,
          { provide: AppLoggerService, useValue: mockLogger },
        ],
      }).compile();
      const freshQueueManager = freshModule.get(SceneQueueManagerService);

      await expect(
        freshQueueManager.restoreFromSnapshot(async () => []),
      ).resolves.toBeUndefined();

      expect(freshQueueManager.queue).toHaveLength(0);
      expect(freshQueueManager.getRecentFailures()).toHaveLength(0);
    });

    it('does not re-queue scenes already in the in-memory queue', async () => {
      await writeSceneGenerationQueueSnapshot({
        ownerId: 'test-owner',
        updatedAt: new Date().toISOString(),
        isProcessingQueue: false,
        isShuttingDown: false,
        currentProcessingSceneId: null,
        queuedSceneIds: ['scene-dup'],
        queueDepth: 1,
      });

      await repository.save(makeStoredScene('scene-dup', 'PENDING'));

      const freshModule: TestingModule = await Test.createTestingModule({
        providers: [
          SceneQueueManagerService,
          { provide: AppLoggerService, useValue: mockLogger },
        ],
      }).compile();
      const freshQueueManager = freshModule.get(SceneQueueManagerService);

      freshQueueManager.enqueue('scene-dup');

      await freshQueueManager.restoreFromSnapshot(async (sceneIds) => {
        const pending: string[] = [];
        for (const sceneId of sceneIds) {
          const stored = await repository.findById(sceneId);
          if (stored?.scene.status === 'PENDING') {
            pending.push(sceneId);
          }
        }
        return pending;
      });

      expect(freshQueueManager.queue.filter((id) => id === 'scene-dup')).toHaveLength(1);
    });
  });

  describe('flushSnapshot includes failures', () => {
    it('flushes both queue and failure snapshots immediately', async () => {
      queueManager.enqueue('scene-flush');
      queueManager.recordFailure({
        sceneId: 'scene-flush-fail',
        attempts: 1,
        failureCategory: 'GENERATION_ERROR',
        failureReason: 'flush test',
        updatedAt: new Date().toISOString(),
      });

      await queueManager.flushSnapshot();

      const queueSnapshot = await readSceneGenerationQueueSnapshot();
      expect(queueSnapshot).not.toBeNull();
      expect(queueSnapshot!.queuedSceneIds).toContain('scene-flush');

      const failuresSnapshot = await readSceneRecentFailuresSnapshot();
      expect(failuresSnapshot).not.toBeNull();
      expect(failuresSnapshot!.failures.some((f) => f.sceneId === 'scene-flush-fail')).toBe(true);
    });
  });

  describe('storage utils round-trip', () => {
    it('writes and reads queue snapshot correctly', async () => {
      const snapshot = {
        ownerId: 'roundtrip-owner',
        updatedAt: new Date().toISOString(),
        isProcessingQueue: true,
        isShuttingDown: false,
        currentProcessingSceneId: 'scene-rt',
        queuedSceneIds: ['scene-rt', 'scene-rt2'],
        queueDepth: 2,
      };

      await writeSceneGenerationQueueSnapshot(snapshot);
      const read = await readSceneGenerationQueueSnapshot();

      expect(read).not.toBeNull();
      expect(read!.ownerId).toBe('roundtrip-owner');
      expect(read!.queuedSceneIds).toEqual(['scene-rt', 'scene-rt2']);
      expect(read!.queueDepth).toBe(2);
    });

    it('writes and reads failures snapshot correctly', async () => {
      const snapshot = {
        failures: [
          {
            sceneId: 'scene-rt-fail',
            attempts: 3,
            status: 'FAILED' as const,
            failureCategory: 'QUALITY_GATE_REJECTED',
            failureReason: 'coverage gap',
            updatedAt: new Date().toISOString(),
          },
        ],
        updatedAt: new Date().toISOString(),
      };

      await writeSceneRecentFailuresSnapshot(snapshot);
      const read = await readSceneRecentFailuresSnapshot();

      expect(read).not.toBeNull();
      expect(read!.failures).toHaveLength(1);
      expect(read!.failures[0]!.failureCategory).toBe('QUALITY_GATE_REJECTED');
    });

    it('returns null for missing snapshot files', async () => {
      await safeUnlink(QUEUE_SNAPSHOT_PATH);
      await safeUnlink(FAILURES_SNAPSHOT_PATH);

      const queueRead = await readSceneGenerationQueueSnapshot();
      const failuresRead = await readSceneRecentFailuresSnapshot();

      expect(queueRead).toBeNull();
      expect(failuresRead).toBeNull();
    });
  });
});
