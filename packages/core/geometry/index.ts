import type { GeoCoordinate, LocalPoint } from '../coordinates';

export type GeoPolygon = {
  outer: GeoCoordinate[];
  holes?: GeoCoordinate[][];
};

export type LocalPolygon = {
  outer: LocalPoint[];
  holes?: LocalPoint[][];
};

export type BuildingGeometry = {
  footprint: LocalPolygon;
  terrainSamples?: LocalPoint[];
  baseY?: number;
  height?: number;
};

export type RoadGeometry = {
  centerline: LocalPoint[];
  bufferPolygon?: LocalPolygon;
};

export type PointGeometry = {
  point: LocalPoint;
};

export type RoofShape =
  | 'flat'
  | 'gable'
  | 'hip'
  | 'shed'
  | 'stepped'
  | 'unknown';

export type FacadeMaterial =
  | 'concrete'
  | 'glass'
  | 'brick'
  | 'metal'
  | 'stone'
  | 'tile'
  | 'unknown';

