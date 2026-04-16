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
        const snapshotDate =
          query.date ?? resolvePlaceLocalDate(storedScene.place);
        const snapshotResponse = this.readFreshSnapshot(
          storedScene,
          snapshotDate,
          query.timeOfDay,
        );
        if (snapshotResponse) {
          return snapshotResponse;
        }

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

  private readFreshSnapshot(
    storedScene: Awaited<ReturnType<SceneReadService['getReadyScene']>>,
    date: string,
    timeOfDay: SceneWeatherQuery['timeOfDay'],
  ): SceneWeatherResponse | null {
    const snapshot = storedScene.latestWeatherSnapshot;
    if (!snapshot) {
      return null;
    }

    const capturedAtMs = Date.parse(snapshot.capturedAt);
    if (!Number.isFinite(capturedAtMs)) {
      return null;
    }

    if (Date.now() - capturedAtMs > this.ttlMs) {
      return null;
    }

    if (snapshot.date !== date) {
      return null;
    }

    const snapshotHour = Number.parseInt(snapshot.localTime.slice(11, 13), 10);
    if (!Number.isFinite(snapshotHour)) {
      return null;
    }

    const snapshotTimeOfDay = resolveTimeOfDayFromHour(snapshotHour);
    if (snapshotTimeOfDay !== timeOfDay) {
      return null;
    }

    return {
      updatedAt: snapshot.capturedAt,
      weatherCode: resolveWeatherCode(snapshot.resolvedWeather),
      temperature: snapshot.temperatureCelsius,
      preset: snapshot.resolvedWeather.toLowerCase(),
      source: snapshot.provider,
      observedAt: snapshot.localTime,
    };
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

function resolveTimeOfDayFromHour(
  hour: number,
): SceneWeatherQuery['timeOfDay'] {
  if (hour >= 5 && hour < 17) {
    return 'DAY';
  }
  if (hour >= 17 && hour < 21) {
    return 'EVENING';
  }
  return 'NIGHT';
}
