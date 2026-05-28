import { describe, expect, it } from 'bun:test';

import { InMemoryBuildJobStoreService } from '../../src/build/application';

describe('InMemoryBuildJobStoreService', () => {
  it('transitions queued -> running -> completed', () => {
    const store = new InMemoryBuildJobStoreService();
    const queued = store.enqueue({
      buildId: 'build-1',
      sceneId: 'scene-a',
      createdAt: '2026-05-28T10:00:00.000Z',
    });
    expect(queued.status).toBe('queued');

    const running = store.markRunning('build-1', '2026-05-28T10:00:05.000Z');
    expect(running.status).toBe('running');
    expect(running.startedAt).toBe('2026-05-28T10:00:05.000Z');

    const completed = store.markCompleted('build-1', {
      artifactHash: 'sha256:abc',
      byteLength: 12345,
      finishedAt: '2026-05-28T10:00:30.000Z',
    });
    expect(completed.status).toBe('completed');
    expect(completed.artifactHash).toBe('sha256:abc');
    expect(completed.byteLength).toBe(12345);
  });

  it('allows queued -> failed and lists by scene', () => {
    const store = new InMemoryBuildJobStoreService();
    store.enqueue({ buildId: 'b-1', sceneId: 'scene-a', createdAt: '2026-05-28T10:00:00.000Z' });
    store.enqueue({ buildId: 'b-2', sceneId: 'scene-a', createdAt: '2026-05-28T10:00:01.000Z' });
    store.markFailed('b-2', { errorMessage: 'network fail', finishedAt: '2026-05-28T10:00:02.000Z' });

    const sceneJobs = store.listByScene('scene-a');
    expect(sceneJobs.length).toBe(2);
    expect(sceneJobs[0]?.buildId).toBe('b-2');
    expect(sceneJobs[0]?.status).toBe('failed');
  });

  it('rejects invalid transitions', () => {
    const store = new InMemoryBuildJobStoreService();
    store.enqueue({ buildId: 'b-3', sceneId: 'scene-a' });
    expect(() => store.markCompleted('b-3', {})).toThrow();
  });
});
