import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { SceneTerrainProfileService } from './scene-terrain-profile.service';
import type { SceneMeta } from '../../types/scene.types';

describe('SceneTerrainProfileService', () => {
  const service = new SceneTerrainProfileService();
  const originalTerrainDir = process.env.SCENE_TERRAIN_DIR;
  const terrainDir = join(process.cwd(), 'data', 'terrain', '.spec-temp');
  const meta = {
    bounds: {
      northEast: { lat: 37.567, lng: 126.979 },
      southWest: { lat: 37.566, lng: 126.977 },
      radiusM: 600,
    },
  } as Pick<SceneMeta, 'bounds'> as SceneMeta;

  beforeEach(async () => {
    await rm(terrainDir, { recursive: true, force: true });
    await mkdir(terrainDir, { recursive: true });
    process.env.SCENE_TERRAIN_DIR = terrainDir;
  });

  afterEach(async () => {
    await rm(terrainDir, { recursive: true, force: true });
  });

  afterAll(() => {
    if (originalTerrainDir) {
      process.env.SCENE_TERRAIN_DIR = originalTerrainDir;
      return;
    }
    delete process.env.SCENE_TERRAIN_DIR;
  });

  it('returns flat placeholder when no terrain file exists', () => {
    const result = service.resolve('scene-missing', meta);

    expect(result.mode).toBe('FLAT_PLACEHOLDER');
    expect(result.hasElevationModel).toBe(false);
    expect(result.sampleCount).toBe(0);
  });

  it('loads local DEM samples when terrain file exists', async () => {
    await writeFile(
      join(terrainDir, 'scene-cityhall.terrain.json'),
      JSON.stringify({
        heightReference: 'LOCAL_DEM',
        notes: 'spec terrain',
        samples: [
          { lat: 37.5664, lng: 126.9778, heightMeters: 32.1 },
          { lat: 37.5667, lng: 126.9784, heightMeters: 34.8 },
        ],
      }),
      'utf8',
    );

    const result = service.resolve('scene-cityhall', meta);

    expect(result.mode).toBe('LOCAL_DEM_SAMPLES');
    expect(result.hasElevationModel).toBe(true);
    expect(result.heightReference).toBe('LOCAL_DEM');
    expect(result.sampleCount).toBe(2);
    expect(result.baseHeightMeters).toBe(32.1);
    expect(result.source).toBe('LOCAL_FILE');
  });
});
