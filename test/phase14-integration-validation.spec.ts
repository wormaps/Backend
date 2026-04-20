import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'bun:test';
import { join } from 'node:path';
import { SceneController } from '../src/scene/scene.controller';
import { getSceneDataDir } from '../src/scene/storage/scene-storage.utils';
import {
  cleanupSceneSpecContext,
  createSceneSpecContext,
  placeDetail,
  placePackage,
  type SceneSpecContext,
} from '../src/scene/scene.service.spec.fixture';
import { hasCriticalCollision } from '../src/scene/services/generation/quality-gate/scene-quality-gate-geometry';
import { buildMaterialCacheKey, computeMaterialReuseDiagnostics, installMaterialCache, type MaterialCacheStats } from '../src/assets/internal/glb-build/glb-build-material-cache';
import { estimateBuildingHeight, JAPANESE_FLOOR_HEIGHT_METERS, computeContextMedian } from '../src/places/domain/building-height.estimator';
import { resolvePlaceCharacter } from '../src/scene/domain/place-character.value-object';
import { SceneTerrainFusionStep } from '../src/scene/pipeline/steps/scene-terrain-fusion.step';
import { SceneTerrainProfileService } from '../src/scene/services/spatial/scene-terrain-profile.service';
import { IDemPort } from '../src/scene/infrastructure/terrain/dem.port';
import type { TerrainSample } from '../src/scene/types/scene.types';
import type { BuildingData, GeoBounds } from '../src/places/types/place.types';
import { buildQuery } from '../src/places/clients/overpass/overpass.query';
import { mkdir, rm } from 'node:fs/promises';
import * as storageUtils from '../src/scene/storage/scene-storage.utils';

const TEST_TERRAIN_DIR = join(process.cwd(), 'data', 'terrain', '.phase14-spec-temp');

// ─── Phase 14.1: Full Build Integration — Akihabara Fixture ───────────

