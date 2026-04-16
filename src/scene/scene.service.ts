import { Injectable } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { TtlCacheService } from '../cache/ttl-cache.service';
import { SceneGenerationService } from './services/generation';
import { SceneLiveDataService } from './services/live';
import { SceneReadService } from './services/read';
import {
  getSceneDataDir,
  getSceneDiagnosticsLogPath,
} from './storage/scene-storage.utils';
import type {
  BootstrapResponse,
  SceneCacheDebugResponse,
  SceneDiagnosticsResponse,
  SceneFailureDebugEntry,
  MidQaReport,
  SceneCreateOptions,
  SceneDetail,
  SceneEntity,
  SceneEntityStateQuery,
  SceneEntityStateResponse,
  SceneMeta,
  ScenePlacesResponse,
  SceneScale,
  SceneStateQuery,
  SceneStateResponse,
  SceneTrafficResponse,
  TwinEvidence,
  SceneTwinGraph,
  ValidationReport,
  SceneWeatherQuery,
  SceneWeatherResponse,
  SceneQueueDebugResponse,
} from './types/scene.types';

@Injectable()
export class SceneService {
  constructor(
    private readonly sceneGenerationService: SceneGenerationService,
    private readonly sceneReadService: SceneReadService,
    private readonly sceneLiveDataService: SceneLiveDataService,
    private readonly ttlCacheService: TtlCacheService,
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

  getSceneTwin(sceneId: string): Promise<SceneTwinGraph> {
    return this.sceneReadService.getSceneTwin(sceneId);
  }

  getValidationReport(sceneId: string): Promise<ValidationReport> {
    return this.sceneReadService.getValidationReport(sceneId);
  }

  getSceneEvidence(sceneId: string): Promise<TwinEvidence[]> {
    return this.sceneReadService.getSceneEvidence(sceneId);
  }

  getMidQaReport(sceneId: string): Promise<MidQaReport> {
    return this.sceneReadService.getMidQaReport(sceneId);
  }

  getState(
    sceneId: string,
    query: SceneStateQuery,
  ): Promise<SceneStateResponse> {
    return this.sceneLiveDataService.getState(sceneId, query);
  }

  getEntityState(
    sceneId: string,
    query: SceneEntityStateQuery,
  ): Promise<SceneEntityStateResponse> {
    return this.sceneLiveDataService.getEntityState(sceneId, query);
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

  getQueueDebugSnapshot(): SceneQueueDebugResponse {
    return this.sceneGenerationService.getQueueDebugSnapshot();
  }

  getCacheDebugSnapshot(): SceneCacheDebugResponse {
    return this.ttlCacheService.getStats();
  }

  getRecentFailures(limit = 10): SceneFailureDebugEntry[] {
    return this.sceneGenerationService.getRecentFailures(limit);
  }

  async getDiagnosticsLog(
    sceneId: string,
    limit = 200,
  ): Promise<SceneDiagnosticsResponse> {
    const diagnosticsLogPath = getSceneDiagnosticsLogPath(sceneId);
    const maxLines = Math.max(1, limit);
    const raw = await this.readFileIfExists(diagnosticsLogPath);
    const lines = raw
      ? raw
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean)
      : [];
    const sliced = lines.slice(-maxLines);

    return {
      sceneId,
      diagnosticsLogPath: join(getSceneDataDir(), `${sceneId}.diagnostics.log`),
      lineCount: lines.length,
      truncated: lines.length > sliced.length,
      lines: sliced,
    };
  }

  private async readFileIfExists(path: string): Promise<string | null> {
    try {
      return await readFile(path, 'utf8');
    } catch {
      return null;
    }
  }
}
