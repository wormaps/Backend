import {
  BuildingData,
  Coordinate,
  PlacePackage,
  PoiData,
  RoadData,
  WalkwayData,
} from '../places/place.types';
import { ExternalPlaceDetail } from '../places/external-place.types';
import { TimeOfDay } from '../places/place.types';

export const SCENE_SCALE_VALUES = ['SMALL', 'MEDIUM', 'LARGE'] as const;
export type SceneScale = (typeof SCENE_SCALE_VALUES)[number];
export type SceneStatus = 'PENDING' | 'READY' | 'FAILED';

export interface SceneEntity {
  sceneId: string;
  placeId: string | null;
  name: string;
  centerLat: number;
  centerLng: number;
  radiusM: number;
  status: SceneStatus;
  metaUrl: string;
  createdAt: string;
  updatedAt: string;
  failureReason?: string | null;
}

export interface SceneRoadMeta {
  objectId: string;
  osmWayId: string;
  name: string;
  laneCount: number;
  direction: RoadData['direction'];
  path: Coordinate[];
  center: Coordinate;
}

export interface SceneBuildingMeta extends Omit<BuildingData, 'id'> {
  objectId: string;
  osmWayId: string;
}

export interface SceneWalkwayMeta extends Omit<WalkwayData, 'id'> {
  objectId: string;
  osmWayId: string;
}

export interface ScenePoiMeta extends Omit<PoiData, 'id' | 'location'> {
  objectId: string;
  placeId?: string;
  location: Coordinate;
  category?: string;
  isLandmark: boolean;
}

export interface SceneMeta {
  sceneId: string;
  placeId: string;
  name: string;
  generatedAt: string;
  origin: Coordinate;
  camera: PlacePackage['camera'];
  bounds: {
    radiusM: number;
    northEast: Coordinate;
    southWest: Coordinate;
  };
  stats: {
    buildingCount: number;
    roadCount: number;
    walkwayCount: number;
    poiCount: number;
  };
  roads: SceneRoadMeta[];
  buildings: SceneBuildingMeta[];
  walkways: SceneWalkwayMeta[];
  pois: ScenePoiMeta[];
}

export interface BootstrapResponse {
  sceneId: string;
  metaUrl: string;
  liveEndpoints: {
    traffic: string;
    weather: string;
    places: string;
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
}

export interface SceneWeatherResponse {
  updatedAt: string;
  weatherCode: number | null;
  temperature: number | null;
  preset: string;
  source: 'OPEN_METEO_HISTORICAL';
  observedAt: string | null;
}

export interface ScenePlacesResponse {
  pois: ScenePoiMeta[];
}

export interface StoredScene {
  requestKey: string;
  query: string;
  scale: SceneScale;
  attempts: number;
  scene: SceneEntity;
  meta?: SceneMeta;
  place?: ExternalPlaceDetail;
}

export interface SceneWeatherQuery {
  date: string;
  timeOfDay: TimeOfDay;
}