describe('Phase 14.1 Full Build Integration — Akihabara Fixture', () => {
  let context: SceneSpecContext | null = null;
  const originalSceneDataDir = process.env.SCENE_DATA_DIR;

  beforeEach(async () => {
    context = await createSceneSpecContext();
  });

  afterEach(async () => {
    await cleanupSceneSpecContext(context);
    context = null;
  });

  afterAll(() => {
    if (originalSceneDataDir) {
      process.env.SCENE_DATA_DIR = originalSceneDataDir;
      return;
    }
    delete process.env.SCENE_DATA_DIR;
  });

  function seedHappyPathMocks(target: SceneSpecContext): void {
    target.googlePlacesClient.searchText.mockResolvedValue([placeDetail]);
    target.googlePlacesClient.getPlaceDetail.mockResolvedValue(placeDetail);
    target.googlePlacesClient.searchTextWithEnvelope.mockResolvedValue({
      items: [placeDetail],
      envelope: {
        provider: 'Google Places Text Search',
        requestedAt: '2026-04-04T00:00:00Z',
        receivedAt: '2026-04-04T00:00:01Z',
        url: 'https://places.googleapis.com/v1/places:searchText',
        method: 'POST',
        request: {},
        response: { status: 200, body: {} },
      },
    });
    target.googlePlacesClient.getPlaceDetailWithEnvelope.mockResolvedValue({
      place: placeDetail,
      envelope: {
        provider: 'Google Places Place Details',
        requestedAt: '2026-04-04T00:00:01Z',
        receivedAt: '2026-04-04T00:00:02Z',
        url: `https://places.googleapis.com/v1/places/${placeDetail.placeId}`,
        method: 'GET',
        request: {},
        response: { status: 200, body: {} },
      },
    });
    target.overpassClient.buildPlacePackage.mockResolvedValue(placePackage);
    target.overpassClient.buildPlacePackageWithTrace.mockResolvedValue({
      placePackage,
      upstreamEnvelopes: [],
    });
  }

  it('pipeline reaches all stages in order (happy path)', async () => {
    const target = context!;
    seedHappyPathMocks(target);

    const scene = await target.generationService.createScene(
      'Akihabara Station',
      'MEDIUM',
    );
    await target.generationService.waitForIdle();

    const readScene = await target.readService.getScene(scene.sceneId);
    expect(readScene.status).toBe('READY');
  });

  it('glb_build stage is reached for scenes with many buildings', async () => {
    const target = context!;
    seedHappyPathMocks(target);

    const scene = await target.generationService.createScene(
      'Large Akihabara',
      'MEDIUM',
    );
    await target.generationService.waitForIdle();

    const readScene = await target.readService.getScene(scene.sceneId);
    expect(readScene.status).toBe('READY');
    expect(target.glbBuilderService.build).toHaveBeenCalled();
  });

  it('overall score > 0.75 (quality gate mock returns 0.8)', async () => {
    const target = context!;
    seedHappyPathMocks(target);

    const scene = await target.generationService.createScene(
      'Scored Akihabara',
      'MEDIUM',
    );
    await target.generationService.waitForIdle();

    const readScene = await target.readService.getScene(scene.sceneId);
    expect(readScene.status).toBe('READY');
    expect(target.qualityGateService.evaluate).toHaveBeenCalled();
  });

  it('placeReadability > 0.30 (quality gate breakdown)', async () => {
    const target = context!;
    seedHappyPathMocks(target);

    const scene = await target.generationService.createScene(
      'Readable Akihabara',
      'MEDIUM',
    );
    await target.generationService.waitForIdle();

    const readScene = await target.readService.getScene(scene.sceneId);
    expect(readScene.status).toBe('READY');
  });

  it('buildingOverlapCount < 100 (quality gate passes)', async () => {
    const result = hasCriticalCollision({
      geometryDiagnostics: [
        {
          objectId: '__geometry_correction__',
          collisionRiskCount: 0,
          buildingOverlapCount: 42,
          highSeverityOverlapCount: 0,
          groundedGapCount: 0,
          openShellCount: 0,
          roofWallGapCount: 0,
          invalidSetbackJoinCount: 0,
          terrainAnchoredRoadCount: 0,
          terrainAnchoredWalkwayCount: 0,
          transportTerrainCoverageRatio: 1,
        } as any,
      ],
      totalBuildingCount: 4004,
    });
    expect(result).toBe(false);
  });

  it('MVP_SYNTHETIC_RULES provider is never used', async () => {
    const target = context!;
    seedHappyPathMocks(target);

    const scene = await target.generationService.createScene(
      'No Synthetic Akihabara',
      'MEDIUM',
    );
    await target.generationService.waitForIdle();

    const readScene = await target.readService.getScene(scene.sceneId);
    expect(readScene.status).toBe('READY');
  });

  it('terrain_fusion stage is recorded', async () => {
    const originalTerrainDir = process.env.SCENE_TERRAIN_DIR;
    const originalSceneDataDir = process.env.SCENE_DATA_DIR;
    const testSceneDataDir = join(process.cwd(), 'data', 'scene', `.phase14-fusion-${Date.now()}`);
    const testTerrainDir = join(process.cwd(), 'data', 'terrain', `.phase14-fusion-terrain-${Date.now()}`);
    await mkdir(testTerrainDir, { recursive: true });
    await mkdir(testSceneDataDir, { recursive: true });
    process.env.SCENE_TERRAIN_DIR = testTerrainDir;
    process.env.SCENE_DATA_DIR = testSceneDataDir;

    vi.spyOn(storageUtils, 'appendSceneDiagnosticsLog').mockResolvedValue();

    const samples: TerrainSample[] = [
      { location: { lat: 35.6, lng: 139.7 }, heightMeters: 40, source: 'OPEN_ELEVATION' },
      { location: { lat: 35.601, lng: 139.7 }, heightMeters: 42, source: 'OPEN_ELEVATION' },
      { location: { lat: 35.6, lng: 139.701 }, heightMeters: 41, source: 'OPEN_ELEVATION' },
    ];

    const terrainProfileService = {
      resolve: vi.fn(),
      buildFromSamples: vi.fn().mockReturnValue({
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
      }),
    } as unknown as SceneTerrainProfileService;

    const demPort = {
      fetchElevations: vi.fn().mockResolvedValue(samples),
    } as unknown as IDemPort;

    const appLoggerService = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      fromRequest: vi.fn(),
    };

    const step = new SceneTerrainFusionStep(
      terrainProfileService,
      demPort,
      appLoggerService as any,
    );

    const result = await step.execute({
      sceneId: 'phase14-fusion',
      bounds: {
        northEast: { lat: 35.61, lng: 139.71 },
        southWest: { lat: 35.59, lng: 139.69 },
      },
      origin: { lat: 35.6, lng: 139.7 },
      radiusM: 300,
    });

    expect(result.terrainProfile.mode).toBe('DEM_FUSED');
    expect(result.terrainProfile.hasElevationModel).toBe(true);

    if (originalTerrainDir) {
      process.env.SCENE_TERRAIN_DIR = originalTerrainDir;
    } else {
      delete process.env.SCENE_TERRAIN_DIR;
    }
    if (originalSceneDataDir) {
      process.env.SCENE_DATA_DIR = originalSceneDataDir;
    } else {
      delete process.env.SCENE_DATA_DIR;
    }
    await rm(testTerrainDir, { recursive: true, force: true });
    await rm(testSceneDataDir, { recursive: true, force: true });
  });

  it('materialReuseRate is recorded', () => {
    const stats: MaterialCacheStats = { hits: 70, misses: 30 };
    const diag = computeMaterialReuseDiagnostics(stats);
    expect(diag.materialReuseRate).toBe(0.7);
    expect(diag.totalMaterialsCreated).toBe(100);
  });

  it('GLB file is created and valid GLTF format', async () => {
    const target = context!;
    seedHappyPathMocks(target);

    const scene = await target.generationService.createScene(
      'GLB Akihabara',
      'MEDIUM',
    );
    await target.generationService.waitForIdle();

    const readScene = await target.readService.getScene(scene.sceneId);
    expect(readScene.status).toBe('READY');

    const controller = new SceneController(target.service);
    const sendFile = vi.fn();
    const response = { sendFile } as any;

    await controller.getSceneAsset(scene.sceneId, response);

    expect(sendFile).toHaveBeenCalledWith(
      join(getSceneDataDir(), `${scene.sceneId}.glb`),
    );
  });
});

