import { Injectable } from '@nestjs/common';
import type {
  ExternalSceneSnapshotResponse,
  ExternalPlaceDetail,
} from '../../types/external-place.types';
import { SceneSnapshot, TimeOfDay, WeatherType } from '../../types/place.types';
import { OpenMeteoClient } from '../../clients/open-meteo.client';
import { GooglePlacesClient } from '../../clients/google-places.client';
import { SnapshotBuilderService } from '../../snapshot/snapshot-builder.service';
import { toRegistryLikePlace } from '../../utils/place-registry.utils';
import { PlaceCatalogService } from '../catalog/place-catalog.service';

@Injectable()
export class PlaceSnapshotService {
  constructor(
    private readonly placeCatalogService: PlaceCatalogService,
    private readonly snapshotBuilderService: SnapshotBuilderService,
    private readonly googlePlacesClient: GooglePlacesClient,
    private readonly openMeteoClient: OpenMeteoClient,
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
    const weatherObservation =
      weather === undefined
        ? await this.openMeteoClient.getObservation(place, date, timeOfDay)
        : null;

    const resolvedWeather =
      weather ?? weatherObservation?.resolvedWeather ?? 'CLEAR';
    const snapshot = this.snapshotBuilderService.build(
      toRegistryLikePlace(place),
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
}
