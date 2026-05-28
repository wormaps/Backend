import { describe, expect, it } from 'bun:test';

import { BuildController } from '../../src/api/build.controller';

function createMockResponse() {
  const state: { code?: number; body?: unknown } = {};
  return {
    state,
    status(code: number) {
      state.code = code;
      return this;
    },
    json(body: unknown) {
      state.body = body;
      return this;
    },
    setHeader() {
      return this;
    },
    send(body: unknown) {
      state.body = body;
      return this;
    },
  };
}

const mockJobStore = {
  list: () => [],
  getJob: () => undefined,
  getBytes: () => undefined,
  readDiskCache: () => Promise.resolve(null),
};

describe('BuildController', () => {
  it('returns 400 when required fields are missing', async () => {
    const gateway = {
      enqueueBuild: () => 'job:s1:123',
      getLatestGlb: () => null,
    };
    const controller = new BuildController(gateway as never, mockJobStore as never);
    const res = createMockResponse();

    await controller.build({ sceneId: 's1', lat: undefined, lng: 127 } as never, res as never);

    expect(res.state.code).toBe(400);
    expect(res.state.body).toEqual({ error: 'sceneId, lat, lng required' });
  });

  it('returns 202 with jobId when build is enqueued', async () => {
    const gateway = {
      enqueueBuild: () => 'job:scene-test:999',
      getLatestGlb: () => null,
    };
    const controller = new BuildController(gateway as never, mockJobStore as never);
    const res = createMockResponse();

    await controller.build({ sceneId: 'scene-test', lat: 37.5, lng: 127.0 }, res as never);

    expect(res.state.code).toBe(202);
    expect((res.state.body as Record<string, unknown>).jobId).toBe('job:scene-test:999');
    expect((res.state.body as Record<string, unknown>).status).toBe('queued');
  });
});
