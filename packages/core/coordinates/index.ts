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

