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

export interface BuildingData {
  id: string;
  name: string;
  heightMeters: number;
  footprint: Coordinate[];
  usage: 'COMMERCIAL' | 'TRANSIT' | 'MIXED' | 'PUBLIC';
}

export interface RoadData {
  id: string;
  name: string;
  laneCount: number;
  path: Coordinate[];
  direction: 'ONE_WAY' | 'TWO_WAY';
}

export interface WalkwayData {
  id: string;
  name: string;
  path: Coordinate[];
  widthMeters: number;
}

export interface PoiData {
  id: string;
  name: string;
  type: 'LANDMARK' | 'ENTRANCE' | 'SIGNAL' | 'SHOP';
  location: Coordinate;
}

export interface PlacePackage {
  placeId: string;
  version: string;
  generatedAt: string;
  camera: {
    topView: Vector3;
    walkViewStart: Vector3;
  };
  bounds: {
    northEast: Coordinate;
    southWest: Coordinate;
  };
  buildings: BuildingData[];
  roads: RoadData[];
  walkways: WalkwayData[];
  pois: PoiData[];
  landmarks: PoiData[];
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
    provider: 'MVP_SYNTHETIC_RULES' | 'OPEN_METEO_HISTORICAL';
    date?: string;
    localTime?: string;
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
