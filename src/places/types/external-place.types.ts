import { Coordinate, PlacePackage, SceneSnapshot } from './place.types';

export interface ExternalPlaceSearchItem {
  provider: 'GOOGLE_PLACES';
  placeId: string;
  displayName: string;
  formattedAddress: string | null;
  location: Coordinate;
  primaryType: string | null;
  types: string[];
  googleMapsUri: string | null;
}

export interface ExternalPlaceDetail extends ExternalPlaceSearchItem {
  viewport: {
    northEast: Coordinate;
    southWest: Coordinate;
  } | null;
  utcOffsetMinutes: number | null;
}

export interface ExternalPlacePackageResponse {
  place: ExternalPlaceDetail;
  package: PlacePackage;
}

export interface WeatherObservation {
  date: string;
  localTime: string;
  temperatureCelsius: number | null;
  precipitationMm: number | null;
  rainMm: number | null;
  snowfallCm: number | null;
  cloudCoverPercent: number | null;
  resolvedWeather: 'CLEAR' | 'CLOUDY' | 'RAIN' | 'SNOW';
  source: 'OPEN_METEO_CURRENT' | 'OPEN_METEO_HISTORICAL';
}

export interface ExternalSceneSnapshotResponse {
  place: ExternalPlaceDetail;
  snapshot: SceneSnapshot;
  weatherObservation: WeatherObservation | null;
}
