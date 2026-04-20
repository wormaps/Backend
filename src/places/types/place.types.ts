export const PLACE_TYPES = ['CROSSING', 'SQUARE', 'STATION', 'PLAZA'] as const;
export type PlaceType = (typeof PLACE_TYPES)[number];

export const TIME_OF_DAY_VALUES = ['DAY', 'EVENING', 'NIGHT'] as const;
export type TimeOfDay = (typeof TIME_OF_DAY_VALUES)[number];

export const WEATHER_VALUES = ['CLEAR', 'CLOUDY', 'RAIN', 'SNOW'] as const;
export type WeatherType = (typeof WEATHER_VALUES)[number];

export interface Coordinate {
  lat: number;
  lng: number;
}

export interface GeoBounds {
  northEast: Coordinate;
  southWest: Coordinate;
}

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface RegistryInfo {
  id: string;
  slug: string;
  name: string;
  country: string;
  city: string;
  location: Coordinate;
  placeType: PlaceType;
  tags: string[];
}

export type EstimationConfidence =
  | 'EXACT'
  | 'LEVELS_BASED'
  | 'CONTEXT_MEDIAN'
  | 'TYPE_DEFAULT';

export interface BuildingData {
  id: string;
  name: string;
  heightMeters: number;
  outerRing: Coordinate[];
  holes: Coordinate[][];
  footprint: Coordinate[];
  usage: 'COMMERCIAL' | 'TRANSIT' | 'MIXED' | 'PUBLIC';
  facadeColor?: string | null;
  facadeMaterial?: string | null;
  roofColor?: string | null;
  roofMaterial?: string | null;
  roofShape?: string | null;
  buildingPart?: string | null;
  estimationConfidence?: EstimationConfidence;
  osmAttributes?: Record<string, string>;
  googlePlacesInfo?: {
    placeId: string;
    primaryType?: string | null;
    types?: string[];
  };
}

export interface RoadData {
  id: string;
  name: string;
  laneCount: number;
  roadClass: string;
  widthMeters: number;
  path: Coordinate[];
  direction: 'ONE_WAY' | 'TWO_WAY';
  surface?: string | null;
  bridge?: boolean;
}

export interface WalkwayData {
  id: string;
  name: string;
  path: Coordinate[];
  widthMeters: number;
  walkwayType: string;
  surface?: string | null;
}

export interface PoiData {
  id: string;
  name: string;
  type: 'LANDMARK' | 'ENTRANCE' | 'SIGNAL' | 'SHOP';
  location: Coordinate;
}

export interface CrossingData {
  id: string;
  name: string;
  type: 'CROSSING';
  crossing: string | null;
  crossingRef: string | null;
  signalized: boolean;
  path: Coordinate[];
  center: Coordinate;
}

export interface StreetFurnitureData {
  id: string;
  name: string;
  type:
    | 'TRAFFIC_LIGHT'
    | 'STREET_LIGHT'
    | 'SIGN_POLE'
    | 'BOLLARD'
    | 'BENCH'
    | 'BIKE_RACK'
    | 'TRASH_CAN'
    | 'FIRE_HYDRANT';
  location: Coordinate;
}

export interface VegetationData {
  id: string;
  name: string;
  type: 'TREE' | 'PLANTER' | 'GREEN_PATCH';
  location: Coordinate;
  radiusMeters: number;
}

export interface LandCoverData {
  id: string;
  type: 'PARK' | 'WATER' | 'PLAZA';
  polygon: Coordinate[];
}

export interface LinearFeatureData {
  id: string;
  type: 'RAILWAY' | 'BRIDGE' | 'WATERWAY';
  path: Coordinate[];
}

export interface PlacePackage {
  placeId: string;
  version: string;
  generatedAt: string;
  camera: {
    topView: Vector3;
    walkViewStart: Vector3;
  };
  bounds: GeoBounds;
  buildings: BuildingData[];
  roads: RoadData[];
  walkways: WalkwayData[];
  pois: PoiData[];
  landmarks: PoiData[];
  crossings: CrossingData[];
  streetFurniture: StreetFurnitureData[];
  vegetation: VegetationData[];
  landCovers: LandCoverData[];
  linearFeatures: LinearFeatureData[];
  diagnostics?: {
    droppedBuildings: number;
    deduplicatedBuildings?: number;
    deduplicatedBuildingsByIoU?: number;
    mergedWayRelationBuildings?: number;
    mergedWayWayBuildings?: number;
    droppedRoads: number;
    droppedWalkways: number;
    droppedPois: number;
    droppedCrossings: number;
    droppedStreetFurniture: number;
    droppedVegetation: number;
    droppedLandCovers: number;
    droppedLinearFeatures: number;
  };
}

export interface GlbSources {
  googlePlaces: boolean;
  overpass: boolean;
  mapillary: boolean;
  weatherBaked: false;
  trafficBaked: false;
}

export interface LightingState {
  ambient: 'BRIGHT' | 'SOFT' | 'DIM';
  neon: boolean;
  buildingLights: boolean;
  vehicleLights: boolean;
}

export interface SurfaceState {
  wetRoad: boolean;
  puddles: boolean;
  snowCover: boolean;
}

export interface DensityMetric {
  level: 'LOW' | 'MEDIUM' | 'HIGH';
  count: number;
}

export interface SceneSnapshot {
  placeId: string;
  timeOfDay: TimeOfDay;
  weather: WeatherType;
  generatedAt: string;
  source: 'SYNTHETIC_RULES';
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
    provider: 'OPEN_METEO' | 'UNKNOWN';
    date?: string | null;
    localTime?: string | null;
  };
}

export interface PlaceDetail {
  registry: RegistryInfo;
  packageSummary: {
    version: string;
    generatedAt: string;
    buildingCount: number;
    roadCount: number;
    walkwayCount: number;
    poiCount: number;
  };
  supportedTimeOfDay: TimeOfDay[];
  supportedWeather: WeatherType[];
}
