import {
  BuildingData,
  Coordinate,
  CrossingData,
  LandCoverData,
  LinearFeatureData,
  PlacePackage,
  PoiData,
  RoadData,
  StreetFurnitureData,
  VegetationData,
  WalkwayData,
} from '../places/place.types';
import { ExternalPlaceDetail } from '../places/external-place.types';
import { TimeOfDay } from '../places/place.types';

export const SCENE_SCALE_VALUES = ['SMALL', 'MEDIUM', 'LARGE'] as const;
export type SceneScale = (typeof SCENE_SCALE_VALUES)[number];
export type SceneStatus = 'PENDING' | 'READY' | 'FAILED';
export type SceneDetailStatus = 'FULL' | 'PARTIAL' | 'OSM_ONLY';
export type MaterialClass = 'glass' | 'concrete' | 'brick' | 'metal' | 'mixed';
export type BuildingPreset =
  | 'glass_tower'
  | 'office_midrise'
  | 'mall_block'
  | 'station_block'
  | 'mixed_midrise'
  | 'small_lowrise';
export type RoofType = 'flat' | 'stepped' | 'gable';

export interface SceneEntity {
  sceneId: string;
  placeId: string | null;
  name: string;
  centerLat: number;
  centerLng: number;
  radiusM: number;
  status: SceneStatus;
  metaUrl: string;
  assetUrl: string | null;
  createdAt: string;
  updatedAt: string;
  failureReason?: string | null;
}

export interface SceneRoadMeta extends Omit<RoadData, 'id'> {
  objectId: string;
  osmWayId: string;
  center: Coordinate;
}

export interface SceneBuildingMeta extends Omit<BuildingData, 'id'> {
  objectId: string;
  osmWayId: string;
  preset: BuildingPreset;
  roofType: RoofType;
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

export interface SceneCrossingDetail extends Omit<CrossingData, 'id'> {
  objectId: string;
  principal: boolean;
  style: 'zebra' | 'signalized' | 'unknown';
}

export interface SceneRoadMarkingDetail {
  objectId: string;
  type: 'LANE_LINE' | 'STOP_LINE' | 'CROSSWALK';
  color: string;
  path: Coordinate[];
}

export interface SceneStreetFurnitureDetail extends Omit<StreetFurnitureData, 'id'> {
  objectId: string;
  principal: boolean;
}

export interface SceneVegetationDetail extends Omit<VegetationData, 'id'> {
  objectId: string;
}

export interface SceneFacadeHint {
  objectId: string;
  anchor: Coordinate;
  facadeEdgeIndex: number | null;
  windowBands: number;
  billboardEligible: boolean;
  palette: string[];
  materialClass: MaterialClass;
  signageDensity: 'low' | 'medium' | 'high';
  emissiveStrength: number;
  glazingRatio: number;
}

export interface SceneSignageCluster {
  objectId: string;
  anchor: Coordinate;
  panelCount: number;
  palette: string[];
  emissiveStrength: number;
  widthMeters: number;
  heightMeters: number;
}

export interface SceneLandmarkAnchor {
  objectId: string;
  name: string;
  location: Coordinate;
  kind: 'BUILDING' | 'CROSSING' | 'PLAZA';
}

export interface SceneMaterialClassSummary {
  className: MaterialClass;
  palette: string[];
  buildingCount: number;
}

export interface SceneVisualCoverage {
  structure: number;
  streetDetail: number;
  landmark: number;
  signage: number;
}

export interface SceneAssetCounts {
  buildingCount: number;
  roadCount: number;
  walkwayCount: number;
  poiCount: number;
  crossingCount: number;
  trafficLightCount: number;
  streetLightCount: number;
  signPoleCount: number;
  treeClusterCount: number;
  billboardPanelCount: number;
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
  diagnostics: {
    droppedBuildings: number;
    droppedRoads: number;
    droppedWalkways: number;
    droppedPois: number;
    droppedCrossings: number;
    droppedStreetFurniture: number;
    droppedVegetation: number;
    droppedLandCovers: number;
    droppedLinearFeatures: number;
  };
  detailStatus: SceneDetailStatus;
  visualCoverage: SceneVisualCoverage;
  materialClasses: SceneMaterialClassSummary[];
  landmarkAnchors: SceneLandmarkAnchor[];
  assetProfile: {
    preset: SceneScale;
    budget: SceneAssetCounts;
    selected: SceneAssetCounts;
  };
  roads: SceneRoadMeta[];
  buildings: SceneBuildingMeta[];
  walkways: SceneWalkwayMeta[];
  pois: ScenePoiMeta[];
}

export interface SceneDetail {
  sceneId: string;
  placeId: string;
  generatedAt: string;
  detailStatus: SceneDetailStatus;
  crossings: SceneCrossingDetail[];
  roadMarkings: SceneRoadMarkingDetail[];
  streetFurniture: SceneStreetFurnitureDetail[];
  vegetation: SceneVegetationDetail[];
  landCovers: LandCoverData[];
  linearFeatures: LinearFeatureData[];
  facadeHints: SceneFacadeHint[];
  signageClusters: SceneSignageCluster[];
  heroOverridesApplied: string[];
  provenance: {
    mapillaryUsed: boolean;
    mapillaryImageCount: number;
    mapillaryFeatureCount: number;
    osmTagCoverage: {
      coloredBuildings: number;
      materialBuildings: number;
      crossings: number;
      streetFurniture: number;
      vegetation: number;
    };
    overrideCount: number;
  };
}

export interface BootstrapResponse {
  sceneId: string;
  assetUrl: string;
  metaUrl: string;
  detailUrl: string;
  detailStatus: SceneDetailStatus;
  assetProfile: SceneMeta['assetProfile'];
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
  detail?: SceneDetail;
  place?: ExternalPlaceDetail;
}

export interface SceneWeatherQuery {
  date: string;
  timeOfDay: TimeOfDay;
}
