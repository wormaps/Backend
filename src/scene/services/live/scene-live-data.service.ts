import { Injectable } from '@nestjs/common';
import type {
  SceneStateQuery,
  SceneStateResponse,
  SceneTrafficResponse,
  SceneWeatherQuery,
  SceneWeatherResponse,
} from '../../types/scene.types';
import { SceneStateLiveService } from './scene-state-live.service';
import { SceneTrafficLiveService } from './scene-traffic-live.service';
import { SceneWeatherLiveService } from './scene-weather-live.service';

@Injectable()
export class SceneLiveDataService {
  constructor(
    private readonly sceneStateLiveService: SceneStateLiveService,
    private readonly sceneWeatherLiveService: SceneWeatherLiveService,
    private readonly sceneTrafficLiveService: SceneTrafficLiveService,
  ) {}

  async getState(
    sceneId: string,
    query: SceneStateQuery,
  ): Promise<SceneStateResponse> {
    return this.sceneStateLiveService.getState(sceneId, query);
  }

  async getWeather(
    sceneId: string,
    query: SceneWeatherQuery,
  ): Promise<SceneWeatherResponse> {
    return this.sceneWeatherLiveService.getWeather(sceneId, query);
  }

  async getTraffic(sceneId: string): Promise<SceneTrafficResponse> {
    return this.sceneTrafficLiveService.getTraffic(sceneId);
  }
}
