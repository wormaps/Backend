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

describe('BuildController', () => {
  it('returns 400 when required fields are missing', async () => {
    const gateway = {
      build: async () => ({ kind: 'completed' }),
      getLatestGlb: () => null,
    };
    const controller = new BuildController(gateway as never);
    const res = createMockResponse();

    await controller.build({ sceneId: 's1', lat: undefined, lng: 127 } as never, res as never);

    expect(res.state.code).toBe(400);
    expect(res.state.body).toEqual({ error: 'sceneId, lat, lng required' });
  });
});
