import { describe, expect, it, vi } from 'bun:test';
import {
  logGlbBuildStabilitySignals,
} from '../src/assets/internal/glb-build/glb-build-runner.pipeline';
import { resolveGlbBuildTimeoutMsFromEnv } from '../src/assets/internal/glb-build/glb-build-runner.config';

describe('Phase 8 GLB build runner signals', () => {
  it('logs large-scene stability signals for 4k building scenes', () => {
    const appLoggerService = {
      info: vi.fn(),
      warn: vi.fn(),
    } as any;

    logGlbBuildStabilitySignals({
      appLoggerService,
      sceneId: 'scene-large',
      buildingCount: 4000,
      memoryStart: {
        rss: 1,
        heapTotal: 2,
        heapUsed: 3,
        external: 4,
        arrayBuffers: 5,
      },
    });

    expect(appLoggerService.warn).toHaveBeenCalledWith(
      'scene.glb_build.large_scene_signal',
      expect.objectContaining({ buildingCount: 4000 }),
    );
    expect(appLoggerService.info).not.toHaveBeenCalled();
  });

  it('logs memory start/end for normal scenes', () => {
    const appLoggerService = {
      info: vi.fn(),
      warn: vi.fn(),
    } as any;

    logGlbBuildStabilitySignals({
      appLoggerService,
      sceneId: 'scene-normal',
      buildingCount: 12,
      memoryStart: {
        rss: 1,
        heapTotal: 2,
        heapUsed: 3,
        external: 4,
        arrayBuffers: 5,
      },
      memoryEnd: {
        rss: 6,
        heapTotal: 7,
        heapUsed: 8,
        external: 9,
        arrayBuffers: 10,
      },
    });

    expect(appLoggerService.info).toHaveBeenCalledWith(
      'scene.glb_build.memory_start',
      expect.objectContaining({ buildingCount: 12 }),
    );
    expect(appLoggerService.info).toHaveBeenCalledWith(
      'scene.glb_build.memory_end',
      expect.objectContaining({ buildingCount: 12 }),
    );
    expect(appLoggerService.warn).not.toHaveBeenCalled();
  });

  it('uses an explicit timeout configuration default', () => {
    expect(resolveGlbBuildTimeoutMsFromEnv()).toBeGreaterThanOrEqual(60_000);
  });
});