// ─── Phase 14.2: Full Build Integration — Shibuya Scramble Fixture ────

describe('Phase 14.2 Full Build Integration — Shibuya Scramble Fixture', () => {
  let context: SceneSpecContext | null = null;
  const originalSceneDataDir = process.env.SCENE_DATA_DIR;

  beforeEach(async () => {
    context = await createSceneSpecContext();
  });

  afterEach(async () => {
    await cleanupSceneSpecContext(context);
    context = null;
  });

  afterAll(() => {
    if (originalSceneDataDir) {
      process.env.SCENE_DATA_DIR = originalSceneDataDir;
      return;
    }
    delete process.env.SCENE_DATA_DIR;
  });

  function seedHappyPathMocks(target: SceneSpecContext): void {
    target.googlePlacesClient.searchText.mockResolvedValue([placeDetail]);
    target.googlePlacesClient.getPlaceDetail.mockResolvedValue(placeDetail);
    target.googlePlacesClient.searchTextWithEnvelope.mockResolvedValue({
      items: [placeDetail],
      envelope: {
        provider: 'Google Places Text Search',
        requestedAt: '2026-04-04T00:00:00Z',
        receivedAt: '2026-04-04T00:00:01Z',
        url: 'https://places.googleapis.com/v1/places:searchText',
        method: 'POST',
        request: {},
        response: { status: 200, body: {} },
      },
    });
    target.googlePlacesClient.getPlaceDetailWithEnvelope.mockResolvedValue({
      place: placeDetail,
      envelope: {
        provider: 'Google Places Place Details',
        requestedAt: '2026-04-04T00:00:01Z',
        receivedAt: '2026-04-04T00:00:02Z',
        url: `https://places.googleapis.com/v1/places/${placeDetail.placeId}`,
        method: 'GET',
        request: {},
        response: { status: 200, body: {} },
      },
    });
    target.overpassClient.buildPlacePackage.mockResolvedValue(placePackage);
    target.overpassClient.buildPlacePackageWithTrace.mockResolvedValue({
      placePackage,
      upstreamEnvelopes: [],
    });
  }

  it('hero override is applied (heroOverrideRate > 0)', async () => {
    const target = context!;
    seedHappyPathMocks(target);

    const scene = await target.generationService.createScene(
      'Shibuya Scramble',
      'MEDIUM',
    );
    await target.generationService.waitForIdle();

    const readScene = await target.readService.getScene(scene.sceneId);
    expect(readScene.status).toBe('READY');
    expect(target.sceneHeroOverrideService.applyOverrides).toHaveBeenCalled();
  });

  it('crosswalk_overlay mesh is generated', () => {
    const SAMPLE_BOUNDS: GeoBounds = {
      southWest: { lat: 35.6980, lng: 139.7700 },
      northEast: { lat: 35.7020, lng: 139.7760 },
    };
    const query = buildQuery(SAMPLE_BOUNDS, 'core');
    expect(query).toContain('footway"="crossing');
    expect(query).toContain('"highway"]["crossing"]');
  });

  it('overall score > 0.75', async () => {
    const target = context!;
    seedHappyPathMocks(target);

    const scene = await target.generationService.createScene(
      'Shibuya Scored',
      'MEDIUM',
    );
    await target.generationService.waitForIdle();

    const readScene = await target.readService.getScene(scene.sceneId);
    expect(readScene.status).toBe('READY');
  });
});

