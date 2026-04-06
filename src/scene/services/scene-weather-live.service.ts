import { Injectable } from '@nestjs/common';
import { TtlCacheService } from '../../cache/ttl-cache.service';
import { OpenMeteoClient } from '../../places/clients/open-meteo.client';
import type {
  SceneWeatherQuery,
  SceneWeatherResponse,
} from '../types/scene.types';
import { SceneReadService } from './scene-read.service';
import { resolvePlaceLocalDate } from './scene-state-live.service';

@Injectable()
export class SceneWeatherLiveService {
  private readonly ttlMs = 10 * 60 * 1000;

  constructor(
    private readonly sceneReadService: SceneReadService,
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
        const observation = await this.openMeteoClient.getObservation(
          storedScene.place,
          date,
          query.timeOfDay,
        );

        return {
          updatedAt: new Date().toISOString(),
          weatherCode: resolveWeatherCode(observation?.resolvedWeather),
          temperature: observation?.temperatureCelsius ?? null,
          preset: observation?.resolvedWeather.toLowerCase() ?? 'clear',
          source: observation?.source ?? 'OPEN_METEO_HISTORICAL',
          observedAt: observation?.localTime ?? null,
        };
      },
    );
  }

  private buildCacheKey(sceneId: string, query: SceneWeatherQuery): string {
    return `scene-weather:${sceneId}:${query.date ?? 'AUTO'}:${query.timeOfDay}`;
  }
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
