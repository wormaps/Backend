import { mkdtemp, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  appendSceneDiagnosticsLog,
  getSceneDiagnosticsLogPath,
  releaseSceneGenerationLock,
  tryAcquireSceneGenerationLock,
  writeSceneGenerationQueueSnapshot,
  writeFileAtomically,
} from './scene-storage.utils';

describe('scene-storage.utils', () => {
  const originalSceneDataDir = process.env.SCENE_DATA_DIR;

  afterEach(() => {
    if (originalSceneDataDir) {
      process.env.SCENE_DATA_DIR = originalSceneDataDir;
    } else {
      delete process.env.SCENE_DATA_DIR;
    }
  });

  it('writes files atomically', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'wormapb-atomic-'));
    process.env.SCENE_DATA_DIR = tempDir;
    const filePath = join(tempDir, 'scene.json');

    await writeFileAtomically(filePath, JSON.stringify({ ok: true }), 'utf8');

    const contents = await readFile(filePath, 'utf8');
    expect(JSON.parse(contents)).toEqual({ ok: true });
  });

  it('rotates diagnostics logs when they exceed the size limit', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'wormapb-logs-'));
    process.env.SCENE_DATA_DIR = tempDir;
    const sceneId = 'scene-log-rotation';
    const logPath = getSceneDiagnosticsLogPath(sceneId);

    await writeFileAtomically(logPath, `${'x'.repeat(1024 * 1024 + 8)}\n`, 'utf8');
    await appendSceneDiagnosticsLog(sceneId, 'glb_build', {
      stage: 'glb_build',
      detail: 'rotated',
    });

    const rotatedStats = await stat(`${logPath}.1`);
    const currentContents = await readFile(logPath, 'utf8');

    expect(rotatedStats.size).toBeGreaterThan(0);
    expect(currentContents).toContain('"stage":"glb_build"');
    expect(currentContents).toContain('"detail":"rotated"');
  });

  it('acquires and releases generation locks', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'wormapb-locks-'));
    process.env.SCENE_DATA_DIR = tempDir;

    const acquired = await tryAcquireSceneGenerationLock(
      'scene-lock-test',
      'owner-a',
    );

    expect(acquired).toBe(true);
    await releaseSceneGenerationLock('scene-lock-test', 'owner-a');
    const reacquired = await tryAcquireSceneGenerationLock(
      'scene-lock-test',
      'owner-b',
    );

    expect(reacquired).toBe(true);
  });

  it('writes generation queue snapshots atomically', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'wormapb-queue-'));
    process.env.SCENE_DATA_DIR = tempDir;

    await writeSceneGenerationQueueSnapshot({
      ownerId: 'owner-a',
      updatedAt: '2026-04-16T00:00:00.000Z',
      isProcessingQueue: true,
      isShuttingDown: false,
      currentProcessingSceneId: 'scene-1',
      queuedSceneIds: ['scene-2'],
      queueDepth: 1,
    });

    const contents = await readFile(
      join(tempDir, 'generation-queue.json'),
      'utf8',
    );
    expect(JSON.parse(contents)).toEqual({
      ownerId: 'owner-a',
      updatedAt: '2026-04-16T00:00:00.000Z',
      isProcessingQueue: true,
      isShuttingDown: false,
      currentProcessingSceneId: 'scene-1',
      queuedSceneIds: ['scene-2'],
      queueDepth: 1,
    });
  });
});
