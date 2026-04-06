import { Injectable } from '@nestjs/common';
import {
  ExternalPlacesService,
  PlaceCatalogService,
  PlaceSnapshotService,
} from './services';
import type {
  ExternalPlaceDetail,
  ExternalPlacePackageResponse,
  ExternalPlaceSearchItem,
  ExternalSceneSnapshotResponse,
} from './types/external-place.types';
import type {
  PlaceDetail,
  PlacePackage,
  RegistryInfo,
  SceneSnapshot,
  TimeOfDay,
  WeatherType,
} from './types/place.types';

@Injectable()
export class PlacesService {
  constructor(
    private readonly placeCatalogService: PlaceCatalogService,
    private readonly externalPlacesService: ExternalPlacesService,
    private readonly placeSnapshotService: PlaceSnapshotService,
  ) {}

  getPlaces(): RegistryInfo[] {
    return this.placeCatalogService.getPlaces();
  }

  getPlaceDetail(placeId: string): PlaceDetail {
    return this.placeCatalogService.getPlaceDetail(placeId);
  }

  getPlacePackage(placeId: string): PlacePackage {
    return this.placeCatalogService.getPlacePackage(placeId);
  }

  getSceneSnapshot(
    placeId: string,
    timeOfDay: TimeOfDay,
    weather: WeatherType,
  ): SceneSnapshot {
    return this.placeSnapshotService.getSceneSnapshot(
      placeId,
      timeOfDay,
      weather,
    );
  }

  searchExternalPlaces(
    query: string,
    limit: number,
  ): Promise<ExternalPlaceSearchItem[]> {
    return this.externalPlacesService.searchExternalPlaces(query, limit);
  }

  getExternalPlaceDetail(googlePlaceId: string): Promise<ExternalPlaceDetail> {
    return this.externalPlacesService.getExternalPlaceDetail(googlePlaceId);
  }

  getExternalPlacePackage(
    googlePlaceId: string,
  ): Promise<ExternalPlacePackageResponse> {
    return this.externalPlacesService.getExternalPlacePackage(googlePlaceId);
  }

  getExternalSceneSnapshot(
    googlePlaceId: string,
    timeOfDay: TimeOfDay,
    weather: WeatherType | undefined,
    date: string,
  ): Promise<ExternalSceneSnapshotResponse> {
    return this.placeSnapshotService.getExternalSceneSnapshot(
      googlePlaceId,
      timeOfDay,
      weather,
      date,
    );
  }
}
