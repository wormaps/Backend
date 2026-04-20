import { describe, expect, it, vi, afterEach } from 'bun:test';
import { OpenElevationAdapter } from '../src/scene/infrastructure/terrain/open-elevation.adapter';
import type { Coordinate } from '../src/places/types/place.types';
import type { AppLoggerService } from '../src/common/logging/app-logger.service';

const mockLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
} as unknown as AppLoggerService;

describe('Phase 9.2 DemAdapter Infrastructure', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 64 TerrainSample for 8x8 grid points on success', async () => {
    const points: Coordinate[] = [];
    for (let i = 0; i < 64; i++) {
      points.push({ lat: 35.6 + i * 0.001, lng: 139.7 + i * 0.001 });
    }

    const mockResults = points.map((p) => ({
      latitude: p.lat,
      longitude: p.lng,
      elevation: 40 + Math.random() * 10,
    }));

    const adapter = new OpenElevationAdapter(mockLogger, {
      baseUrl: 'https://mock-open-elevation.test/api/v1/lookup',
      timeoutMs: 5000,
    });

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ results: mockResults }),
    } as Response);

    const samples = await adapter.fetchElevations(points);

    expect(samples).toHaveLength(64);
    expect(samples[0].source).toBe('OPEN_ELEVATION');
    expect(samples[0].location.lat).toBe(35.6);
    expect(samples[0].location.lng).toBe(139.7);
    expect(Number.isFinite(samples[0].heightMeters)).toBe(true);
  });

  it('returns empty array on API 500 error', async () => {
    const points: Coordinate[] = [{ lat: 35.6, lng: 139.7 }];

    const adapter = new OpenElevationAdapter(mockLogger, {
      baseUrl: 'https://mock-open-elevation.test/api/v1/lookup',
      timeoutMs: 5000,
    });

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 500,
    } as Response);

    const samples = await adapter.fetchElevations(points);
    expect(samples).toEqual([]);
  });

  it('returns empty array on timeout', async () => {
    const points: Coordinate[] = [{ lat: 35.6, lng: 139.7 }];

    const adapter = new OpenElevationAdapter(mockLogger, {
      baseUrl: 'https://mock-open-elevation.test/api/v1/lookup',
      timeoutMs: 10,
    });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(
      () => new Promise<Response>((_resolve, reject) => {
        setTimeout(() => reject(new DOMException('Aborted', 'AbortError')), 100);
      }),
    ) as unknown as typeof fetch;

    try {
      const samples = await adapter.fetchElevations(points);
      expect(samples).toEqual([]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('returns empty array on network error', async () => {
    const points: Coordinate[] = [{ lat: 35.6, lng: 139.7 }];

    const adapter = new OpenElevationAdapter(mockLogger, {
      baseUrl: 'https://mock-open-elevation.test/api/v1/lookup',
      timeoutMs: 5000,
    });

    vi.spyOn(globalThis, 'fetch').mockRejectedValue(
      new Error('network error'),
    );

    const samples = await adapter.fetchElevations(points);
    expect(samples).toEqual([]);
  });

  it('returns empty array for empty input', async () => {
    const adapter = new OpenElevationAdapter(mockLogger);
    const samples = await adapter.fetchElevations([]);
    expect(samples).toEqual([]);
  });

  it('filters out results with non-finite elevation', async () => {
    const points: Coordinate[] = [
      { lat: 35.6, lng: 139.7 },
      { lat: 35.601, lng: 139.701 },
    ];

    const adapter = new OpenElevationAdapter(mockLogger, {
      baseUrl: 'https://mock-open-elevation.test/api/v1/lookup',
      timeoutMs: 5000,
    });

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          { latitude: 35.6, longitude: 139.7, elevation: 42.5 },
          { latitude: 35.601, longitude: 139.701, elevation: NaN },
        ],
      }),
    } as Response);

    const samples = await adapter.fetchElevations(points);
    expect(samples).toHaveLength(1);
    expect(samples[0].heightMeters).toBe(42.5);
  });
});
