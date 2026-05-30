import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';

import type { SceneScope } from '../../shared/contracts';
import { Google3dTilesAdapter } from './google-3dtiles.adapter';

const EMPTY_POLYGON = { outer: [] as Array<{ lat: number; lng: number }> };

const TEST_SCOPE: SceneScope = {
  center: { lat: 37.5665, lng: 126.978 },
  boundaryType: 'radius',
  radiusMeters: 100,
  coreArea: EMPTY_POLYGON,
  contextArea: EMPTY_POLYGON,
};

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function glbResponse(): Response {
  return new Response(new Uint8Array([0x67, 0x6c, 0x54, 0x46, 2, 0, 0, 0]), {
    status: 200,
    headers: { 'Content-Type': 'model/gltf-binary' },
  });
}

describe('Google3dTilesAdapter', () => {
  let originalFetch: typeof globalThis.fetch;
  let originalGoogleApiKey: string | undefined;
  let originalGoogleMapsApiKey: string | undefined;
  let originalGoogle3dTilesApiKey: string | undefined;
  let originalGoogle3dTilesRootUrl: string | undefined;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    originalGoogleApiKey = process.env.GOOGLE_API_KEY;
    originalGoogleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;
    originalGoogle3dTilesApiKey = process.env.GOOGLE_3D_TILES_API_KEY;
    originalGoogle3dTilesRootUrl = process.env.GOOGLE_3D_TILES_ROOT_URL;
    delete process.env.GOOGLE_MAPS_API_KEY;
    delete process.env.GOOGLE_3D_TILES_API_KEY;
    delete process.env.GOOGLE_3D_TILES_ROOT_URL;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    restoreEnv('GOOGLE_API_KEY', originalGoogleApiKey);
    restoreEnv('GOOGLE_MAPS_API_KEY', originalGoogleMapsApiKey);
    restoreEnv('GOOGLE_3D_TILES_API_KEY', originalGoogle3dTilesApiKey);
    restoreEnv('GOOGLE_3D_TILES_ROOT_URL', originalGoogle3dTilesRootUrl);
  });

  test('uses GOOGLE_API_KEY for root tileset requests', async () => {
    process.env.GOOGLE_API_KEY = 'test-google-key';
    const fetchMock = mock((url: string | URL | Request) => {
      const href = String(url);
      if (href.includes('/root.json')) {
        return Promise.resolve(
          jsonResponse({
            root: {
              geometricError: 0,
              content: { uri: 'tile.glb' },
            },
          }),
        );
      }
      return Promise.resolve(glbResponse());
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const adapter = new Google3dTilesAdapter();
    const tiles = await adapter.fetchPhotorealTiles({
      scope: TEST_SCOPE,
      maxGeometricError: 8,
    });

    expect(tiles).toHaveLength(1);
    expect(String(fetchMock.mock.calls[0]![0])).toContain('key=test-google-key');
  });

  test('accepts opaque content URIs when the response bytes are GLB', async () => {
    process.env.GOOGLE_API_KEY = 'test-google-key';
    process.env.GOOGLE_3D_TILES_ROOT_URL = 'https://example.test/root.json';
    const fetchMock = mock((url: string | URL | Request) => {
      const href = String(url);
      if (href.endsWith('/root.json')) {
        return Promise.resolve(
          jsonResponse({
            root: {
              geometricError: 0,
              content: { uri: 'files/opaque-content-id' },
            },
          }),
        );
      }
      return Promise.resolve(glbResponse());
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const adapter = new Google3dTilesAdapter();
    const tiles = await adapter.fetchPhotorealTiles({
      scope: TEST_SCOPE,
      maxGeometricError: 8,
    });

    expect(tiles).toHaveLength(1);
    expect(tiles[0]!.uri).toBe('https://example.test/files/opaque-content-id');
  });

  test('treats json content URIs with session query strings as nested tilesets', async () => {
    process.env.GOOGLE_API_KEY = 'test-google-key';
    process.env.GOOGLE_3D_TILES_ROOT_URL = 'https://example.test/root.json';
    const fetchMock = mock((url: string | URL | Request) => {
      const href = String(url);
      if (href.endsWith('/root.json')) {
        return Promise.resolve(
          jsonResponse({
            root: {
              geometricError: 0,
              content: { uri: 'files/nested.json?session=session-id' },
            },
          }),
        );
      }
      if (href.includes('/files/nested.json?session=session-id')) {
        return Promise.resolve(
          jsonResponse({
            root: {
              geometricError: 0,
              content: { uri: 'opaque-glb-content' },
            },
          }),
        );
      }
      return Promise.resolve(glbResponse());
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const adapter = new Google3dTilesAdapter();
    const tiles = await adapter.fetchPhotorealTiles({
      scope: TEST_SCOPE,
      maxGeometricError: 8,
    });

    expect(tiles).toHaveLength(1);
    expect(tiles[0]!.uri).toBe('https://example.test/files/opaque-glb-content?session=session-id');
  });

  test('adds the API key to Google tile content requests without exposing it in returned metadata', async () => {
    process.env.GOOGLE_3D_TILES_API_KEY = 'test-google-key';
    process.env.GOOGLE_3D_TILES_ROOT_URL = 'https://tile.googleapis.com/v1/3dtiles/root.json?session=session-id';
    const requestedUrls: string[] = [];
    const fetchMock = mock((url: string | URL | Request) => {
      const href = String(url);
      requestedUrls.push(href);
      if (href.includes('/root.json')) {
        return Promise.resolve(
          jsonResponse({
            root: {
              geometricError: 0,
              content: { uri: 'datasets/example/files/opaque-content' },
            },
          }),
        );
      }
      return Promise.resolve(glbResponse());
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const adapter = new Google3dTilesAdapter();
    const tiles = await adapter.fetchPhotorealTiles({
      scope: TEST_SCOPE,
      maxGeometricError: 8,
    });

    expect(requestedUrls[1]).toContain('session=session-id');
    expect(requestedUrls[1]).toContain('key=test-google-key');
    expect(tiles[0]!.uri).toContain('key=REDACTED');
  });

  test('uses intersecting renderable content as fallback when no LOD stop candidate exists', async () => {
    process.env.GOOGLE_3D_TILES_API_KEY = 'test-google-key';
    process.env.GOOGLE_3D_TILES_ROOT_URL = 'https://tile.googleapis.com/v1/3dtiles/root.json';
    const fetchMock = mock((url: string | URL | Request) => {
      const href = String(url);
      if (href.includes('/root.json')) {
        return Promise.resolve(
          jsonResponse({
            root: {
              geometricError: 256,
              content: { uri: 'datasets/example/files/parent-content' },
              children: [
                {
                  geometricError: 128,
                  content: { uri: 'datasets/example/files/child.json?session=session-id' },
                },
              ],
            },
          }),
        );
      }
      if (href.includes('/child.json')) {
        return Promise.resolve(
          jsonResponse({
            root: {
              geometricError: 64,
              children: [],
            },
          }),
        );
      }
      return Promise.resolve(glbResponse());
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const adapter = new Google3dTilesAdapter();
    const tiles = await adapter.fetchPhotorealTiles({
      scope: TEST_SCOPE,
      maxGeometricError: 8,
    });

    expect(tiles).toHaveLength(1);
    expect(tiles[0]!.uri).toContain('/parent-content');
  });
  test('selects a fine tile whose small bounding sphere sits at the scope center (WGS84 ellipsoid ECEF)', async () => {
    process.env.GOOGLE_API_KEY = 'test-google-key';
    // True WGS84 ellipsoid ECEF of the scope center. A spherical earth model is
    // ~20km off here, which would push this 80m-radius sphere out of scope.
    const A = 6_378_137;
    const E2 = 6.69437999014e-3;
    const phi = (TEST_SCOPE.center.lat * Math.PI) / 180;
    const lambda = (TEST_SCOPE.center.lng * Math.PI) / 180;
    const sinPhi = Math.sin(phi);
    const cosPhi = Math.cos(phi);
    const N = A / Math.sqrt(1 - E2 * sinPhi * sinPhi);
    const cx = N * cosPhi * Math.cos(lambda);
    const cy = N * cosPhi * Math.sin(lambda);
    const cz = N * (1 - E2) * sinPhi;

    const fetchMock = mock((url: string | URL | Request) => {
      const href = String(url);
      if (href.includes('/root.json')) {
        return Promise.resolve(
          jsonResponse({
            root: {
              geometricError: 0,
              boundingVolume: { sphere: [cx, cy, cz, 80] },
              content: { uri: 'fine-tile.glb' },
            },
          }),
        );
      }
      return Promise.resolve(glbResponse());
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const adapter = new Google3dTilesAdapter();
    const tiles = await adapter.fetchPhotorealTiles({
      scope: TEST_SCOPE,
      maxGeometricError: 8,
    });

    expect(tiles).toHaveLength(1);
    expect(tiles[0]!.uri).toContain('/fine-tile.glb');
  });
});

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}
