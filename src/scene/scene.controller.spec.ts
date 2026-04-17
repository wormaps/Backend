import { join } from 'node:path';
import { describe, expect, it, jest } from '@jest/globals';
import { SceneController } from './scene.controller';
import { getSceneDataDir } from './storage/scene-storage.utils';
import type { SceneService } from './scene.service';

describe('SceneController debug endpoints', () => {
  it('returns queue and cache debug snapshots', () => {
    const sceneService = {
      getQueueDebugSnapshot: jest.fn().mockReturnValue({
        isProcessingQueue: true,
        isShuttingDown: false,
        currentProcessingSceneId: 'scene-a',
        queuedSceneIds: ['scene-b'],
        queueDepth: 1,
      }),
      getCacheDebugSnapshot: jest.fn().mockReturnValue({
        hits: 3,
        misses: 1,
        size: 4,
        maxSize: 100,
      }),
    } as unknown as Pick<
      SceneService,
      'getQueueDebugSnapshot' | 'getCacheDebugSnapshot'
    >;
    const controller = new SceneController(sceneService as SceneService);

    const response = controller.getQueueDebug();

    expect(response.data.queue.currentProcessingSceneId).toBe('scene-a');
    expect(response.data.cache.hits).toBe(3);
  });

  it('clamps failure history limit', () => {
    const sceneService = {
      getRecentFailures: jest.fn().mockReturnValue([
        {
          sceneId: 'scene-a',
          attempts: 2,
          status: 'FAILED' as const,
          failureCategory: 'GENERATION_ERROR',
          failureReason: 'boom',
          updatedAt: '2026-04-16T00:00:00Z',
        },
      ]),
    } as unknown as Pick<SceneService, 'getRecentFailures'>;
    const controller = new SceneController(sceneService as SceneService);

    const response = controller.getRecentFailures('999');

    expect(sceneService.getRecentFailures).toHaveBeenCalledWith(50);
    expect(response.data.failures).toHaveLength(1);
  });

  it('returns diagnostics log with bounded line count', async () => {
    const sceneService = {
      getDiagnosticsLog: jest.fn(async () => ({
        sceneId: 'scene-a',
        diagnosticsLogPath: '/tmp/scene-a.diagnostics.log',
        lineCount: 3,
        truncated: false,
        lines: ['one', 'two', 'three'],
      })),
    } as unknown as Pick<SceneService, 'getDiagnosticsLog'>;
    const controller = new SceneController(sceneService as SceneService);

    const response = await controller.getDiagnostics('scene-a', '1000');

    expect(sceneService.getDiagnosticsLog).toHaveBeenCalledWith('scene-a', 500);
    expect(response.data.lines).toHaveLength(3);
  });

  it('serves the base GLB asset after validating readiness', async () => {
    const sceneService = {
      getBootstrap: jest.fn(async () => undefined as any),
    } as unknown as Pick<SceneService, 'getBootstrap'>;
    const controller = new SceneController(sceneService as SceneService);
    const response = {
      sendFile: jest.fn(),
    } as unknown as { sendFile: jest.Mock };

    await controller.getSceneAsset('scene-seoul-city-hall', response as any);

    expect(sceneService.getBootstrap).toHaveBeenCalledWith(
      'scene-seoul-city-hall',
    );
    expect(response.sendFile).toHaveBeenCalledWith(
      join(getSceneDataDir(), 'scene-seoul-city-hall.glb'),
    );
  });
});