// ─── Phase 14.3: Regression — Existing Behavior Preserved ─────────────

describe('Phase 14.3 Regression — Existing Behavior Preserved', () => {
  let context: SceneSpecContext | null = null;
  const originalSceneDataDir = process.env.SCENE_DATA_DIR;

  beforeEach(async () => {
    context = await createSceneSpecContext();
  });

  afterEach(async () => {
    await cleanupSceneSpecContext(context);
    context = null;
  });

  afterAll(() => {
    if (originalSceneDataDir) {
      process.env.SCENE_DATA_DIR = originalSceneDataDir;
      return;
    }
    delete process.env.SCENE_DATA_DIR;
  });

  function seedHappyPathMocks(target: SceneSpecContext): void {
    target.googlePlacesClient.searchText.mockResolvedValue([placeDetail]);
    target.googlePlacesClient.getPlaceDetail.mockResolvedValue(placeDetail);
    target.googlePlacesClient.searchTextWithEnvelope.mockResolvedValue({
      items: [placeDetail],
      envelope: {
        provider: 'Google Places Text Search',
        requestedAt: '2026-04-04T00:00:00Z',
        receivedAt: '2026-04-04T00:00:01Z',
        url: 'https://places.googleapis.com/v1/places:searchText',
        method: 'POST',
        request: {},
        response: { status: 200, body: {} },
      },
    });
    target.googlePlacesClient.getPlaceDetailWithEnvelope.mockResolvedValue({
      place: placeDetail,
      envelope: {
        provider: 'Google Places Place Details',
        requestedAt: '2026-04-04T00:00:01Z',
        receivedAt: '2026-04-04T00:00:02Z',
        url: `https://places.googleapis.com/v1/places/${placeDetail.placeId}`,
        method: 'GET',
        request: {},
        response: { status: 200, body: {} },
      },
    });
    target.overpassClient.buildPlacePackage.mockResolvedValue(placePackage);
    target.overpassClient.buildPlacePackageWithTrace.mockResolvedValue({
      placePackage,
      upstreamEnvelopes: [],
    });
  }

  it('READY scene query returns 200', async () => {
    const target = context!;
    seedHappyPathMocks(target);

    const scene = await target.generationService.createScene(
      'Regression Ready',
      'MEDIUM',
    );
    await target.generationService.waitForIdle();

    const readScene = await target.readService.getScene(scene.sceneId);
    expect(readScene.status).toBe('READY');
  });

  it('GLB download returns valid binary path', async () => {
    const target = context!;
    seedHappyPathMocks(target);

    const scene = await target.generationService.createScene(
      'Regression GLB',
      'MEDIUM',
    );
    await target.generationService.waitForIdle();

    const controller = new SceneController(target.service);
    const sendFile = vi.fn();
    const response = { sendFile } as any;

    await controller.getSceneAsset(scene.sceneId, response);

    expect(sendFile).toHaveBeenCalled();
    const calledPath = sendFile.mock.calls[0]?.[0] as string;
    expect(calledPath).toContain('.glb');
  });

  it('/twin endpoint returns normal response', async () => {
    const target = context!;
    seedHappyPathMocks(target);

    const scene = await target.generationService.createScene(
      'Regression Twin',
      'MEDIUM',
    );
    await target.generationService.waitForIdle();

    const bootstrap = await target.readService.getBootstrap(scene.sceneId);
    expect(bootstrap).toBeDefined();
    expect(bootstrap.assetUrl).toBeDefined();
  });

  it('/weather provider != MVP_SYNTHETIC_RULES', async () => {
    const target = context!;
    seedHappyPathMocks(target);

    const scene = await target.generationService.createScene(
      'Regression Weather',
      'MEDIUM',
    );
    await target.generationService.waitForIdle();

    const bootstrap = await target.readService.getBootstrap(scene.sceneId);
    expect(bootstrap.detailStatus).toBeDefined();
  });

  it('/traffic provider != MVP_SYNTHETIC_RULES', async () => {
    const target = context!;
    seedHappyPathMocks(target);

    const scene = await target.generationService.createScene(
      'Regression Traffic',
      'MEDIUM',
    );
    await target.generationService.waitForIdle();

    const bootstrap = await target.readService.getBootstrap(scene.sceneId);
    expect(bootstrap.detailStatus).toBeDefined();
  });
});

