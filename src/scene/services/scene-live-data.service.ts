import { Injectable } from '@nestjs/common';
import { TtlCacheService } from '../../cache/ttl-cache.service';
import { OpenMeteoClient } from '../../places/clients/open-meteo.client';
import { TomTomTrafficClient } from '../../places/clients/tomtom-traffic.client';
import { SceneReadService } from './scene-read.service';
import type {
  SceneTrafficResponse,
  SceneWeatherQuery,
  SceneWeatherResponse,
  TrafficSegment,
} from '../types/scene.types';

@Injectable()
export class SceneLiveDataService {
  private readonly trafficTtlMs = 2 * 60 * 1000;
  private readonly weatherTtlMs = 10 * 60 * 1000;

  constructor(
    private readonly sceneReadService: SceneReadService,
    private readonly ttlCacheService: TtlCacheService,
    private readonly openMeteoClient: OpenMeteoClient,
    private readonly tomTomTrafficClient: TomTomTrafficClient,
  ) {}

  async getWeather(
    sceneId: string,
    query: SceneWeatherQuery,
  ): Promise<SceneWeatherResponse> {
    return this.ttlCacheService.getOrSet(
      this.buildWeatherCacheKey(sceneId, query),
      this.weatherTtlMs,
      async () => {
        const storedScene = await this.sceneReadService.getReadyScene(sceneId);
        const observation = await this.openMeteoClient.getHistoricalObservation(
          storedScene.place,
          query.date,
          query.timeOfDay,
        );

        return {
          updatedAt: new Date().toISOString(),
          weatherCode: this.resolveWeatherCode(observation?.resolvedWeather),
          temperature: observation?.temperatureCelsius ?? null,
          preset: observation?.resolvedWeather.toLowerCase() ?? 'clear',
          source: 'OPEN_METEO_HISTORICAL',
          observedAt: observation?.localTime ?? null,
        };
      },
    );
  }

  async getTraffic(sceneId: string): Promise<SceneTrafficResponse> {
    return this.ttlCacheService.getOrSet(
      this.buildTrafficCacheKey(sceneId),
      this.trafficTtlMs,
      async () => {
        const storedScene = await this.sceneReadService.getReadyScene(sceneId);
        const segments = await Promise.all(
          storedScene.meta.roads.map(async (road) => {
            const segment = await this.tomTomTrafficClient.getFlowSegment(
              road.center,
            );
            return this.mapTrafficSegment(road.objectId, segment?.flowSegmentData);
          }),
        );

        return {
          updatedAt: new Date().toISOString(),
          segments,
        };
      },
    );
  }

  private buildWeatherCacheKey(
    sceneId: string,
    query: SceneWeatherQuery,
  ): string {
    return `scene-weather:${sceneId}:${query.date}:${query.timeOfDay}`;
  }

  private buildTrafficCacheKey(sceneId: string): string {
    return `scene-traffic:${sceneId}`;
  }

  private mapTrafficSegment(
    objectId: string,
    flowSegmentData?: {
      currentSpeed?: number;
      freeFlowSpeed?: number;
      confidence?: number;
      roadClosure?: boolean;
    },
  ): TrafficSegment {
    const currentSpeed = flowSegmentData?.currentSpeed ?? 0;
    const freeFlowSpeed = flowSegmentData?.freeFlowSpeed ?? 0;
    const congestionScore =
      freeFlowSpeed > 0 ? 1 - currentSpeed / freeFlowSpeed : 0;

    return {
      objectId,
      currentSpeed,
      freeFlowSpeed,
      congestionScore: Number(congestionScore.toFixed(2)),
      status: this.resolveTrafficStatus(congestionScore),
      confidence: flowSegmentData?.confidence ?? null,
      roadClosure: flowSegmentData?.roadClosure ?? false,
    };
  }

  private resolveTrafficStatus(
    congestionScore: number,
  ): 'free' | 'moderate' | 'slow' | 'jammed' {
    if (congestionScore >= 0.8) {
      return 'jammed';
    }
    if (congestionScore >= 0.5) {
      return 'slow';
    }
    if (congestionScore >= 0.2) {
      return 'moderate';
    }
    return 'free';
  }

  private resolveWeatherCode(weather: string | undefined): number | null {
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
}
