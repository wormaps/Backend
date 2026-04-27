export type LatLng = { lat: number; lng: number };
export type ENUVector = { x: number; y: number; z: number };

export type GeoCoordinate = {
  lat: number;
  lng: number;
};

export type LocalPoint = {
  x: number;
  y: number;
  z: number;
};

export type CoordinateFrame = {
  origin: GeoCoordinate;
  axes: 'ENU';
  unit: 'meter';
  elevationDatum: 'LOCAL_DEM' | 'ELLIPSOID' | 'UNKNOWN';
};

const EARTH_RADIUS_M = 6_371_000;

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

function toDegrees(rad: number): number {
  return (rad * 180) / Math.PI;
}

function wgs84ToEcef(lat: number, lng: number): { x: number; y: number; z: number } {
  const φ = toRadians(lat);
  const λ = toRadians(lng);
  const cosφ = Math.cos(φ);
  return {
    x: EARTH_RADIUS_M * cosφ * Math.cos(λ),
    y: EARTH_RADIUS_M * cosφ * Math.sin(λ),
    z: EARTH_RADIUS_M * Math.sin(φ),
  };
}

function ecefToWgs84(ecef: { x: number; y: number; z: number }): LatLng {
  const { x, y, z } = ecef;
  const r = Math.sqrt(x * x + y * y + z * z);
  return {
    lat: toDegrees(Math.asin(z / r)),
    lng: toDegrees(Math.atan2(y, x)),
  };
}

export function wgs84ToEnu(
  point: LatLng,
  origin: LatLng,
  alt: number = 0,
): ENUVector {
  const φ0 = toRadians(origin.lat);
  const λ0 = toRadians(origin.lng);

  const p = wgs84ToEcef(point.lat, point.lng);
  const o = wgs84ToEcef(origin.lat, origin.lng);

  const dx = p.x - o.x;
  const dy = p.y - o.y;
  const dz = p.z - o.z;

  const sinφ0 = Math.sin(φ0);
  const cosφ0 = Math.cos(φ0);
  const sinλ0 = Math.sin(λ0);
  const cosλ0 = Math.cos(λ0);

  const x = -sinλ0 * dx + cosλ0 * dy;
  const y = -sinφ0 * cosλ0 * dx - sinφ0 * sinλ0 * dy + cosφ0 * dz;
  const z = alt;

  return { x, y, z };
}

export function enuToWgs84(
  enu: ENUVector,
  origin: LatLng,
): LatLng {
  const φ0 = toRadians(origin.lat);
  const λ0 = toRadians(origin.lng);

  const o = wgs84ToEcef(origin.lat, origin.lng);

  const sinφ0 = Math.sin(φ0);
  const cosφ0 = Math.cos(φ0);
  const sinλ0 = Math.sin(λ0);
  const cosλ0 = Math.cos(λ0);

  const dx = -sinλ0 * enu.x - sinφ0 * cosλ0 * enu.y;
  const dy = cosλ0 * enu.x - sinφ0 * sinλ0 * enu.y;
  const dz = cosφ0 * enu.y;

  return ecefToWgs84({
    x: o.x + dx,
    y: o.y + dy,
    z: o.z + dz,
  });
}

export function roundtripErrorMeters(point: LatLng, origin: LatLng): number {
  const enu = wgs84ToEnu(point, origin);
  const restored = enuToWgs84(enu, origin);

  const dlat = Math.abs(restored.lat - point.lat) * 111_320;
  const dlng = Math.abs(restored.lng - point.lng) * 111_320 * Math.cos(toRadians((point.lat + restored.lat) / 2));
  return Math.sqrt(dlat * dlat + dlng * dlng);
}
