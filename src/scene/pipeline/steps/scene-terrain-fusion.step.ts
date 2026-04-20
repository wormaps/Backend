import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { Injectable } from '@nestjs/common';
import type { GeoBounds } from '../../../places/types/place.types';
import { AppLoggerService } from '../../../common/logging/app-logger.service';
import { appendSceneDiagnosticsLog } from '../../storage/scene-storage.utils';
import type { SceneTerrainProfile, TerrainSample } from '../../types/scene.types';
import {
  SceneTerrainProfileService,
  type TerrainProfileResolveInput,
} from '../../services/spatial/scene-terrain-profile.service';
import { IDemPort } from '../../infrastructure/terrain/dem.port';

const GRID_SIZE = 8;

export interface TerrainFusionResult {
  terrainProfile: SceneTerrainProfile;
  terrainFilePath: string | null;
}

export interface TerrainFusionExecuteInput extends TerrainProfileResolveInput {
  sceneId: string;
}

@Injectable()
export class SceneTerrainFusionStep {
  constructor(
    private readonly terrainProfileService: SceneTerrainProfileService,
    private readonly demPort: IDemPort,
    private readonly appLoggerService: AppLoggerService,
  ) {}

  async execute(input: TerrainFusionExecuteInput): Promise<TerrainFusionResult> {
    const { sceneId, bounds, origin, radiusM } = input;
    const existingPath = this.resolveTerrainPath(sceneId);

    if (existingPath && existsSync(existingPath)) {
      this.appLoggerService.info('scene.terrain_fusion.local_file_found', {
        sceneId,
        step: 'terrain_fusion',
        path: existingPath,
      });
      const profile = await this.terrainProfileService.resolve(sceneId, {
        bounds,
        origin,
        radiusM,
      });
      return { terrainProfile: profile, terrainFilePath: existingPath };
    }

    const gridPoints = this.buildGridPoints(bounds);
    this.appLoggerService.info('scene.terrain_fusion.dem_request', {
      sceneId,
      step: 'terrain_fusion',
      pointCount: gridPoints.length,
    });

    const samples = await this.demPort.fetchElevations(gridPoints);

    if (samples.length === 0) {
      this.appLoggerService.warn('scene.terrain_fusion.dem_failed', {
        sceneId,
        step: 'terrain_fusion',
      });
      const flatProfile = await this.buildFlatProfile(sceneId);
      return { terrainProfile: flatProfile, terrainFilePath: null };
    }

    const profile = this.terrainProfileService.buildFromSamples(
      samples,
      'OPEN_ELEVATION',
    );

    const savedPath = await this.persistTerrainFile(sceneId, samples);

    try {
      await appendSceneDiagnosticsLog(sceneId, 'terrain_fusion', {
        terrainProfile: {
          mode: profile.mode,
          source: profile.source,
          hasElevationModel: profile.hasElevationModel,
          heightReference: profile.heightReference,
          sampleCount: profile.sampleCount,
          sourcePath: profile.sourcePath,
        },
        terrainFilePath: savedPath,
      });
    } catch (error) {
      this.appLoggerService.warn('scene.diagnostics.log-failed', {
        sceneId,
        step: 'terrain_fusion',
        error: error instanceof Error ? error.message : String(error),
      });
    }

    this.appLoggerService.info('scene.terrain_fusion.completed', {
      sceneId,
      step: 'terrain_fusion',
      sampleCount: samples.length,
      mode: profile.mode,
      terrainFilePath: savedPath,
    });

    return { terrainProfile: profile, terrainFilePath: savedPath };
  }

  private buildGridPoints(bounds: GeoBounds): GeoBounds['northEast'][] {
    const points: GeoBounds['northEast'][] = [];
    const { northEast, southWest } = bounds;

    for (let iz = 0; iz <= GRID_SIZE; iz += 1) {
      const lat = southWest.lat + ((northEast.lat - southWest.lat) * iz) / GRID_SIZE;
      for (let ix = 0; ix <= GRID_SIZE; ix += 1) {
        const lng = southWest.lng + ((northEast.lng - southWest.lng) * ix) / GRID_SIZE;
        points.push({ lat, lng });
      }
    }

    return points;
  }

  private resolveTerrainPath(sceneId: string): string | null {
    const terrainDir =
      process.env.SCENE_TERRAIN_DIR?.trim() ??
      join(process.cwd(), 'data', 'terrain');
    if (!terrainDir) {
      return null;
    }
    return join(terrainDir, `${sceneId}.terrain.json`);
  }

  private async persistTerrainFile(
    sceneId: string,
    samples: TerrainSample[],
  ): Promise<string | null> {
    const terrainDir =
      process.env.SCENE_TERRAIN_DIR?.trim() ??
      join(process.cwd(), 'data', 'terrain');
    if (!terrainDir) {
      return null;
    }

    const filePath = join(terrainDir, `${sceneId}.terrain.json`);
    const payload = {
      heightReference: 'LOCAL_DEM',
      notes: `Open-Elevation DEM ${samples.length} samples fused for scene ${sceneId}`,
      samples: samples.map((s) => ({
        lat: s.location.lat,
        lng: s.location.lng,
        heightMeters: s.heightMeters,
      })),
    };

    try {
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, JSON.stringify(payload, null, 2), 'utf8');
      return filePath;
    } catch {
      return null;
    }
  }

  private async buildFlatProfile(sceneId: string): Promise<SceneTerrainProfile> {
    this.appLoggerService.warn('scene.terrain_profile.flat_placeholder', {
      sceneId,
      step: 'terrain_fusion',
      source: 'NONE',
      mode: 'FLAT_PLACEHOLDER',
      hasElevationModel: false,
    });

    try {
      await appendSceneDiagnosticsLog(sceneId, 'terrain_fusion', {
        terrainProfile: {
          mode: 'FLAT_PLACEHOLDER',
          source: 'NONE',
          hasElevationModel: false,
          heightReference: 'ELLIPSOID_APPROX',
          sampleCount: 0,
          sourcePath: null,
        },
      });
    } catch (error) {
      this.appLoggerService.warn('scene.diagnostics.log-failed', {
        sceneId,
        step: 'terrain_fusion_flat',
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return {
      mode: 'FLAT_PLACEHOLDER',
      source: 'NONE',
      hasElevationModel: false,
      heightReference: 'ELLIPSOID_APPROX',
      baseHeightMeters: 0,
      sampleCount: 0,
      minHeightMeters: 0,
      maxHeightMeters: 0,
      sourcePath: null,
      notes:
        '현재는 DEM이 없어 flat placeholder 기준입니다. 이후 terrain fusion 단계에서 실제 elevation으로 대체해야 합니다.',
      samples: [],
    };
  }
}
