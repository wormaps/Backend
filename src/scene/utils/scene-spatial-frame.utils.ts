import { Coordinate } from '../../places/types/place.types';

export interface LocalEnuPoint {
  eastM: number;
  northM: number;
}

export interface SpatialVerificationSample {
  label: string;
  local: LocalEnuPoint;
  roundTripErrorM: number;
}

export function resolveMetersPerDegree(anchor: Coordinate): {
  metersPerLat: number;
  metersPerLng: number;
} {
  const rawMetersPerLng = 111_320 * Math.cos((anchor.lat * Math.PI) / 180);
  return {
    metersPerLat: 111_320,
    metersPerLng: Math.max(rawMetersPerLng, 100),
  };
}

export function toLocalEnu(
  anchor: Coordinate,
  point: Coordinate,
): LocalEnuPoint {
  const { metersPerLat, metersPerLng } = resolveMetersPerDegree(anchor);
  return {
    eastM: roundMetric((point.lng - anchor.lng) * metersPerLng),
    northM: roundMetric((point.lat - anchor.lat) * metersPerLat),
  };
}

export function fromLocalEnu(
  anchor: Coordinate,
  local: LocalEnuPoint,
): Coordinate {
  const { metersPerLat, metersPerLng } = resolveMetersPerDegree(anchor);
  return {
    lat: anchor.lat + local.northM / metersPerLat,
    lng: anchor.lng + local.eastM / metersPerLng,
  };
}

export function computeRoundTripErrorMeters(
  anchor: Coordinate,
  point: Coordinate,
): number {
  const roundTrip = fromLocalEnu(anchor, toLocalEnu(anchor, point));
  return roundMetric(distanceMeters(point, roundTrip));
}

export function buildSpatialVerificationSamples(
  anchor: Coordinate,
  points: Array<{ label: string; point: Coordinate }>,
): {
  sampleCount: number;
  maxRoundTripErrorM: number;
  avgRoundTripErrorM: number;
  samples: SpatialVerificationSample[];
} {
  const samples = points.map(({ label, point }) => ({
    label,
    local: toLocalEnu(anchor, point),
    roundTripErrorM: computeRoundTripErrorMeters(anchor, point),
  }));

  const total = samples.reduce((sum, sample) => sum + sample.roundTripErrorM, 0);
  const max = samples.reduce(
    (current, sample) => Math.max(current, sample.roundTripErrorM),
    0,
  );

  return {
    sampleCount: samples.length,
    maxRoundTripErrorM: roundMetric(max),
    avgRoundTripErrorM:
      samples.length > 0 ? roundMetric(total / samples.length) : 0,
    samples,
  };
}

export function distanceMeters(a: Coordinate, b: Coordinate): number {
  const { metersPerLat, metersPerLng } = resolveMetersPerDegree({
    lat: (a.lat + b.lat) / 2,
    lng: (a.lng + b.lng) / 2,
  });
  const deltaLat = (a.lat - b.lat) * metersPerLat;
  const deltaLng = (a.lng - b.lng) * metersPerLng;
  return Math.sqrt(deltaLat ** 2 + deltaLng ** 2);
}

function roundMetric(value: number): number {
  return Math.round(value * 1000) / 1000;
}
