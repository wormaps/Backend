import { describe, expect, it } from 'bun:test';
import { wgs84ToEnu, enuToWgs84, roundtripErrorMeters } from '../../packages/core/coordinates';

const MAX_ROUNDTRIP_ERROR_M = 0.05;

const TEST_ORIGIN = { lat: 37.4979, lng: 127.0276 };

describe('coordinate roundtrip', () => {
  it('roundtrips within 0.05m at origin', () => {
    const error = roundtripErrorMeters(TEST_ORIGIN, TEST_ORIGIN);
    expect(error).toBeLessThanOrEqual(MAX_ROUNDTRIP_ERROR_M);
  });

  it('roundtrips within 0.05m at nearby points', () => {
    const points = [
      { lat: 37.4985, lng: 127.0280 },
      { lat: 37.4970, lng: 127.0270 },
      { lat: 37.4990, lng: 127.0285 },
      { lat: 37.4965, lng: 127.0265 },
    ];

    for (const point of points) {
      const error = roundtripErrorMeters(point, TEST_ORIGIN);
      expect(error).toBeLessThanOrEqual(MAX_ROUNDTRIP_ERROR_M);
    }
  });

  it('roundtrips within 0.05m at 100m distance', () => {
    const north = { lat: 37.4988, lng: 127.0276 };
    const error = roundtripErrorMeters(north, TEST_ORIGIN);
    expect(error).toBeLessThanOrEqual(MAX_ROUNDTRIP_ERROR_M);
  });

  it('has finite ENU coordinates', () => {
    const points = [
      { lat: 37.4979, lng: 127.0276 },
      { lat: 37.5, lng: 127.03 },
    ];

    for (const point of points) {
      const enu = wgs84ToEnu(point, TEST_ORIGIN);
      expect(Number.isFinite(enu.x)).toBe(true);
      expect(Number.isFinite(enu.y)).toBe(true);
      expect(Number.isFinite(enu.z)).toBe(true);
    }
  });
});
