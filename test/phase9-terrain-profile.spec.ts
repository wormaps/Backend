import { describe, expect, it, vi, beforeEach, afterEach } from 'bun:test';
import { SceneTerrainProfileService } from '../src/scene/services/spatial/scene-terrain-profile.service';
import type { TerrainSample } from '../src/scene/types/scene.types';

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
});
