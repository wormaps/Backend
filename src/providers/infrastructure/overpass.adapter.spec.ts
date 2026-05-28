import { describe, test, expect, beforeEach, mock, afterEach } from 'bun:test';
import { OverpassAdapter, type OverpassResponse } from './overpass.adapter';
import type { SceneScope } from '../../shared/contracts';

// Zero-delay subclass to avoid 5s timeouts in retry tests
class FastOverpassAdapter extends OverpassAdapter {
  protected override retryDelay(_attempt: number): number {
    return 0;
  }
}

const EMPTY_POLYGON = { outer: [] as Array<{ lat: number; lng: number }> };

// Seoul city hall – stable test coordinate
const TEST_SCOPE: SceneScope = {
  center: { lat: 37.5665, lng: 126.978 },
  boundaryType: 'radius',
  radiusMeters: 100,
  coreArea: EMPTY_POLYGON,
  contextArea: EMPTY_POLYGON,
};

function makeResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const SUCCESS_RESPONSE: OverpassResponse = {
  version: 0.6,
  elements: [
    {
      type: 'way',
      id: 1,
      geometry: [
        { lat: 37.5665, lon: 126.978 },
        { lat: 37.5666, lon: 126.979 },
        { lat: 37.5667, lon: 126.978 },
      ],
      tags: { building: 'yes', height: '10' },
    },
  ],
};

