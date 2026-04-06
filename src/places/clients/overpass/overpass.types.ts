import type { GeoBounds } from '../../types/place.types';

export interface OverpassResponse {
  elements?: OverpassElement[];
}

export interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  geometry?: Array<{ lat: number; lon: number }>;
  members?: Array<{
    type: 'way' | 'node';
    ref: number;
    role?: string;
    geometry?: Array<{ lat: number; lon: number }>;
  }>;
  tags?: Record<string, string>;
}

export interface BuildPlacePackageOptions {
  bounds?: GeoBounds;
  radiusM?: number;
  sceneId?: string;
  requestId?: string | null;
}

export type OverpassScope = 'core' | 'street' | 'environment';

export interface OverpassBatchContext {
  requestId?: string | null;
  sceneId?: string;
  batch: number;
}

export interface OverpassRequestContext extends OverpassBatchContext {
  scope?: string;
  boundScale?: number;
}
