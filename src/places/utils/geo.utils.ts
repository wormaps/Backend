import { Coordinate, GeoBounds } from '../types/place.types';

export interface LatLngLike {
  lat?: number | null;
  lng?: number | null;
  latitude?: number | null;
  longitude?: number | null;
}

export function normalizeCoordinate(input: LatLngLike): Coordinate | null {
  const lat = input.lat ?? input.latitude;
  const lng = input.lng ?? input.longitude;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  const normalizedLat = Number(lat);
  const normalizedLng = Number(lng);

  if (
    normalizedLat < -90 ||
    normalizedLat > 90 ||
    normalizedLng < -180 ||
    normalizedLng > 180
  ) {
    return null;
  }

  return {
    lat: normalizedLat,
    lng: normalizedLng,
  };
}

export function isFiniteCoordinate(
  point: Coordinate | null | undefined,
): boolean {
  return Boolean(
    point && Number.isFinite(point.lat) && Number.isFinite(point.lng),
  );
}

export function createBoundsFromCenterRadius(
  center: Coordinate,
  radiusM: number,
): GeoBounds {
  const metersPerLat = 111_320;
  const metersPerLng = 111_320 * Math.cos((center.lat * Math.PI) / 180);
  const latDelta = radiusM / metersPerLat;
  const lngDelta = radiusM / metersPerLng;

  return {
    northEast: {
      lat: center.lat + latDelta,
      lng: center.lng + lngDelta,
    },
    southWest: {
      lat: center.lat - latDelta,
      lng: center.lng - lngDelta,
    },
  };
}

export function coordinatesEqual(a: Coordinate, b: Coordinate): boolean {
  return a.lat === b.lat && a.lng === b.lng;
}

export function polygonSignedArea(points: Coordinate[]): number {
  if (points.length < 3) {
    return 0;
  }

  let area = 0;
  for (let i = 0; i < points.length; i += 1) {
    const current = points[i]!;
    const next = points[(i + 1) % points.length]!;
    area += current.lng * next.lat - next.lng * current.lat;
  }

  return area / 2;
}

export function midpoint(path: Coordinate[]): Coordinate | null {
  if (path.length === 0) {
    return null;
  }

  const midIndex = Math.floor(path.length / 2);
  const midPoint = path[midIndex];
  if (midPoint) {
    return midPoint;
  }
  const firstPoint = path[0];
  return firstPoint ?? null;
}
