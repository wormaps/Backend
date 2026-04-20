import { Injectable } from '@nestjs/common';
import { SceneWeatherLiveService } from '../live/scene-weather-live.service';
import { SceneTrafficLiveService } from '../live/scene-traffic-live.service';
import type { ExternalPlaceDetail } from '../../../places/types/external-place.types';
import type { FetchJsonEnvelope } from '../../../common/http/fetch-json';
import type {
  SceneTrafficResponse,
  SceneWeatherResponse,
  TrafficSegment,
} from '../../types/scene.types';

@Injectable()
export class SceneSnapshotService {
  constructor(
    private readonly sceneWeatherLiveService: SceneWeatherLiveService,
    private readonly sceneTrafficLiveService: SceneTrafficLiveService,
  ) {}

  async buildWeatherSnapshot(
    place: ExternalPlaceDetail,
    generatedAt: string,
    requestId: string | null,
  ): Promise<{
    snapshot: SceneWeatherResponse;
    observation: {
      observation: { temperatureCelsius: number | null; resolvedWeather: string; source?: string; localTime?: string; date?: string } | null;
      upstreamEnvelopes: FetchJsonEnvelope[];
    };
  }> {
    const weatherObserved =
      await this.sceneWeatherLiveService.sampleWeatherByPlace(
        place,
        generatedAt.slice(0, 10),
        'DAY',
        requestId,
      );
    const observation = weatherObserved.observation;
    const snapshot: SceneWeatherResponse = {
      updatedAt: new Date().toISOString(),
      weatherCode: resolveWeatherCode(observation?.resolvedWeather),
      temperature: observation?.temperatureCelsius ?? null,
      preset: observation?.resolvedWeather.toLowerCase() ?? 'clear',
      source: (observation?.source as SceneWeatherResponse['source']) ?? 'OPEN_METEO_HISTORICAL',
      observedAt: observation?.localTime ?? null,
    };
    return { snapshot, observation: weatherObserved };
  }

  async buildTrafficSnapshot(
    roads: Array<{ objectId: string; center: { lat: number; lng: number } }>,
    requestId: string | null,
  ): Promise<{
    snapshot: SceneTrafficResponse;
    observation: {
      segments: TrafficSegment[];
      failedSegmentCount: number;
      provider: 'TOMTOM' | 'UNAVAILABLE';
      upstreamEnvelopes: FetchJsonEnvelope[];
    };
  }> {
    const trafficObserved =
      await this.sceneTrafficLiveService.sampleTrafficByRoads(
        roads,
        requestId,
      );
    const snapshot: SceneTrafficResponse = {
      updatedAt: new Date().toISOString(),
      segments: trafficObserved.segments,
      degraded: trafficObserved.failedSegmentCount > 0,
      failedSegmentCount: trafficObserved.failedSegmentCount,
      provider: trafficObserved.provider,
    };
    return { snapshot, observation: trafficObserved };
  }

  toWeatherType(preset: string): 'CLEAR' | 'CLOUDY' | 'RAIN' | 'SNOW' {
    if (preset === 'cloudy') {
      return 'CLOUDY';
    }
    if (preset === 'rain') {
      return 'RAIN';
    }
    if (preset === 'snow') {
      return 'SNOW';
    }
    return 'CLEAR';
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
