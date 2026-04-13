import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Injectable } from '@nestjs/common';
import type { SceneMeta, TerrainSnapshotPayload } from '../../types/scene.types';

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
  resolve(sceneId: string, meta: SceneMeta): TerrainSnapshotPayload {
    const terrainPath = this.resolveTerrainPath(sceneId);
    if (!terrainPath || !existsSync(terrainPath)) {
      return this.buildFlatProfile();
    }

    const parsed = this.readTerrainFile(terrainPath);
    const samples = (parsed.samples ?? [])
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
        heightMeters: roundMetric(Number(sample.heightMeters)),
      }))
      .filter(
        (sample) =>
          sample.location.lat >= meta.bounds.southWest.lat - 0.01 &&
          sample.location.lat <= meta.bounds.northEast.lat + 0.01 &&
          sample.location.lng >= meta.bounds.southWest.lng - 0.01 &&
          sample.location.lng <= meta.bounds.northEast.lng + 0.01,
      );

    if (samples.length === 0) {
      return {
        ...this.buildFlatProfile(),
        source: 'LOCAL_FILE',
        sourcePath: terrainPath,
        notes:
          '로컬 terrain profile 파일은 발견했지만 유효한 elevation sample이 없습니다.',
      };
    }

    const heights = samples.map((sample) => sample.heightMeters);
    return {
      mode: 'LOCAL_DEM_SAMPLES',
      source: 'LOCAL_FILE',
      hasElevationModel: true,
      heightReference: parsed.heightReference ?? 'LOCAL_DEM',
      baseHeightMeters: roundMetric(Math.min(...heights)),
      sampleCount: samples.length,
      minHeightMeters: roundMetric(Math.min(...heights)),
      maxHeightMeters: roundMetric(Math.max(...heights)),
      sourcePath: terrainPath,
      notes:
        parsed.notes ??
        `로컬 DEM sample ${samples.length}개를 spatial frame에 연결했습니다.`,
      samples,
    };
  }

  private resolveTerrainPath(sceneId: string): string | null {
    const terrainDir =
      process.env.SCENE_TERRAIN_DIR?.trim() ?? join(process.cwd(), 'data', 'terrain');
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

  private buildFlatProfile(): TerrainSnapshotPayload {
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

function roundMetric(value: number): number {
  return Math.round(value * 1000) / 1000;
}
