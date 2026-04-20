import { describe, expect, it, vi, beforeEach, afterEach, beforeAll, afterAll } from 'bun:test';
import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { SceneTerrainFusionStep } from '../src/scene/pipeline/steps/scene-terrain-fusion.step';
import { SceneTerrainProfileService } from '../src/scene/services/spatial/scene-terrain-profile.service';
import { IDemPort } from '../src/scene/infrastructure/terrain/dem.port';
import type { TerrainSample } from '../src/scene/types/scene.types';

const TEST_TERRAIN_DIR = join(process.cwd(), 'data', 'terrain', '.phase9-spec-temp');

function makeMocks() {
  const terrainProfileService = {
    resolve: vi.fn(),
    buildFromSamples: vi.fn(),
  } as unknown as SceneTerrainProfileService;

  const demPort = {
    fetchElevations: vi.fn(),
  } as unknown as IDemPort;

  const appLoggerService = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fromRequest: vi.fn(),
  };

  return { terrainProfileService, demPort, appLoggerService };
}

describe('Phase 9.3 TerrainFusion Application', () => {
  let mocks: ReturnType<typeof makeMocks>;
  let step: SceneTerrainFusionStep;
  const originalTerrainDir = process.env.SCENE_TERRAIN_DIR;

  beforeAll(async () => {
    await rm(TEST_TERRAIN_DIR, { recursive: true, force: true });
    await mkdir(TEST_TERRAIN_DIR, { recursive: true });
    process.env.SCENE_TERRAIN_DIR = TEST_TERRAIN_DIR;
  });

  afterAll(() => {
    if (originalTerrainDir) {
      process.env.SCENE_TERRAIN_DIR = originalTerrainDir;
    } else {
      delete process.env.SCENE_TERRAIN_DIR;
    }
    void rm(TEST_TERRAIN_DIR, { recursive: true, force: true });
  });

  beforeEach(() => {
    mocks = makeMocks();
    step = new SceneTerrainFusionStep(
      mocks.terrainProfileService,
      mocks.demPort,
      mocks.appLoggerService as any,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls DemAdapter when no local terrain file exists', async () => {
    const samples: TerrainSample[] = [
      { location: { lat: 35.6, lng: 139.7 }, heightMeters: 40, source: 'OPEN_ELEVATION' },
      { location: { lat: 35.601, lng: 139.7 }, heightMeters: 42, source: 'OPEN_ELEVATION' },
      { location: { lat: 35.6, lng: 139.701 }, heightMeters: 41, source: 'OPEN_ELEVATION' },
    ];

    vi.spyOn(mocks.demPort, 'fetchElevations').mockResolvedValue(samples);
    vi.spyOn(mocks.terrainProfileService, 'buildFromSamples').mockReturnValue({
      mode: 'DEM_FUSED',
      source: 'OPEN_ELEVATION',
      hasElevationModel: true,
      heightReference: 'LOCAL_DEM',
      baseHeightMeters: 40,
      sampleCount: 3,
      minHeightMeters: 40,
      maxHeightMeters: 42,
      sourcePath: null,
      notes: 'test',
      samples,
    });

    const result = await step.execute('phase9-fusion-1', {
      northEast: { lat: 35.61, lng: 139.71 },
      southWest: { lat: 35.59, lng: 139.69 },
    });

    expect(mocks.demPort.fetchElevations).toHaveBeenCalled();
    expect(result.terrainProfile.mode).toBe('DEM_FUSED');
  });

  it('falls back to FLAT_PLACEHOLDER when DemAdapter fails', async () => {
    vi.spyOn(mocks.demPort, 'fetchElevations').mockResolvedValue([]);

    const result = await step.execute('phase9-fusion-2', {
      northEast: { lat: 35.61, lng: 139.71 },
      southWest: { lat: 35.59, lng: 139.69 },
    });

    expect(result.terrainProfile.mode).toBe('FLAT_PLACEHOLDER');
    expect(result.terrainProfile.hasElevationModel).toBe(false);
    expect(result.terrainFilePath).toBeNull();
  });

  it('generates 81 grid points (9x9) for bbox', async () => {
    let capturedPoints: any[] = [];
    vi.spyOn(mocks.demPort, 'fetchElevations').mockImplementation(async (pts) => {
      capturedPoints = pts as any[];
      return [];
    });

    await step.execute('phase9-fusion-3', {
      northEast: { lat: 35.61, lng: 139.71 },
      southWest: { lat: 35.59, lng: 139.69 },
    });

    expect(capturedPoints).toHaveLength(81);
    expect(capturedPoints[0].lat).toBe(35.59);
    expect(capturedPoints[0].lng).toBe(139.69);
    const last = capturedPoints[capturedPoints.length - 1];
    expect(last.lat).toBe(35.61);
    expect(last.lng).toBe(139.71);
  });
});
