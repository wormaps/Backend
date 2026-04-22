import { describe, expect, it, vi, beforeEach, afterEach, beforeAll, afterAll } from 'bun:test';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { SceneTerrainProfileService } from '../src/scene/services/spatial/scene-terrain-profile.service';
import type { TerrainSample } from '../src/scene/types/scene.types';

const TEST_TERRAIN_DIR = join(process.cwd(), 'data', 'terrain', '.phase9-profile-temp');

function makeService(): SceneTerrainProfileService {
  return new SceneTerrainProfileService({
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    fromRequest: vi.fn(),
  } as any);
}

describe('Phase 9.1 TerrainProfile Domain', () => {
  let service: SceneTerrainProfileService;
  const originalTerrainDir = process.env.SCENE_TERRAIN_DIR;

  beforeAll(async () => {
    await rm(TEST_TERRAIN_DIR, { recursive: true, force: true });
    await mkdir(TEST_TERRAIN_DIR, { recursive: true });
    process.env.SCENE_TERRAIN_DIR = TEST_TERRAIN_DIR;
  });

  afterAll(() => {
    if (originalTerrainDir) {
      process.env.SCENE_TERRAIN_DIR = originalTerrainDir;
    } else {
      delete process.env.SCENE_TERRAIN_DIR;
    }
    void rm(TEST_TERRAIN_DIR, { recursive: true, force: true });
  });

  beforeEach(() => {
    service = makeService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('buildFromSamples', () => {
    it('returns DEM_FUSED profile with 4+ samples', () => {
      const samples: TerrainSample[] = [
        { location: { lat: 35.6, lng: 139.7 }, heightMeters: 40, source: 'OPEN_ELEVATION' },
        { location: { lat: 35.601, lng: 139.7 }, heightMeters: 42, source: 'OPEN_ELEVATION' },
        { location: { lat: 35.6, lng: 139.701 }, heightMeters: 41, source: 'OPEN_ELEVATION' },
        { location: { lat: 35.601, lng: 139.701 }, heightMeters: 43, source: 'OPEN_ELEVATION' },
      ];

      const profile = service.buildFromSamples(samples, 'OPEN_ELEVATION');

      expect(profile.mode).toBe('DEM_FUSED');
      expect(profile.source).toBe('OPEN_ELEVATION');
      expect(profile.hasElevationModel).toBe(true);
      expect(profile.sampleCount).toBe(4);
      expect(profile.minHeightMeters).toBe(40);
      expect(profile.maxHeightMeters).toBe(43);
      expect(profile.baseHeightMeters).toBe(40);
      expect(profile.interpolateElevation).toBeDefined();
    });

    it('falls back to FLAT when fewer than 3 samples', () => {
      const samples: TerrainSample[] = [
        { location: { lat: 35.6, lng: 139.7 }, heightMeters: 40, source: 'OPEN_ELEVATION' },
        { location: { lat: 35.601, lng: 139.7 }, heightMeters: 42, source: 'OPEN_ELEVATION' },
      ];

      const profile = service.buildFromSamples(samples, 'OPEN_ELEVATION');

      expect(profile.mode).toBe('FLAT_PLACEHOLDER');
      expect(profile.hasElevationModel).toBe(false);
      expect(profile.sampleCount).toBe(0);
    });

    it('clamps elevation values outside valid range', () => {
      const samples: TerrainSample[] = [
        { location: { lat: 35.6, lng: 139.7 }, heightMeters: -9999, source: 'OPEN_ELEVATION' },
        { location: { lat: 35.601, lng: 139.7 }, heightMeters: 99999, source: 'OPEN_ELEVATION' },
        { location: { lat: 35.6, lng: 139.701 }, heightMeters: 100, source: 'OPEN_ELEVATION' },
      ];

      const profile = service.buildFromSamples(samples, 'OPEN_ELEVATION');

      expect(profile.minHeightMeters).toBeGreaterThanOrEqual(-500);
      expect(profile.maxHeightMeters).toBeLessThanOrEqual(9000);
    });
  });

  describe('interpolateElevation', () => {
    it('interpolates intermediate coordinates accurately with 4 samples', () => {
      const samples: TerrainSample[] = [
        { location: { lat: 0, lng: 0 }, heightMeters: 10, source: 'OPEN_ELEVATION' },
        { location: { lat: 0, lng: 1 }, heightMeters: 20, source: 'OPEN_ELEVATION' },
        { location: { lat: 1, lng: 0 }, heightMeters: 30, source: 'OPEN_ELEVATION' },
        { location: { lat: 1, lng: 1 }, heightMeters: 40, source: 'OPEN_ELEVATION' },
      ];

      const profile = service.buildFromSamples(samples, 'OPEN_ELEVATION');
      expect(profile.interpolateElevation).toBeDefined();

      const center = profile.interpolateElevation!(0.5, 0.5);
      expect(center).toBeGreaterThan(10);
      expect(center).toBeLessThan(40);
    });

    it('returns exact sample height when query matches sample location', () => {
      const samples: TerrainSample[] = [
        { location: { lat: 35.6, lng: 139.7 }, heightMeters: 42.5, source: 'OPEN_ELEVATION' },
        { location: { lat: 35.601, lng: 139.7 }, heightMeters: 43.0, source: 'OPEN_ELEVATION' },
        { location: { lat: 35.6, lng: 139.701 }, heightMeters: 41.0, source: 'OPEN_ELEVATION' },
      ];

      const profile = service.buildFromSamples(samples, 'OPEN_ELEVATION');
      const exact = profile.interpolateElevation!(35.6, 139.7);
      expect(exact).toBe(42.5);
    });

    it('returns baseHeightMeters when no samples exist', () => {
      const profile = service.buildFromSamples([], 'NONE');
      expect(profile.interpolateElevation).toBeUndefined();
    });
  });

  describe('resolve() no-DEM fallback', () => {
    it('returns FLAT_PLACEHOLDER when no terrain file exists', async () => {
      const profile = await service.resolve('no-dem-scene-1', {
        bounds: {
          northEast: { lat: 35.61, lng: 139.71 },
          southWest: { lat: 35.59, lng: 139.69 },
        },
        origin: { lat: 35.6, lng: 139.7 },
        radiusM: 300,
      });

      expect(profile.mode).toBe('FLAT_PLACEHOLDER');
      expect(profile.source).toBe('NONE');
      expect(profile.hasElevationModel).toBe(false);
      expect(profile.heightReference).toBe('ELLIPSOID_APPROX');
      expect(profile.sampleCount).toBe(0);
      expect(profile.interpolateElevation).toBeUndefined();
    });

    it('returns FLAT_PLACEHOLDER when terrain file has insufficient samples', async () => {
      const terrainFile = join(TEST_TERRAIN_DIR, 'no-dem-scene-2.terrain.json');
      await writeFile(
        terrainFile,
        JSON.stringify({
          heightReference: 'LOCAL_DEM',
          notes: 'insufficient samples',
          samples: [
            { lat: 35.6, lng: 139.7, heightMeters: 40 },
          ],
        }),
        'utf8',
      );

      const profile = await service.resolve('no-dem-scene-2', {
        bounds: {
          northEast: { lat: 35.61, lng: 139.71 },
          southWest: { lat: 35.59, lng: 139.69 },
        },
        origin: { lat: 35.6, lng: 139.7 },
        radiusM: 300,
      });

      expect(profile.mode).toBe('FLAT_PLACEHOLDER');
      expect(profile.hasElevationModel).toBe(false);
      expect(profile.source).toBe('LOCAL_FILE');
      expect(profile.sampleCount).toBe(0);
    });

    it('returns FLAT_PLACEHOLDER when terrain file has zero valid samples', async () => {
      const terrainFile = join(TEST_TERRAIN_DIR, 'no-dem-scene-3.terrain.json');
      await writeFile(
        terrainFile,
        JSON.stringify({
          heightReference: 'LOCAL_DEM',
          notes: 'empty samples',
          samples: [],
        }),
        'utf8',
      );

      const profile = await service.resolve('no-dem-scene-3', {
        bounds: {
          northEast: { lat: 35.61, lng: 139.71 },
          southWest: { lat: 35.59, lng: 139.69 },
        },
        origin: { lat: 35.6, lng: 139.7 },
        radiusM: 300,
      });

      expect(profile.mode).toBe('FLAT_PLACEHOLDER');
      expect(profile.hasElevationModel).toBe(false);
      expect(profile.source).toBe('LOCAL_FILE');
    });
  });

  describe('resolve() DEM-backed mode', () => {
    it('returns DEM_FUSED when terrain file has sufficient samples', async () => {
      const terrainFile = join(TEST_TERRAIN_DIR, 'dem-scene-1.terrain.json');
      await writeFile(
        terrainFile,
        JSON.stringify({
          heightReference: 'LOCAL_DEM',
          notes: 'valid DEM samples',
          samples: [
            { lat: 35.6, lng: 139.7, heightMeters: 40 },
            { lat: 35.601, lng: 139.7, heightMeters: 42 },
            { lat: 35.6, lng: 139.701, heightMeters: 41 },
            { lat: 35.601, lng: 139.701, heightMeters: 43 },
          ],
        }),
        'utf8',
      );

      const profile = await service.resolve('dem-scene-1', {
        bounds: {
          northEast: { lat: 35.61, lng: 139.71 },
          southWest: { lat: 35.59, lng: 139.69 },
        },
        origin: { lat: 35.6, lng: 139.7 },
        radiusM: 300,
      });

      expect(profile.mode).toBe('DEM_FUSED');
      expect(profile.source).toBe('LOCAL_FILE');
      expect(profile.hasElevationModel).toBe(true);
      expect(profile.heightReference).toBe('LOCAL_DEM');
      expect(profile.sampleCount).toBe(4);
      expect(profile.interpolateElevation).toBeDefined();
    });
  });

  describe('interpolateElevation meter-based distance (Phase 4)', () => {
    it('uses meter-based distance, not raw degree delta', () => {
      // At latitude 60°, 1° longitude ≈ 55 km but 1° latitude ≈ 111 km.
      // Degree-based IDW treats degree deltas as Euclidean distance,
      // so A(60,0) and B(61,1) are both 1° from query(60,1) in different ways.
      //
      // Setup:
      //   A (60, 0) = 100 m  — 1° lng from query
      //   B (61, 1) = 200 m  — 1° lat from query
      //   C (60, 10) = 150 m — far away, minimal influence
      //   Query at (60, 1)
      //
      // Degree-based: dist(A)=1, dist(B)=1, dist(C)=9
      //   → A and B equal weight → (100+200)/2 = 150 m
      // Meter-based: dist(A)≈55.6km, dist(B)≈111.2km, dist(C)≈500km
      //   → A dominates (4x weight of B) → ~120 m

      const samples: TerrainSample[] = [
        { location: { lat: 60, lng: 0 }, heightMeters: 100, source: 'OPEN_ELEVATION' },
        { location: { lat: 61, lng: 1 }, heightMeters: 200, source: 'OPEN_ELEVATION' },
        { location: { lat: 60, lng: 10 }, heightMeters: 150, source: 'OPEN_ELEVATION' },
      ];

      const profile = service.buildFromSamples(samples, 'OPEN_ELEVATION');
      const result = profile.interpolateElevation!(60, 1);

      // Degree-based would give exactly 150 m (A and B equidistant at 1°).
      // Meter-based gives ~120 m because A is half the meter-distance of B.
      expect(result).toBeLessThan(130);
      expect(result).toBeGreaterThan(100);
    });

    it('produces different interpolation at high latitude vs equator for same degree offsets', () => {
      // Same degree geometry at equator vs latitude 60° should yield
      // different interpolated values because meter distances differ.
      //
      // Equator: A(0,0)=100, B(1,1)=200, C(0,10)=150, query(0,1)
      // High lat: A(60,0)=100, B(61,1)=200, C(60,10)=150, query(60,1)
      //
      // Degree-based: identical geometry → identical results
      // Meter-based: at equator 1°lng≈111km, at lat60° 1°lng≈55km
      //   → different distance ratios → different results

      const equatorSamples: TerrainSample[] = [
        { location: { lat: 0, lng: 0 }, heightMeters: 100, source: 'OPEN_ELEVATION' },
        { location: { lat: 1, lng: 1 }, heightMeters: 200, source: 'OPEN_ELEVATION' },
        { location: { lat: 0, lng: 10 }, heightMeters: 150, source: 'OPEN_ELEVATION' },
      ];
      const highLatSamples: TerrainSample[] = [
        { location: { lat: 60, lng: 0 }, heightMeters: 100, source: 'OPEN_ELEVATION' },
        { location: { lat: 61, lng: 1 }, heightMeters: 200, source: 'OPEN_ELEVATION' },
        { location: { lat: 60, lng: 10 }, heightMeters: 150, source: 'OPEN_ELEVATION' },
      ];

      const equatorProfile = service.buildFromSamples(equatorSamples, 'OPEN_ELEVATION');
      const highLatProfile = service.buildFromSamples(highLatSamples, 'OPEN_ELEVATION');

      const equatorResult = equatorProfile.interpolateElevation!(0, 1);
      const highLatResult = highLatProfile.interpolateElevation!(60, 1);

      // Meter-based interpolation must produce different results because
      // the meter-distance ratios differ between equator and high latitude.
      expect(equatorResult).not.toBe(highLatResult);
    });
  });
});
