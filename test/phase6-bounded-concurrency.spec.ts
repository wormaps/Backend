import { afterEach, beforeEach, describe, expect, it, vi } from 'bun:test';
import { BoundedSemaphore, mapWithBoundedConcurrency } from '../src/common/concurrency/bounded-semaphore';
import { TomTomTrafficClient } from '../src/places/clients/tomtom-traffic.client';

// ─── BoundedSemaphore unit tests ───────────────────────────────────────────

describe('BoundedSemaphore', () => {
  it('allows up to limit concurrent operations', async () => {
    const semaphore = new BoundedSemaphore(2);
    let concurrent = 0;
    let maxConcurrent = 0;

    const run = async () => {
      await semaphore.acquire();
      concurrent++;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      await new Promise((r) => setTimeout(r, 10));
      concurrent--;
      semaphore.release();
    };

    await Promise.all(Array.from({ length: 5 }, () => run()));

    expect(maxConcurrent).toBe(2);
  });

  it('serializes when limit=1', async () => {
    const semaphore = new BoundedSemaphore(1);
    let concurrent = 0;
    let maxConcurrent = 0;

    const run = async () => {
      await semaphore.acquire();
      concurrent++;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      await new Promise((r) => setTimeout(r, 10));
      concurrent--;
      semaphore.release();
    };

    await Promise.all(Array.from({ length: 3 }, () => run()));

    expect(maxConcurrent).toBe(1);
  });

  it('run() helper acquires and releases correctly', async () => {
    const semaphore = new BoundedSemaphore(1);
    let concurrent = 0;
    let maxConcurrent = 0;

    const results = await Promise.all(
      Array.from({ length: 3 }, (_, i) =>
        semaphore.run(async () => {
          concurrent++;
          maxConcurrent = Math.max(maxConcurrent, concurrent);
          await new Promise((r) => setTimeout(r, 10));
          concurrent--;
          return i * 2;
        }),
      ),
    );

    expect(maxConcurrent).toBe(1);
    expect(results).toEqual([0, 2, 4]);
  });

  it('releases correctly even when operation throws', async () => {
    const semaphore = new BoundedSemaphore(1);

    await expect(
      semaphore.run(async () => {
        throw new Error('test error');
      }),
    ).rejects.toThrow('test error');

    const result = await semaphore.run(async () => 'success');
    expect(result).toBe('success');
  });

  it('does not serialize across different instances', async () => {
    const semA = new BoundedSemaphore(1);
    const semB = new BoundedSemaphore(1);
    let concurrent = 0;
    let maxConcurrent = 0;

    const run = async (sem: BoundedSemaphore) => {
      await sem.acquire();
      concurrent++;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      await new Promise((r) => setTimeout(r, 30));
      concurrent--;
      sem.release();
    };

    await Promise.all([run(semA), run(semB)]);

    expect(maxConcurrent).toBe(2);
  });
});

// ─── mapWithBoundedConcurrency tests ───────────────────────────────────────

describe('mapWithBoundedConcurrency', () => {
  it('processes items with bounded concurrency', async () => {
    let concurrent = 0;
    let maxConcurrent = 0;

    const results = await mapWithBoundedConcurrency(
      [1, 2, 3, 4, 5],
      2,
      async (item) => {
        concurrent++;
        maxConcurrent = Math.max(maxConcurrent, concurrent);
        await new Promise((r) => setTimeout(r, 10));
        concurrent--;
        return item * 10;
      },
    );

    expect(maxConcurrent).toBe(2);
    expect(results).toEqual([10, 20, 30, 40, 50]);
  });

  it('preserves result order', async () => {
    const results = await mapWithBoundedConcurrency(
      [3, 1, 2],
      1,
      async (item) => {
        await new Promise((r) => setTimeout(r, 10));
        return item;
      },
    );

    expect(results).toEqual([3, 1, 2]);
  });

  it('re-throws errors when no onError handler', async () => {
    await expect(
      mapWithBoundedConcurrency(
        [1, 2, 3],
        2,
        async (item) => {
          if (item === 2) throw new Error('fail');
          return item;
        },
      ),
    ).rejects.toThrow('fail');
  });

  it('uses onError handler to recover from errors', async () => {
    const errors: Array<{ error: unknown; item: number }> = [];

    const results = await mapWithBoundedConcurrency(
      [1, 2, 3],
      2,
      async (item) => {
        if (item === 2) throw new Error('fail');
        return item * 10;
      },
      (error, item) => {
        errors.push({ error, item });
        return -1;
      },
    );

    expect(results).toEqual([10, -1, 30]);
    expect(errors).toHaveLength(1);
    expect(errors[0]!.item).toBe(2);
  });

  it('handles empty input', async () => {
    const results = await mapWithBoundedConcurrency(
      [],
      4,
      async (item: number) => item,
    );

    expect(results).toEqual([]);
  });
});

// ─── TomTomTrafficClient bounded concurrency tests ─────────────────────────