describe('OverpassAdapter', () => {
  let adapter: OverpassAdapter;
  let fetchMock: ReturnType<typeof mock>;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    fetchMock = mock(() => Promise.resolve(makeResponse(SUCCESS_RESPONSE)));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    adapter = new FastOverpassAdapter();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    fetchMock.mockRestore();
  });

  describe('queryBuildings', () => {
    test('returns building entities on success', async () => {
      const results = await adapter.queryBuildings(TEST_SCOPE);
      expect(results).toHaveLength(1);
      expect(results[0]!.entityType).toBe('building');
      expect(results[0]!.provider).toBe('osm');
    });

    test('sends [timeout:25] in query', async () => {
      await adapter.queryBuildings(TEST_SCOPE);
      const call = fetchMock.mock.calls[0];
      expect(call).toBeDefined();
      const body = (call![1] as RequestInit).body as string;
      expect(decodeURIComponent(body)).toContain('[timeout:25]');
    });

    test('sends correct bbox in query', async () => {
      await adapter.queryBuildings(TEST_SCOPE);
      const call = fetchMock.mock.calls[0];
      const body = decodeURIComponent((call![1] as RequestInit).body as string);
      // bbox format: south,west,north,east
      expect(body).toMatch(/\d+\.\d+,\d+\.\d+,\d+\.\d+,\d+\.\d+/);
    });

    test('filters ways with fewer than 3 geometry points', async () => {
      fetchMock.mockReturnValueOnce(
        Promise.resolve(
          makeResponse({
            version: 0.6,
            elements: [
              { type: 'way', id: 2, geometry: [{ lat: 37.5665, lon: 126.978 }], tags: { building: 'yes' } },
            ],
          }),
        ),
      );
      const results = await adapter.queryBuildings(TEST_SCOPE);
      expect(results).toHaveLength(0);
    });
  });

  describe('queryRoads', () => {
    test('returns road entities', async () => {
      fetchMock.mockReturnValueOnce(
        Promise.resolve(
          makeResponse({
            version: 0.6,
            elements: [
              {
                type: 'way',
                id: 10,
                geometry: [
                  { lat: 37.5665, lon: 126.978 },
                  { lat: 37.5666, lon: 126.979 },
                ],
                tags: { highway: 'primary' },
              },
            ],
          }),
        ),
      );
      const results = await adapter.queryRoads(TEST_SCOPE);
      expect(results).toHaveLength(1);
      expect(results[0]!.entityType).toBe('road');
    });
  });

  describe('executeQuery – error handling', () => {
    test('retries on 406 and succeeds', async () => {
      fetchMock
        .mockReturnValueOnce(Promise.resolve(makeResponse('', 406)))
        .mockReturnValueOnce(Promise.resolve(makeResponse(SUCCESS_RESPONSE)));

      const results = await adapter.queryBuildings(TEST_SCOPE);
      expect(fetchMock.mock.calls).toHaveLength(2);
      expect(results).toHaveLength(1);
    });

    test('retries on 429 and succeeds', async () => {
      fetchMock
        .mockReturnValueOnce(Promise.resolve(makeResponse('', 429)))
        .mockReturnValueOnce(Promise.resolve(makeResponse(SUCCESS_RESPONSE)));

      const results = await adapter.queryBuildings(TEST_SCOPE);
      expect(fetchMock.mock.calls).toHaveLength(2);
      expect(results).toHaveLength(1);
    });

    test('throws after exhausting retries', async () => {
      fetchMock.mockReturnValue(Promise.resolve(makeResponse('', 406)));
      let threw = false;
      try {
        await adapter.queryBuildings(TEST_SCOPE);
      } catch {
        threw = true;
      }
      expect(threw).toBe(true);
    });

    test('throws on 500 error after retries exhausted', async () => {
      // 500 gets caught and retried — mock all 3 attempts
      fetchMock
        .mockReturnValueOnce(Promise.resolve(makeResponse('', 500)))
        .mockReturnValueOnce(Promise.resolve(makeResponse('', 500)))
        .mockReturnValueOnce(Promise.resolve(makeResponse('', 500)));
      let errorMsg = '';
      try {
        await adapter.queryBuildings(TEST_SCOPE);
      } catch (err) {
        errorMsg = err instanceof Error ? err.message : String(err);
      }
      expect(errorMsg).toContain('Overpass API error: 500');
    });
  });

  describe('height inference', () => {
    test('uses explicit height tag', async () => {
      fetchMock.mockReturnValueOnce(
        Promise.resolve(
          makeResponse({
            version: 0.6,
            elements: [
              {
                type: 'way',
                id: 20,
                geometry: [
                  { lat: 37.5665, lon: 126.978 },
                  { lat: 37.5666, lon: 126.979 },
                  { lat: 37.5667, lon: 126.978 },
                ],
                tags: { building: 'yes', height: '15' },
              },
            ],
          }),
        ),
      );
      const results = await adapter.queryBuildings(TEST_SCOPE);
      expect((results[0]!.geometry as { height: number }).height).toBe(15);
    });

    test('derives height from building:levels', async () => {
      fetchMock.mockReturnValueOnce(
        Promise.resolve(
          makeResponse({
            version: 0.6,
            elements: [
              {
                type: 'way',
                id: 21,
                geometry: [
                  { lat: 37.5665, lon: 126.978 },
                  { lat: 37.5666, lon: 126.979 },
                  { lat: 37.5667, lon: 126.978 },
                ],
                tags: { building: 'yes', 'building:levels': '3' },
              },
            ],
          }),
        ),
      );
      const results = await adapter.queryBuildings(TEST_SCOPE);
      // 3 levels × 3.5m = 10.5
      expect((results[0]!.geometry as { height: number }).height).toBe(10.5);
    });

    test('falls back to building-type default', async () => {
      fetchMock.mockReturnValueOnce(
        Promise.resolve(
          makeResponse({
            version: 0.6,
            elements: [
              {
                type: 'way',
                id: 22,
                geometry: [
                  { lat: 37.5665, lon: 126.978 },
                  { lat: 37.5666, lon: 126.979 },
                  { lat: 37.5667, lon: 126.978 },
                ],
                tags: { building: 'church' },
              },
            ],
          }),
        ),
      );
      const results = await adapter.queryBuildings(TEST_SCOPE);
      expect((results[0]!.geometry as { height: number }).height).toBe(14);
    });
  });

  describe('OVERPASS_API_URLS env', () => {
    test('uses custom URL from env', async () => {
      process.env.OVERPASS_API_URLS = 'https://custom.example.com/api/interpreter';
      const customAdapter = new FastOverpassAdapter();
      fetchMock.mockReturnValueOnce(Promise.resolve(makeResponse(SUCCESS_RESPONSE)));

      await customAdapter.queryBuildings(TEST_SCOPE);

      const url = fetchMock.mock.calls[0]![0] as string;
      expect(url).toBe('https://custom.example.com/api/interpreter');
      delete process.env.OVERPASS_API_URLS;
    });

    test('falls back to default URL when env not set', async () => {
      delete process.env.OVERPASS_API_URLS;
      const defaultAdapter = new FastOverpassAdapter();
      fetchMock.mockReturnValueOnce(Promise.resolve(makeResponse(SUCCESS_RESPONSE)));

      await defaultAdapter.queryBuildings(TEST_SCOPE);

      const url = fetchMock.mock.calls[0]![0] as string;
      expect(url).toBe('https://overpass-api.de/api/interpreter');
    });
  });
});