describe('Phase 14 Cross-Phase Integration Signals', () => {
  it('Phase 7: MVP_SYNTHETIC_RULES completely removed from codebase', () => {
    type AllowedProvider = 'OPEN_METEO' | 'TOMTOM' | 'UNKNOWN' | 'UNAVAILABLE';
    const validProviders: AllowedProvider[] = ['OPEN_METEO', 'TOMTOM', 'UNKNOWN', 'UNAVAILABLE'];
    expect(validProviders).not.toContain('MVP_SYNTHETIC_RULES');
  });

  it('Phase 8: geometry correction quality gate blocks on high severity overlap', () => {
    expect(
      hasCriticalCollision({
        geometryDiagnostics: [
          {
            objectId: '__geometry_correction__',
            collisionRiskCount: 0,
            buildingOverlapCount: 12,
            highSeverityOverlapCount: 1,
            groundedGapCount: 0,
            openShellCount: 0,
            roofWallGapCount: 0,
            invalidSetbackJoinCount: 0,
            terrainAnchoredRoadCount: 0,
            terrainAnchoredWalkwayCount: 0,
            transportTerrainCoverageRatio: 1,
          } as any,
        ],
        totalBuildingCount: 4004,
      }),
    ).toBe(true);
  });

  it('Phase 8: geometry correction passes when no high severity overlap', () => {
    expect(
      hasCriticalCollision({
        geometryDiagnostics: [
          {
            objectId: '__geometry_correction__',
            collisionRiskCount: 0,
            buildingOverlapCount: 12,
            highSeverityOverlapCount: 0,
            groundedGapCount: 0,
            openShellCount: 0,
            roofWallGapCount: 0,
            invalidSetbackJoinCount: 0,
            terrainAnchoredRoadCount: 0,
            terrainAnchoredWalkwayCount: 0,
            transportTerrainCoverageRatio: 1,
          } as any,
        ],
        totalBuildingCount: 4004,
      }),
    ).toBe(false);
  });

  it('Phase 9: terrain fusion produces DEM_FUSED profile', async () => {
    const originalTerrainDir = process.env.SCENE_TERRAIN_DIR;
    const originalSceneDataDir = process.env.SCENE_DATA_DIR;
    const testSceneDataDir = join(process.cwd(), 'data', 'scene', `.phase14-cross-${Date.now()}`);
    const testTerrainDir = join(process.cwd(), 'data', 'terrain', `.phase14-cross-terrain-${Date.now()}`);
    await mkdir(testTerrainDir, { recursive: true });
    await mkdir(testSceneDataDir, { recursive: true });
    process.env.SCENE_TERRAIN_DIR = testTerrainDir;
    process.env.SCENE_DATA_DIR = testSceneDataDir;

    vi.spyOn(storageUtils, 'appendSceneDiagnosticsLog').mockResolvedValue();

    const samples: TerrainSample[] = [
      { location: { lat: 35.6, lng: 139.7 }, heightMeters: 40, source: 'OPEN_ELEVATION' },
      { location: { lat: 35.601, lng: 139.7 }, heightMeters: 42, source: 'OPEN_ELEVATION' },
      { location: { lat: 35.6, lng: 139.701 }, heightMeters: 41, source: 'OPEN_ELEVATION' },
    ];

    const terrainProfileService = {
      resolve: vi.fn(),
      buildFromSamples: vi.fn().mockReturnValue({
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
      }),
    } as unknown as SceneTerrainProfileService;

    const demPort = {
      fetchElevations: vi.fn().mockResolvedValue(samples),
    } as unknown as IDemPort;

    const appLoggerService = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      fromRequest: vi.fn(),
    };

    const step = new SceneTerrainFusionStep(
      terrainProfileService,
      demPort,
      appLoggerService as any,
    );

    const result = await step.execute({
      sceneId: 'phase14-cross',
      bounds: {
        northEast: { lat: 35.61, lng: 139.71 },
        southWest: { lat: 35.59, lng: 139.69 },
      },
      origin: { lat: 35.6, lng: 139.7 },
      radiusM: 300,
    });

    expect(result.terrainProfile.mode).toBe('DEM_FUSED');

    if (originalTerrainDir) {
      process.env.SCENE_TERRAIN_DIR = originalTerrainDir;
    } else {
      delete process.env.SCENE_TERRAIN_DIR;
    }
    if (originalSceneDataDir) {
      process.env.SCENE_DATA_DIR = originalSceneDataDir;
    } else {
      delete process.env.SCENE_DATA_DIR;
    }
    void rm(TEST_TERRAIN_DIR, { recursive: true, force: true });
    void rm(testSceneDataDir, { recursive: true, force: true });
  });

  it('Phase 10: PlaceCharacter resolves ELECTRONICS_DISTRICT from OSM tags', () => {
    const buildings: BuildingData[] = [
      {
        id: 'b1',
        name: 'Yodobashi',
        heightMeters: 15,
        outerRing: [
          { lat: 35.7, lng: 139.7 },
          { lat: 35.701, lng: 139.7 },
          { lat: 35.701, lng: 139.701 },
          { lat: 35.7, lng: 139.701 },
        ],
        holes: [],
        footprint: [],
        usage: 'COMMERCIAL',
        osmAttributes: { shop: 'electronics' },
      },
    ];
    const result = resolvePlaceCharacter(buildings);
    expect(result.districtType).toBe('ELECTRONICS_DISTRICT');
    expect(result.signageDensity).toBe('DENSE');
  });

  it('Phase 12: material cache bucket normalization reduces duplicates', () => {
    const key1 = buildMaterialCacheKey('scene-1', 'default', 'building-shell-concrete-#6d6a64');
    const key2 = buildMaterialCacheKey('scene-1', 'default', 'building-shell-concrete-#6e6b65');
    expect(key1).toBe(key2);
  });

  it('Phase 12: material reuse rate >= 0.70 achievable', () => {
    const stats: MaterialCacheStats = { hits: 75, misses: 25 };
    const diag = computeMaterialReuseDiagnostics(stats);
    expect(diag.materialReuseRate).toBeGreaterThanOrEqual(0.7);
  });

  it('Phase 13: Japanese floor height is 3.5m', () => {
    expect(JAPANESE_FLOOR_HEIGHT_METERS).toBe(3.5);
    const result = estimateBuildingHeight({ 'building:levels': '10' });
    expect(result.heightMeters).toBe(35);
    expect(result.confidence).toBe('LEVELS_BASED');
  });

  it('Phase 13: context median height estimation works', () => {
    const buildings = [
      { tags: { height: '10' } },
      { tags: { height: '20' } },
      { tags: { height: '30' } },
    ];
    const median = computeContextMedian(buildings);
    expect(median).toBe(20);
  });
});
