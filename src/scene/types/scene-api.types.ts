import {
  DensityMetric,
  GlbSources,
  LightingState,
  SurfaceState,
  TimeOfDay,
  WeatherType,
} from '../../places/types/place.types';
import { ExternalPlaceDetail } from '../../places/types/external-place.types';
import {
  SceneDetail,
  SceneEntity,
  SceneMeta,
  ScenePoiMeta,
} from './scene-model.types';
import {
  SceneFidelityPlan,
  SceneScale,
  SceneStructuralCoverage,
} from './scene-domain.types';

export interface BootstrapResponse {
  sceneId: string;
  assetUrl: string;
  metaUrl: string;
  detailUrl: string;
  detailStatus: SceneDetail['detailStatus'];
  glbSources: GlbSources;
  assetProfile: SceneMeta['assetProfile'];
  structuralCoverage: SceneStructuralCoverage;
  fidelityPlan?: SceneFidelityPlan;
  liveEndpoints: {
    state: string;
    traffic: string;
    weather: string;
    places: string;
  };
  renderContract: {
    glbCoverage: {
      buildings: boolean;
      roads: boolean;
      walkways: boolean;
      crosswalks: boolean;
      streetFurniture: boolean;
      vegetation: boolean;
      pois: boolean;
      landCovers: boolean;
      linearFeatures: boolean;
    };
    overlaySources: {
      pois: string;
      crossings: string;
      streetFurniture: string;
      vegetation: string;
      landCovers: string;
      linearFeatures: string;
    };
    liveDataModes: {
      traffic: 'LIVE_BEST_EFFORT';
      weather: 'CURRENT_OR_HISTORICAL';
      state: 'SYNTHETIC_RULES';
    };
  };
}

export interface SceneStateResponse {
  placeId: string;
  updatedAt: string;
  timeOfDay: TimeOfDay;
  weather: WeatherType;
  source: 'MVP_SYNTHETIC_RULES';
  crowd: DensityMetric;
  vehicles: DensityMetric;
  lighting: LightingState;
  surface: SurfaceState;
  playback: {
    recommendedSpeed: 1 | 2 | 4 | 8;
    pedestrianAnimationRate: number;
    vehicleAnimationRate: number;
  };
  sourceDetail?: {
    provider:
      | 'MVP_SYNTHETIC_RULES'
      | 'OPEN_METEO_CURRENT'
      | 'OPEN_METEO_HISTORICAL';
    date?: string;
    localTime?: string;
  };
}

export interface TrafficSegment {
  objectId: string;
  currentSpeed: number;
  freeFlowSpeed: number;
  congestionScore: number;
  status: 'free' | 'moderate' | 'slow' | 'jammed';
  confidence: number | null;
  roadClosure: boolean;
}

export interface SceneTrafficResponse {
  updatedAt: string;
  segments: TrafficSegment[];
  degraded: boolean;
  failedSegmentCount: number;
}

export interface SceneWeatherResponse {
  updatedAt: string;
  weatherCode: number | null;
  temperature: number | null;
  preset: string;
  source: 'OPEN_METEO_CURRENT' | 'OPEN_METEO_HISTORICAL';
  observedAt: string | null;
}

export interface ScenePlaceCategorySummary {
  category: string;
  count: number;
  landmarkCount: number;
}

export interface ScenePlacesResponse {
  pois: ScenePoiMeta[];
  landmarks: ScenePoiMeta[];
  categories: ScenePlaceCategorySummary[];
}

export interface StoredScene {
  requestKey: string;
  query: string;
  scale: SceneScale;
  attempts: number;
  generationSource?: 'api' | 'smoke';
  requestId?: string | null;
  scene: SceneEntity;
  meta?: SceneMeta;
  detail?: SceneDetail;
  place?: ExternalPlaceDetail;
}

export interface SceneCreateOptions {
  forceRegenerate?: boolean;
  requestId?: string | null;
  source?: 'api' | 'smoke';
}

export interface SceneWeatherQuery {
  date?: string;
  timeOfDay: TimeOfDay;
}

export interface SceneStateQuery {
  date?: string;
  timeOfDay: TimeOfDay;
  weather?: WeatherType;
}
