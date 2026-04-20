import { Injectable } from '@nestjs/common';
import type { ExternalSceneSnapshotResponse } from '../../types/external-place.types';
import { SceneSnapshot, TimeOfDay, WeatherType } from '../../types/place.types';
import { OpenMeteoClient } from '../../clients/open-meteo.client';
import { GooglePlacesClient } from '../../clients/google-places.client';
import { SnapshotBuilderService } from '../../snapshot/snapshot-builder.service';
import { toRegistryLikePlace } from '../../utils/place-registry.utils';
import { PlaceCatalogService } from '../catalog/place-catalog.service';
import { AppLoggerService } from '../../../common/logging/app-logger.service';

@Injectable()
export class PlaceSnapshotService {
  constructor(
    private readonly placeCatalogService: PlaceCatalogService,
    private readonly snapshotBuilderService: SnapshotBuilderService,
    private readonly googlePlacesClient: GooglePlacesClient,
    private readonly openMeteoClient: OpenMeteoClient,
    private readonly appLoggerService: AppLoggerService,
  ) {}

  getSceneSnapshot(
    placeId: string,
    timeOfDay: TimeOfDay,
    weather: WeatherType,
  ): SceneSnapshot {
    const place = this.placeCatalogService.getPlaceRegistry(placeId);

    return this.snapshotBuilderService.build(place, timeOfDay, weather);
  }

  async getExternalSceneSnapshot(
    googlePlaceId: string,
    timeOfDay: TimeOfDay,
    weather: WeatherType | undefined,
    date: string,
  ): Promise<ExternalSceneSnapshotResponse> {
    const place = await this.googlePlacesClient.getPlaceDetail(googlePlaceId);
    let weatherObservation: ExternalSceneSnapshotResponse['weatherObservation'] =
      null;
    if (weather === undefined) {
      try {
        weatherObservation = await this.openMeteoClient.getObservation(
          place,
          date,
          timeOfDay,
        );
      } catch (error) {
        this.appLoggerService.warn('place-snapshot.weather.fetch-failed', {
          placeId: place.placeId,
          error: error instanceof Error ? error.message : String(error),
        });
        weatherObservation = null;
      }
    }

    const resolvedWeather =
      weather ?? weatherObservation?.resolvedWeather ?? 'CLEAR';
    const snapshot = this.snapshotBuilderService.build(
      toRegistryLikePlace(place),
      timeOfDay,
      resolvedWeather,
    );
    snapshot.sourceDetail = weatherObservation
      ? {
          provider: 'OPEN_METEO',
          date: weatherObservation.date,
          localTime: weatherObservation.localTime,
        }
      : {
          provider: 'UNKNOWN',
        };

    return {
      place,
      snapshot,
      weatherObservation,
    };
  }
}
