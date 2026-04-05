import { Injectable } from '@nestjs/common';
import { SceneGenerationService } from './services/scene-generation.service';
import { SceneLiveDataService } from './services/scene-live-data.service';
import { SceneReadService } from './services/scene-read.service';
import type {
  BootstrapResponse,
  SceneCreateOptions,
  SceneDetail,
  SceneEntity,
  SceneMeta,
  ScenePlacesResponse,
  SceneScale,
  SceneStateQuery,
  SceneStateResponse,
  SceneTrafficResponse,
  SceneWeatherQuery,
  SceneWeatherResponse,
} from './types/scene.types';

@Injectable()
export class SceneService {
  constructor(
    private readonly sceneGenerationService: SceneGenerationService,
    private readonly sceneReadService: SceneReadService,
    private readonly sceneLiveDataService: SceneLiveDataService,
  ) {}

  createScene(
    query: string,
    scale: SceneScale,
    options?: SceneCreateOptions,
  ): Promise<SceneEntity> {
    return this.sceneGenerationService.createScene(query, scale, options);
  }

  getScene(sceneId: string): Promise<SceneEntity> {
    return this.sceneReadService.getScene(sceneId);
  }

  getSceneMeta(sceneId: string): Promise<SceneMeta> {
    return this.sceneReadService.getSceneMeta(sceneId);
  }

  getSceneDetail(sceneId: string): Promise<SceneDetail> {
    return this.sceneReadService.getSceneDetail(sceneId);
  }

  getBootstrap(sceneId: string): Promise<BootstrapResponse> {
    return this.sceneReadService.getBootstrap(sceneId);
  }

  getPlaces(sceneId: string): Promise<ScenePlacesResponse> {
    return this.sceneReadService.getPlaces(sceneId);
  }

  getState(
    sceneId: string,
    query: SceneStateQuery,
  ): Promise<SceneStateResponse> {
    return this.sceneLiveDataService.getState(sceneId, query);
  }

  getWeather(
    sceneId: string,
    query: SceneWeatherQuery,
  ): Promise<SceneWeatherResponse> {
    return this.sceneLiveDataService.getWeather(sceneId, query);
  }

  getTraffic(sceneId: string): Promise<SceneTrafficResponse> {
    return this.sceneLiveDataService.getTraffic(sceneId);
  }

  waitForIdle(): Promise<void> {
    return this.sceneGenerationService.waitForIdle();
  }
}
