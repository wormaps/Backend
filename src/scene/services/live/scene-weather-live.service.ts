import { Injectable } from '@nestjs/common';
import { TtlCacheService } from '../../../cache/ttl-cache.service';
import { OpenMeteoClient } from '../../../places/clients/open-meteo.client';
import type {
  SceneWeatherQuery,
  SceneWeatherResponse,
} from '../../types/scene.types';
import { SceneReadService } from '../read/scene-read.service';
import { resolvePlaceLocalDate } from './scene-state-live.service';
import { SceneRepository } from '../../storage/scene.repository';
import type { ExternalPlaceDetail } from '../../../places/types/external-place.types';
import type { WeatherObservation } from '../../../places/types/external-place.types';
import type { FetchJsonEnvelope } from '../../../common/http/fetch-json';

@Injectable()
export class SceneWeatherLiveService {
  private readonly ttlMs = 10 * 60 * 1000;

  constructor(
    private readonly sceneReadService: SceneReadService,
    private readonly sceneRepository: SceneRepository,
    private readonly ttlCacheService: TtlCacheService,
    private readonly openMeteoClient: OpenMeteoClient,
  ) {}

  async getWeather(
    sceneId: string,
    query: SceneWeatherQuery,
  ): Promise<SceneWeatherResponse> {
    return this.ttlCacheService.getOrSet(
      this.buildCacheKey(sceneId, query),
      this.ttlMs,
      async () => {
        const storedScene = await this.sceneReadService.getReadyScene(sceneId);
        const date = query.date ?? resolvePlaceLocalDate(storedScene.place);
        const observationResult = await this.sampleWeatherByPlace(
          storedScene.place,
          date,
          query.timeOfDay,
        );
        const observation = observationResult.observation;

        if (observation) {
          await this.sceneRepository.update(sceneId, (current) => ({
            ...current,
            latestWeatherSnapshot: {
              provider: observation.source,
              date: observation.date,
              localTime: observation.localTime,
              resolvedWeather: observation.resolvedWeather,
              temperatureCelsius: observation.temperatureCelsius,
              precipitationMm: observation.precipitationMm,
              capturedAt: new Date().toISOString(),
              upstreamEnvelopes: observationResult.upstreamEnvelopes,
            },
          }));
        }

        return {
          ...toSceneWeatherResponse(observation),
          updatedAt: new Date().toISOString(),
        };
      },
    );
  }

  async sampleWeatherByPlace(
    place: ExternalPlaceDetail,
    date: string,
    timeOfDay: SceneWeatherQuery['timeOfDay'],
  ): Promise<{
    observation: WeatherObservation | null;
    upstreamEnvelopes: FetchJsonEnvelope[];
  }> {
    const observationResult =
      await this.openMeteoClient.getObservationWithEnvelope(
        place,
        date,
        timeOfDay,
      );
    return {
      observation: observationResult.observation,
      upstreamEnvelopes: observationResult.upstreamEnvelopes,
    };
  }

  private buildCacheKey(sceneId: string, query: SceneWeatherQuery): string {
    return `scene-weather:${sceneId}:${query.date ?? 'AUTO'}:${query.timeOfDay}`;
  }
}

function toSceneWeatherResponse(
  observation: WeatherObservation | null,
): Omit<SceneWeatherResponse, 'updatedAt'> {
  return {
    weatherCode: resolveWeatherCode(observation?.resolvedWeather),
    temperature: observation?.temperatureCelsius ?? null,
    preset: observation?.resolvedWeather.toLowerCase() ?? 'clear',
    source: observation?.source ?? 'OPEN_METEO_HISTORICAL',
    observedAt: observation?.localTime ?? null,
  };
}

function resolveWeatherCode(weather: string | undefined): number | null {
  if (weather === 'CLOUDY') {
    return 3;
  }
  if (weather === 'RAIN') {
    return 61;
  }
  if (weather === 'SNOW') {
    return 71;
  }
  if (weather === 'CLEAR') {
    return 0;
  }
  return null;
}
