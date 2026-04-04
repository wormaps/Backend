import { HttpStatus, Injectable } from '@nestjs/common';
import { ERROR_CODES } from '../common/constants/error-codes';
import { AppException } from '../common/errors/app.exception';
import {
  PLACE_DETAILS_FIXTURES,
  PLACE_PACKAGE_FIXTURES,
  PLACE_REGISTRY_FIXTURES,
} from './place.fixtures';
import {
  ExternalPlaceDetail,
  ExternalPlacePackageResponse,
  ExternalPlaceSearchItem,
  ExternalSceneSnapshotResponse,
} from './external-place.types';
import { GooglePlacesClient } from './google-places.client';
import { OpenMeteoClient } from './open-meteo.client';
import { OverpassClient } from './overpass.client';
import {
  PlaceDetail,
  PlacePackage,
  RegistryInfo,
  SceneSnapshot,
  TimeOfDay,
  WeatherType,
} from './place.types';
import { SnapshotBuilderService } from './snapshot-builder.service';

@Injectable()
export class PlacesService {
  constructor(
    private readonly snapshotBuilderService: SnapshotBuilderService,
    private readonly googlePlacesClient: GooglePlacesClient,
    private readonly overpassClient: OverpassClient,
    private readonly openMeteoClient: OpenMeteoClient,
  ) {}

  getPlaces(): RegistryInfo[] {
    return PLACE_REGISTRY_FIXTURES;
  }

  getPlaceDetail(placeId: string): PlaceDetail {
    const placeDetail = PLACE_DETAILS_FIXTURES.find(
      (place) => place.registry.id === placeId,
    );
    if (!placeDetail) {
      throw this.placeNotFound(placeId);
    }

    return placeDetail;
  }

  getPlacePackage(placeId: string): PlacePackage {
    const placePackage = PLACE_PACKAGE_FIXTURES[placeId];
    if (!placePackage) {
      throw this.placeNotFound(placeId);
    }

    return placePackage;
  }

  getSceneSnapshot(
    placeId: string,
    timeOfDay: TimeOfDay,
    weather: WeatherType,
  ): SceneSnapshot {
    const place = PLACE_REGISTRY_FIXTURES.find((entry) => entry.id === placeId);
    if (!place) {
      throw this.placeNotFound(placeId);
    }

    return this.snapshotBuilderService.build(place, timeOfDay, weather);
  }

  searchExternalPlaces(
    query: string,
    limit: number,
  ): Promise<ExternalPlaceSearchItem[]> {
    return this.googlePlacesClient.searchText(query, limit);
  }

  getExternalPlaceDetail(googlePlaceId: string): Promise<ExternalPlaceDetail> {
    return this.googlePlacesClient.getPlaceDetail(googlePlaceId);
  }

  async getExternalPlacePackage(
    googlePlaceId: string,
  ): Promise<ExternalPlacePackageResponse> {
    const place = await this.googlePlacesClient.getPlaceDetail(googlePlaceId);
    const placePackage = await this.overpassClient.buildPlacePackage(place);

    return {
      place,
      package: placePackage,
    };
  }

  async getExternalSceneSnapshot(
    googlePlaceId: string,
    timeOfDay: TimeOfDay,
    weather: WeatherType | undefined,
    date: string,
  ): Promise<ExternalSceneSnapshotResponse> {
    const place = await this.googlePlacesClient.getPlaceDetail(googlePlaceId);
    const weatherObservation =
      weather === undefined
        ? await this.openMeteoClient.getHistoricalObservation(
            place,
            date,
            timeOfDay,
          )
        : null;

    const resolvedWeather =
      weather ?? weatherObservation?.resolvedWeather ?? 'CLEAR';
    const registryLikePlace: RegistryInfo = {
      id: place.placeId,
      slug: place.placeId,
      name: place.displayName,
      country: 'Unknown',
      city: 'Unknown',
      location: place.location,
      placeType: this.resolvePlaceType(place),
      tags: place.types,
    };
    const snapshot = this.snapshotBuilderService.build(
      registryLikePlace,
      timeOfDay,
      resolvedWeather,
    );
    snapshot.sourceDetail = weatherObservation
      ? {
          provider: weatherObservation.source,
          date: weatherObservation.date,
          localTime: weatherObservation.localTime,
        }
      : {
          provider: 'MVP_SYNTHETIC_RULES',
        };

    return {
      place,
      snapshot,
      weatherObservation,
    };
  }

  private placeNotFound(placeId: string): AppException {
    return new AppException({
      code: ERROR_CODES.PLACE_NOT_FOUND,
      message: '장소를 찾을 수 없습니다.',
      detail: {
        placeId,
      },
      status: HttpStatus.NOT_FOUND,
    });
  }

  private resolvePlaceType(
    place: ExternalPlaceDetail,
  ): RegistryInfo['placeType'] {
    const types = new Set(place.types);

    if (
      types.has('train_station') ||
      types.has('subway_station') ||
      types.has('transit_station')
    ) {
      return 'STATION';
    }

    if (types.has('tourist_attraction') || types.has('plaza')) {
      return 'PLAZA';
    }

    if (types.has('intersection')) {
      return 'CROSSING';
    }

    return 'SQUARE';
  }
}
