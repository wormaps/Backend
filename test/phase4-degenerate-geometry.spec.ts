import { describe, expect, it } from 'bun:test';
import { BuildingFootprintVo } from '../src/places/domain/building-footprint.value-object';

describe('Phase 4 degenerate/invalid polygon fixtures', () => {
  describe('BuildingFootprintVo rejects degenerate footprints', () => {
    it('throws when all points are collinear (zero area)', () => {
      expect(
        () =>
          new BuildingFootprintVo([
            { lat: 37.0, lng: 127.0 },
            { lat: 37.0005, lng: 127.0005 },
            { lat: 37.001, lng: 127.001 },
          ]),
      ).toThrow();
    });

    it('throws when all points are identical', () => {
      expect(
        () =>
          new BuildingFootprintVo([
            { lat: 37.0, lng: 127.0 },
            { lat: 37.0, lng: 127.0 },
            { lat: 37.0, lng: 127.0 },
          ]),
      ).toThrow();
    });

    it('throws when fewer than 3 unique points remain after dedup', () => {
      expect(
        () =>
          new BuildingFootprintVo([
            { lat: 37.0, lng: 127.0 },
            { lat: 37.0, lng: 127.0 },
          ]),
      ).toThrow();
    });

    it('throws when ring contains only non-finite coordinates', () => {
      expect(
        () =>
          new BuildingFootprintVo([
            { lat: NaN, lng: 127.0 },
            { lat: 37.0, lng: Infinity },
            { lat: -Infinity, lng: -Infinity },
          ]),
      ).toThrow();
    });

    it('throws when ring is empty', () => {
      expect(() => new BuildingFootprintVo([])).toThrow();
    });
  });

  describe('BuildingFootprintVo accepts near-degenerate but valid footprints', () => {
    it('accepts a very small but non-zero area rectangle', () => {
      const footprint = new BuildingFootprintVo([
        { lat: 37.0, lng: 127.0 },
        { lat: 37.0, lng: 127.0000001 },
        { lat: 37.0000001, lng: 127.0000001 },
        { lat: 37.0000001, lng: 127.0 },
      ]);

      expect(footprint.outerRing.length).toBe(4);
    });

    it('accepts a triangle with non-zero area', () => {
      const footprint = new BuildingFootprintVo([
        { lat: 37.0, lng: 127.0 },
        { lat: 37.0, lng: 127.001 },
        { lat: 37.001, lng: 127.0 },
      ]);

      expect(footprint.outerRing.length).toBe(3);
    });
  });

  describe('centroid fallback for near-degenerate shapes', () => {
    it('falls back to average centroid when signed area is near zero', () => {
      // Very thin rectangle — small but non-zero area (~1m x 1m)
      // 1e-5 degrees ≈ 1.1m at mid-latitudes
      const footprint = new BuildingFootprintVo([
        { lat: 37.0, lng: 127.0 },
        { lat: 37.0, lng: 127.00001 },
        { lat: 37.00001, lng: 127.00001 },
        { lat: 37.00001, lng: 127.0 },
      ]);

      const centroid = footprint.centroid();
      // Should be near the center of the bounding box
      expect(centroid.lat).toBeGreaterThan(37.0);
      expect(centroid.lat).toBeLessThan(37.00001);
      expect(centroid.lng).toBeGreaterThan(127.0);
      expect(centroid.lng).toBeLessThan(127.00001);
    });
  });

  describe('overlapRatio with degenerate inputs', () => {
    it('returns 0 when both footprints have zero effective overlap', () => {
      const a = new BuildingFootprintVo([
        { lat: 37.0, lng: 127.0 },
        { lat: 37.0, lng: 127.001 },
        { lat: 37.001, lng: 127.001 },
        { lat: 37.001, lng: 127.0 },
      ]);
      const b = new BuildingFootprintVo([
        { lat: 38.0, lng: 128.0 },
        { lat: 38.0, lng: 128.001 },
        { lat: 38.001, lng: 128.001 },
        { lat: 38.001, lng: 128.0 },
      ]);

      expect(a.overlapRatio(b)).toBe(0);
    });
  });
});