describe('Phase 6. TomTomTrafficClient bounded concurrency', () => {
  let client: TomTomTrafficClient;

  beforeEach(() => {
    process.env.TOMTOM_API_KEY = 'test-key';
    client = new TomTomTrafficClient();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.TOMTOM_API_KEY;
  });

  function buildMockResponse(): Response {
    const body = JSON.stringify({
      flowSegmentData: {
        currentSpeed: 24,
        freeFlowSpeed: 30,
        confidence: 0.8,
        roadClosure: false,
      },
    });
    return new Response(body, { status: 200 });
  }

  it('bounds concurrent getFlowSegmentWithEnvelope calls — max 4 in-flight', async () => {
    let concurrent = 0;
    let maxConcurrent = 0;

    const mockFetch = async () => {
      concurrent++;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      await new Promise((r) => setTimeout(r, 30));
      concurrent--;
      return buildMockResponse();
    };

    client.withFetcher(mockFetch as unknown as typeof fetch);

    const points = Array.from({ length: 10 }, (_, i) => ({
      lat: 37.5 + i * 0.01,
      lng: 126.9 + i * 0.01,
    }));

    const calls = points.map((point) =>
      client.getFlowSegmentWithEnvelope(point),
    );
    await Promise.all(calls);

    expect(maxConcurrent).toBeLessThanOrEqual(4);
  });

  it('bounds concurrent getFlowSegment calls — max 4 in-flight', async () => {
    let concurrent = 0;
    let maxConcurrent = 0;

    const mockFetch = async () => {
      concurrent++;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      await new Promise((r) => setTimeout(r, 30));
      concurrent--;
      return buildMockResponse();
    };

    client.withFetcher(mockFetch as unknown as typeof fetch);

    const points = Array.from({ length: 8 }, (_, i) => ({
      lat: 37.5 + i * 0.01,
      lng: 126.9 + i * 0.01,
    }));

    const calls = points.map((point) => client.getFlowSegment(point));
    await Promise.all(calls);

    expect(maxConcurrent).toBeLessThanOrEqual(4);
  });

  it('still returns correct results under bounded concurrency', async () => {
    const mockFetch = async () => buildMockResponse();
    client.withFetcher(mockFetch as unknown as typeof fetch);

    const points = Array.from({ length: 5 }, (_, i) => ({
      lat: 37.5 + i * 0.01,
      lng: 126.9 + i * 0.01,
    }));

    const results = await Promise.all(
      points.map((point) => client.getFlowSegmentWithEnvelope(point)),
    );

    expect(results).toHaveLength(5);
    for (const r of results) {
      expect(r.data?.flowSegmentData?.currentSpeed).toBe(24);
      expect(r.data?.flowSegmentData?.freeFlowSpeed).toBe(30);
    }
  });

  it('propagates errors correctly under bounded concurrency', async () => {
    let callCount = 0;
    const mockFetch = async () => {
      callCount++;
      return new Response('error', { status: 500 });
    };
    client.withFetcher(mockFetch as unknown as typeof fetch);

    const points = Array.from({ length: 3 }, (_, i) => ({
      lat: 37.5 + i * 0.01,
      lng: 126.9 + i * 0.01,
    }));

    const results = await Promise.allSettled(
      points.map((point) => client.getFlowSegmentWithEnvelope(point)),
    );

    for (const r of results) {
      expect(r.status).toBe('rejected');
    }
    // Each point tries 2 hosts (primary + fallback), so 3 * 2 = 6 fetch calls
    expect(callCount).toBe(6);
  });

  it('does not bound concurrency across different client instances', async () => {
    let concurrent = 0;
    let maxConcurrent = 0;

    const mockFetch = async () => {
      concurrent++;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      await new Promise((r) => setTimeout(r, 50));
      concurrent--;
      return buildMockResponse();
    };

    const clientA = new TomTomTrafficClient();
    clientA.withFetcher(mockFetch as unknown as typeof fetch);
    const clientB = new TomTomTrafficClient();
    clientB.withFetcher(mockFetch as unknown as typeof fetch);

    const calls = [
      clientA.getFlowSegmentWithEnvelope({ lat: 37.5, lng: 126.9 }),
      clientB.getFlowSegmentWithEnvelope({ lat: 37.6, lng: 127.0 }),
      clientA.getFlowSegmentWithEnvelope({ lat: 37.7, lng: 127.1 }),
      clientB.getFlowSegmentWithEnvelope({ lat: 37.8, lng: 127.2 }),
      clientA.getFlowSegmentWithEnvelope({ lat: 37.9, lng: 127.3 }),
    ];
    await Promise.all(calls);

    expect(maxConcurrent).toBeGreaterThan(4);
  });

  it('handles mixed success/failure with bounded concurrency', async () => {
    let callCount = 0;
    const mockFetch = async () => {
      callCount++;
      if (callCount % 5 === 0) {
        return new Response('error', { status: 500 });
      }
      return buildMockResponse();
    };
    client.withFetcher(mockFetch as unknown as typeof fetch);

    const points = Array.from({ length: 6 }, (_, i) => ({
      lat: 37.5 + i * 0.01,
      lng: 126.9 + i * 0.01,
    }));

    const results = await Promise.allSettled(
      points.map((point) => client.getFlowSegmentWithEnvelope(point)),
    );

    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;
    // With 6 points * 2 hosts = 12 potential fetch calls.
    // Every 5th call fails. Host retry means some points succeed on 2nd attempt.
    expect(succeeded + failed).toBe(6);
    expect(callCount).toBeGreaterThan(6);
  });
});

