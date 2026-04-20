import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Injectable } from '@nestjs/common';
import type { SceneMeta, SceneTerrainProfile, TerrainSample } from '../../types/scene.types';
import { AppLoggerService } from '../../../common/logging/app-logger.service';
import { appendSceneDiagnosticsLog } from '../../storage/scene-storage.utils';

const MIN_SAMPLES_FOR_DEM = 3;

interface TerrainProfileFile {
  heightReference?: 'ELLIPSOID_APPROX' | 'LOCAL_DEM';
  notes?: string;
  samples?: Array<{
    lat?: number;
    lng?: number;
    heightMeters?: number;
  }>;
}

@Injectable()
export class SceneTerrainProfileService {
  constructor(private readonly appLoggerService: AppLoggerService) {}

  resolve(sceneId: string, meta: SceneMeta): SceneTerrainProfile {
    const terrainPath = this.resolveTerrainPath(sceneId);
    if (!terrainPath || !existsSync(terrainPath)) {
      const flatProfile = this.buildFlatProfile();
      this.logFlatProfile(sceneId, flatProfile);
      return flatProfile;
    }

    const parsed = this.readTerrainFile(terrainPath);
    const rawSamples = (parsed.samples ?? [])
      .filter(
        (sample) =>
          Number.isFinite(sample.lat) &&
          Number.isFinite(sample.lng) &&
          Number.isFinite(sample.heightMeters),
      )
      .map((sample) => ({
        location: {
          lat: Number(sample.lat),
          lng: Number(sample.lng),
        },
        heightMeters: clampElevation(roundMetric(Number(sample.heightMeters))),
        source: 'MANUAL' as const,
      }))
      .filter(
        (sample) =>
          sample.location.lat >= meta.bounds.southWest.lat - 0.01 &&
          sample.location.lat <= meta.bounds.northEast.lat + 0.01 &&
          sample.location.lng >= meta.bounds.southWest.lng - 0.01 &&
          sample.location.lng <= meta.bounds.northEast.lng + 0.01,
      );

    if (rawSamples.length < MIN_SAMPLES_FOR_DEM) {
      const flatProfile = this.buildFlatProfile();
      const fileProfile: SceneTerrainProfile = {
        ...flatProfile,
        source: 'LOCAL_FILE',
        sourcePath: terrainPath,
        notes:
          rawSamples.length === 0
            ? '로컬 terrain profile 파일은 발견했지만 유효한 elevation sample이 없습니다.'
            : `로컬 terrain sample이 ${rawSamples.length}개로 최소 기준(${MIN_SAMPLES_FOR_DEM}개) 미달입니다.`,
      };
      this.logFlatProfile(sceneId, fileProfile);
      return fileProfile;
    }

    return this.buildDemProfile(rawSamples, 'LOCAL_FILE', terrainPath, parsed);
  }

  buildFromSamples(
    samples: TerrainSample[],
    source: SceneTerrainProfile['source'],
    heightReference: 'ELLIPSOID_APPROX' | 'LOCAL_DEM' = 'LOCAL_DEM',
  ): SceneTerrainProfile {
    const clamped = samples.map((s) => ({
      ...s,
      heightMeters: clampElevation(s.heightMeters),
    }));

    if (clamped.length < MIN_SAMPLES_FOR_DEM) {
      return this.buildFlatProfile();
    }

    return this.buildDemProfile(clamped, source, null, { heightReference });
  }

  private buildDemProfile(
    samples: TerrainSample[],
    source: SceneTerrainProfile['source'],
    sourcePath: string | null,
    fileMeta: Pick<TerrainProfileFile, 'heightReference' | 'notes'>,
  ): SceneTerrainProfile {
    const heights = samples.map((s) => s.heightMeters);
    const minHeight = Math.min(...heights);
    const maxHeight = Math.max(...heights);
    const baseHeight = roundMetric(minHeight);

    const interpolateElevation = (lat: number, lng: number): number =>
      interpolateIdw(samples, lat, lng, baseHeight);

    return {
      mode: 'DEM_FUSED',
      source,
      hasElevationModel: true,
      heightReference: fileMeta.heightReference ?? 'LOCAL_DEM',
      baseHeightMeters: baseHeight,
      sampleCount: samples.length,
      minHeightMeters: roundMetric(minHeight),
      maxHeightMeters: roundMetric(maxHeight),
      sourcePath,
      notes:
        fileMeta.notes ??
        `DEM sample ${samples.length}개를 spatial frame에 연결했습니다.`,
      samples,
      interpolateElevation,
    };
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

  private readTerrainFile(path: string): TerrainProfileFile {
    try {
      return JSON.parse(readFileSync(path, 'utf8')) as TerrainProfileFile;
    } catch {
      return {};
    }
  }

  private buildFlatProfile(): SceneTerrainProfile {
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

  private logFlatProfile(
    sceneId: string,
    profile: SceneTerrainProfile,
  ): void {
    this.appLoggerService.warn('scene.terrain_profile.flat_placeholder', {
      sceneId,
      step: 'terrain_profile',
      source: profile.source,
      mode: profile.mode,
      hasElevationModel: profile.hasElevationModel,
    });

    void appendSceneDiagnosticsLog(sceneId, 'terrain_profile', {
      terrainProfile: {
        mode: profile.mode,
        source: profile.source,
        hasElevationModel: profile.hasElevationModel,
        heightReference: profile.heightReference,
        sampleCount: profile.sampleCount,
        sourcePath: profile.sourcePath,
      },
    });
  }
}

function roundMetric(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function clampElevation(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(-500, Math.min(9000, value));
}

function interpolateIdw(
  samples: TerrainSample[],
  lat: number,
  lng: number,
  fallback: number,
): number {
  if (samples.length === 0) return fallback;

  const k = 2;
  let totalWeight = 0;
  let weightedSum = 0;

  for (const sample of samples) {
    const dLat = sample.location.lat - lat;
    const dLng = sample.location.lng - lng;
    const distance = Math.sqrt(dLat * dLat + dLng * dLng);

    if (distance < 1e-9) {
      return sample.heightMeters;
    }

    const weight = 1 / Math.pow(distance, k);
    weightedSum += sample.heightMeters * weight;
    totalWeight += weight;
  }

  if (totalWeight <= 0) return fallback;
  return roundMetric(weightedSum / totalWeight);
}
