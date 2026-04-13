import {
  buildSpatialVerificationSamples,
  computeRoundTripErrorMeters,
  fromLocalEnu,
  resolveMetersPerDegree,
  toLocalEnu,
} from './scene-spatial-frame.utils';

describe('scene-spatial-frame.utils', () => {
  const anchor = { lat: 37.5665, lng: 126.978 };
  const point = { lat: 37.567, lng: 126.979 };

  it('converts between geodetic and local ENU consistently', () => {
    const local = toLocalEnu(anchor, point);
    const roundTrip = fromLocalEnu(anchor, local);

    expect(local.eastM).toBeGreaterThan(0);
    expect(local.northM).toBeGreaterThan(0);
    expect(roundTrip.lat).toBeCloseTo(point.lat, 6);
    expect(roundTrip.lng).toBeCloseTo(point.lng, 6);
  });

  it('reports low roundtrip error for ENU transform samples', () => {
    const error = computeRoundTripErrorMeters(anchor, point);
    const verification = buildSpatialVerificationSamples(anchor, [
      { label: 'point', point },
      { label: 'anchor', point: anchor },
    ]);

    expect(error).toBeLessThanOrEqual(0.01);
    expect(verification.sampleCount).toBe(2);
    expect(verification.maxRoundTripErrorM).toBeLessThanOrEqual(0.01);
  });

  it('resolves latitude/longitude meter scales from anchor latitude', () => {
    const scale = resolveMetersPerDegree(anchor);

    expect(scale.metersPerLat).toBe(111320);
    expect(scale.metersPerLng).toBeGreaterThan(88000);
    expect(scale.metersPerLng).toBeLessThan(111320);
  });
});