// ─── Traffic service integration with bounded concurrency ──────────────────

describe('Phase 6. SceneTrafficLiveService with bounded TomTom concurrency', () => {
  let sceneTrafficLiveService: import('../src/scene/services/live/scene-traffic-live.service').SceneTrafficLiveService;
  let sceneReadService: { getReadyScene: ReturnType<typeof vi.fn> };
  let sceneRepository: { update: ReturnType<typeof vi.fn> };
  let tomTomTrafficClient: TomTomTrafficClient;
  let appLoggerService: { warn: ReturnType<typeof vi.fn> };

  const readyScene = {
    requestId: 'req-1',
    meta: {
      roads: Array.from({ length: 8 }, (_, i) => ({
        objectId: `road-${i}`,
        center: { lat: 37.5665 + i * 0.01, lng: 126.978 + i * 0.01 },
      })),
    },
    latestTrafficSnapshot: undefined,
  };

  beforeEach(() => {
    process.env.TOMTOM_API_KEY = 'test-key';

    sceneReadService = {
      getReadyScene: vi.fn().mockResolvedValue(readyScene),
    };
    sceneRepository = {
      update: vi.fn().mockResolvedValue(undefined),
    };
    tomTomTrafficClient = new TomTomTrafficClient();
    appLoggerService = {
      warn: vi.fn(),
    };

    const { SceneTrafficLiveService } = require('../src/scene/services/live/scene-traffic-live.service');
    const { TtlCacheService } = require('../src/cache/ttl-cache.service');

    sceneTrafficLiveService = new SceneTrafficLiveService(
      sceneReadService as any,
      sceneRepository as any,
      new TtlCacheService(100, undefined),
      tomTomTrafficClient,
      appLoggerService as any,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.TOMTOM_API_KEY;
  });

  it('sampleTrafficByRoads respects TomTom client concurrency limit', async () => {
    let concurrent = 0;
    let maxConcurrent = 0;

    const mockFetch = async () => {
      concurrent++;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      await new Promise((r) => setTimeout(r, 20));
      concurrent--;
      const body = JSON.stringify({
        flowSegmentData: {
          currentSpeed: 20,
          freeFlowSpeed: 30,
          confidence: 0.7,
          roadClosure: false,
        },
      });
      return new Response(body, { status: 200 });
    };

    tomTomTrafficClient.withFetcher(mockFetch as unknown as typeof fetch);

    const roads = Array.from({ length: 10 }, (_, i) => ({
      objectId: `road-${i}`,
      center: { lat: 37.5 + i * 0.01, lng: 126.9 + i * 0.01 },
    }));

    const result = await sceneTrafficLiveService.sampleTrafficByRoads(roads);

    expect(maxConcurrent).toBeLessThanOrEqual(4);
    expect(result.segments).toHaveLength(10);
    expect(result.provider).toBe('TOMTOM');
    expect(result.failedSegmentCount).toBe(0);
  });

  it('sampleTrafficByRoads handles partial failures with bounded concurrency', async () => {
    const failPoints = new Set(['road-2', 'road-5']);
    const mockFetch = async (input: string | URL | Request) => {
      const urlString = typeof input === 'string' ? input : input.toString();
      const match = urlString.match(/point=([\d.]+),([\d.]+)/);
      if (match) {
        const lat = parseFloat(match[1]!);
        const idx = Math.round((lat - 37.5) / 0.01);
        const roadId = `road-${idx}`;
        if (failPoints.has(roadId)) {
          return new Response('error', { status: 500 });
        }
      }
      const body = JSON.stringify({
        flowSegmentData: {
          currentSpeed: 25,
          freeFlowSpeed: 30,
          confidence: 0.8,
          roadClosure: false,
        },
      });
      return new Response(body, { status: 200 });
    };

    tomTomTrafficClient.withFetcher(mockFetch as unknown as typeof fetch);

    const roads = Array.from({ length: 8 }, (_, i) => ({
      objectId: `road-${i}`,
      center: { lat: 37.5 + i * 0.01, lng: 126.9 + i * 0.01 },
    }));

    const result = await sceneTrafficLiveService.sampleTrafficByRoads(roads);

    expect(result.segments).toHaveLength(8);
    expect(result.failedSegmentCount).toBe(2);
    expect(result.provider).toBe('TOMTOM');
    const failedSegments = result.segments.filter((s) => s.congestionScore === 0);
    expect(failedSegments).toHaveLength(2);
  });
});
