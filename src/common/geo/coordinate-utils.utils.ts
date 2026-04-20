import type { Coordinate } from '../../places/types/place.types';

export function averageCoordinate(ring: Coordinate[]): Coordinate | null {
  if (ring.length === 0) return null;
  const sum = ring.reduce(
    (acc, point) => ({
      lat: acc.lat + point.lat,
      lng: acc.lng + point.lng,
    }),
    { lat: 0, lng: 0 },
  );
  return {
    lat: sum.lat / ring.length,
    lng: sum.lng / ring.length,
  };
}
