import { describe, expect, it } from 'bun:test';
import { createBoundsFromCenterRadius } from '../src/places/utils/geo.utils';
import {
  resolveMetersPerDegree,
  toLocalEnu,
  fromLocalEnu,
  distanceMeters,
} from '../src/scene/utils/scene-spatial-frame.utils';

describe('Phase 4.2 High-Latitude Spatial Correctness', () => {
  describe('createBoundsFromCenterRadius', () => {
    it('produces finite bounds at latitude 89°', () => {
      const bounds = createBoundsFromCenterRadius(
        { lat: 89, lng: 0 },
        500,
      );

      expect(Number.isFinite(bounds.northEast.lat)).toBe(true);
      expect(Number.isFinite(bounds.northEast.lng)).toBe(true);
      expect(Number.isFinite(bounds.southWest.lat)).toBe(true);
      expect(Number.isFinite(bounds.southWest.lng)).toBe(true);
    });

    it('produces finite bounds at latitude 89.9°', () => {
      const bounds = createBoundsFromCenterRadius(
        { lat: 89.9, lng: 0 },
        500,
      );

      expect(Number.isFinite(bounds.northEast.lat)).toBe(true);
      expect(Number.isFinite(bounds.northEast.lng)).toBe(true);
      expect(Number.isFinite(bounds.southWest.lat)).toBe(true);
      expect(Number.isFinite(bounds.southWest.lng)).toBe(true);
    });

    it('produces bounds with lng span ≤ 360° at extreme latitude', () => {
      const bounds = createBoundsFromCenterRadius(
        { lat: 89.9, lng: 0 },
        500,
      );

      const lngSpan = bounds.northEast.lng - bounds.southWest.lng;
      expect(lngSpan).toBeLessThanOrEqual(360);
    });

    it('produces bounds with lng span ≤ 360° at latitude 89.999°', () => {
      // At lat 89.999°, cos(lat) ≈ 0.000017, metersPerLng ≈ 1.94m
      // 500m radius → lngDelta ≈ 257° → total span ≈ 514° without clamping
      const bounds = createBoundsFromCenterRadius(
        { lat: 89.999, lng: 0 },
        500,
      );

      const lngSpan = bounds.northEast.lng - bounds.southWest.lng;
      expect(lngSpan).toBeLessThanOrEqual(360);
    });

    it('clamps lng bounds to valid [-180, 180] range at extreme latitude', () => {
      const bounds = createBoundsFromCenterRadius(
        { lat: 89.999, lng: 0 },
        500,
      );

      expect(bounds.northEast.lng).toBeGreaterThanOrEqual(-180);
      expect(bounds.northEast.lng).toBeLessThanOrEqual(180);
      expect(bounds.southWest.lng).toBeGreaterThanOrEqual(-180);
      expect(bounds.southWest.lng).toBeLessThanOrEqual(180);
    });

    it('produces reasonable bounds at latitude 60° (mid-high)', () => {
      const bounds = createBoundsFromCenterRadius(
        { lat: 60, lng: 10 },
        1000,
      );

      const latSpan = bounds.northEast.lat - bounds.southWest.lat;
      const lngSpan = bounds.northEast.lng - bounds.southWest.lng;

      // At lat 60°, 1° lng ≈ 55.6 km, so 1000m ≈ 0.018°
      expect(lngSpan).toBeGreaterThan(0.01);
      expect(lngSpan).toBeLessThan(1);
      // 1° lat ≈ 111 km, so 1000m ≈ 0.009°
      expect(latSpan).toBeGreaterThan(0.005);
      expect(latSpan).toBeLessThan(0.1);
    });
  });

  describe('resolveMetersPerDegree', () => {
    it('returns finite metersPerLng at latitude 89°', () => {
      const result = resolveMetersPerDegree({ lat: 89, lng: 0 });
      expect(Number.isFinite(result.metersPerLat)).toBe(true);
      expect(Number.isFinite(result.metersPerLng)).toBe(true);
      expect(result.metersPerLng).toBeGreaterThan(0);
    });

    it('returns metersPerLng that decreases with latitude', () => {
      const equator = resolveMetersPerDegree({ lat: 0, lng: 0 });
      const lat60 = resolveMetersPerDegree({ lat: 60, lng: 0 });
      const lat89 = resolveMetersPerDegree({ lat: 89, lng: 0 });

      expect(equator.metersPerLng).toBeGreaterThan(lat60.metersPerLng);
      expect(lat60.metersPerLng).toBeGreaterThan(lat89.metersPerLng);
    });

    it('returns metersPerLng ≥ minimum threshold at extreme latitude', () => {
      const result = resolveMetersPerDegree({ lat: 89.9, lng: 0 });
      // At lat 89.9°, cos(lat) ≈ 0.0017, so metersPerLng ≈ 194m
      // Must not approach zero (which would cause division issues)
      expect(result.metersPerLng).toBeGreaterThanOrEqual(100);
    });

    it('returns metersPerLng ≥ minimum threshold at latitude 89.999°', () => {
      const result = resolveMetersPerDegree({ lat: 89.999, lng: 0 });
      // Without fix: metersPerLng ≈ 1.94m → causes massive lngDelta
      // With fix: metersPerLng clamped to reasonable minimum
      expect(result.metersPerLng).toBeGreaterThanOrEqual(100);
    });
  });

  describe('toLocalEnu / fromLocalEnu round-trip', () => {
    it('round-trips accurately at latitude 60°', () => {
      const anchor = { lat: 60, lng: 10 };
      const point = { lat: 60.01, lng: 10.01 };

      const local = toLocalEnu(anchor, point);
      const roundTrip = fromLocalEnu(anchor, local);

      const latError = Math.abs(roundTrip.lat - point.lat);
      const lngError = Math.abs(roundTrip.lng - point.lng);

      expect(latError).toBeLessThan(1e-6);
      expect(lngError).toBeLessThan(1e-6);
    });

    it('round-trips accurately at latitude 89°', () => {
      const anchor = { lat: 89, lng: 0 };
      const point = { lat: 89.001, lng: 0.01 };

      const local = toLocalEnu(anchor, point);
      const roundTrip = fromLocalEnu(anchor, local);

      const latError = Math.abs(roundTrip.lat - point.lat);
      const lngError = Math.abs(roundTrip.lng - point.lng);

      expect(Number.isFinite(local.eastM)).toBe(true);
      expect(Number.isFinite(local.northM)).toBe(true);
      expect(latError).toBeLessThan(1e-6);
      expect(lngError).toBeLessThan(1e-6);
    });

    it('produces finite local coordinates at extreme latitude', () => {
      const anchor = { lat: 89.9, lng: 0 };
      const point = { lat: 89.901, lng: 0.1 };

      const local = toLocalEnu(anchor, point);

      expect(Number.isFinite(local.eastM)).toBe(true);
      expect(Number.isFinite(local.northM)).toBe(true);
      expect(Math.abs(local.eastM)).toBeLessThan(1e6);
      expect(Math.abs(local.northM)).toBeLessThan(1e6);
    });
  });

  describe('distanceMeters', () => {
    it('returns finite distance at high latitude', () => {
      const a = { lat: 89, lng: 0 };
      const b = { lat: 89.01, lng: 0.01 };

      const dist = distanceMeters(a, b);

      expect(Number.isFinite(dist)).toBe(true);
      expect(dist).toBeGreaterThan(0);
      // ~1.1km lat + ~0.55km lng ≈ ~1.2km
      expect(dist).toBeLessThan(5000);
    });

    it('reflects longitude compression at high latitude', () => {
      // Same degree delta at equator vs lat 60°
      const equatorDist = distanceMeters(
        { lat: 0, lng: 0 },
        { lat: 0, lng: 1 },
      );
      const lat60Dist = distanceMeters(
        { lat: 60, lng: 0 },
        { lat: 60, lng: 1 },
      );

      // At lat 60°, 1° lng ≈ half the distance of equator
      expect(lat60Dist).toBeLessThan(equatorDist * 0.6);
      expect(lat60Dist).toBeGreaterThan(equatorDist * 0.4);
    });
  });
});
