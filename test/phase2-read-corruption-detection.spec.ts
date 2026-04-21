import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Test, TestingModule } from '@nestjs/testing';
import { ERROR_CODES } from '../src/common/constants/error-codes';
import { AppLoggerService } from '../src/common/logging/app-logger.service';
import { SceneReadService } from '../src/scene/services/read/scene-read.service';
import { SceneRepository } from '../src/scene/storage/scene.repository';
import type { SceneMeta, SceneDetail, StoredScene } from '../src/scene/types/scene.types';

const TEST_DATA_DIR = join(process.cwd(), 'data', 'scene', '.spec-temp-corrupt');

function makeHappyStoredScene(overrides?: Partial<StoredScene>): StoredScene {
  const base: StoredScene = {
    requestKey: 'test-key',
    query: 'test',
    scale: 'MEDIUM',
    attempts: 1,
    scene: {
      sceneId: 'scene-corrupt-test',
      placeId: 'place-1',
      name: 'Test Scene',
      centerLat: 37.5665,
      centerLng: 126.978,
      radiusM: 200,
      status: 'READY',
      metaUrl: '/api/scenes/scene-corrupt-test/meta',
      assetUrl: null,
      createdAt: '2026-04-01T00:00:00Z',
      updatedAt: '2026-04-01T00:00:00Z',
    },
    meta: {
      sceneId: 'scene-corrupt-test',
      placeId: 'place-1',
      name: 'Test Scene',
      generatedAt: '2026-04-01T00:00:00Z',
      origin: { lat: 37.5665, lng: 126.978 },
      camera: { topView: { x: 0, y: 180, z: 140 }, walkViewStart: { x: 0, y: 1.7, z: 12 } },
      bounds: {
        radiusM: 200,
        northEast: { lat: 37.567, lng: 126.979 },
        southWest: { lat: 37.566, lng: 126.977 },
      },
      stats: { buildingCount: 1, roadCount: 1, walkwayCount: 0, poiCount: 1 },
      diagnostics: {
        droppedBuildings: 0, droppedRoads: 0, droppedWalkways: 0,
        droppedPois: 0, droppedCrossings: 0, droppedStreetFurniture: 0,
        droppedVegetation: 0, droppedLandCovers: 0, droppedLinearFeatures: 0,
      },
      detailStatus: 'FULL',
      visualCoverage: { structure: 1, streetDetail: 0.5, landmark: 0.3, signage: 0.2 },
      materialClasses: [],
      landmarkAnchors: [],
      assetProfile: {
        preset: 'MEDIUM',
        budget: {
          buildingCount: 10, roadCount: 10, walkwayCount: 5, poiCount: 10,
          crossingCount: 5, trafficLightCount: 2, streetLightCount: 2,
          signPoleCount: 2, treeClusterCount: 5, billboardPanelCount: 2,
        },
        selected: {
          buildingCount: 5, roadCount: 5, walkwayCount: 2, poiCount: 5,
          crossingCount: 2, trafficLightCount: 1, streetLightCount: 1,
          signPoleCount: 1, treeClusterCount: 2, billboardPanelCount: 1,
        },
      },
      structuralCoverage: {
        selectedBuildingCoverage: 0.5, coreAreaBuildingCoverage: 0.8,
        fallbackMassingRate: 0.1, footprintPreservationRate: 0.9,
        heroLandmarkCoverage: 1,
      },
      roads: [{
        objectId: 'r1', osmWayId: '1', name: 'Test Rd', laneCount: 2,
        roadClass: 'residential', widthMeters: 8, direction: 'TWO_WAY',
        path: [{ lat: 37.566, lng: 126.977 }, { lat: 37.567, lng: 126.979 }],
        center: { lat: 37.5665, lng: 126.978 },
      }],
      buildings: [{
        objectId: 'b1', osmWayId: '2', name: 'Test Bldg', heightMeters: 10,
        outerRing: [
          { lat: 37.5661, lng: 126.9778 }, { lat: 37.5662, lng: 126.9781 },
          { lat: 37.566, lng: 126.9782 },
        ],
        holes: [], footprint: [], usage: 'COMMERCIAL', preset: 'office_midrise',
        roofType: 'flat',
      }],
      walkways: [],
      pois: [{
        objectId: 'p1', name: 'Test POI', type: 'SHOP',
        location: { lat: 37.5664, lng: 126.9781 }, isLandmark: false,
      }],
    },
    detail: {
      sceneId: 'scene-corrupt-test',
      placeId: 'place-1',
      generatedAt: '2026-04-01T00:00:00Z',
      detailStatus: 'FULL',
      crossings: [],
      roadMarkings: [],
      streetFurniture: [],
      vegetation: [],
      landCovers: [],
      linearFeatures: [],
      facadeHints: [],
      signageClusters: [],
      annotationsApplied: [],
      provenance: {
        mapillaryUsed: false, mapillaryImageCount: 0, mapillaryFeatureCount: 0,
        osmTagCoverage: {
          coloredBuildings: 0, materialBuildings: 0, crossings: 0,
          streetFurniture: 0, vegetation: 0,
        },
        overrideCount: 0,
      },
    },
    place: {
      provider: 'GOOGLE_PLACES',
      placeId: 'place-1',
      displayName: 'Test Place',
      formattedAddress: 'Test Address',
      location: { lat: 37.5665, lng: 126.978 },
      primaryType: 'point_of_interest',
      types: ['point_of_interest'],
      googleMapsUri: 'https://maps.google.com',
      viewport: {
        northEast: { lat: 37.567, lng: 126.979 },
        southWest: { lat: 37.566, lng: 126.977 },
      },
      utcOffsetMinutes: 540,
    },
  };
  return { ...base, ...overrides };
}

async function seedStoredScene(scene: StoredScene): Promise<void> {
  await mkdir(TEST_DATA_DIR, { recursive: true });
  await writeFile(
    join(TEST_DATA_DIR, `${scene.scene.sceneId}.json`),
    JSON.stringify(scene, null, 2),
  );
}

async function seedCorruptJson(sceneId: string, jsonContent: string): Promise<void> {
  await mkdir(TEST_DATA_DIR, { recursive: true });
  await writeFile(join(TEST_DATA_DIR, `${sceneId}.json`), jsonContent);
}

describe('Phase 2: read-service corruption detection', () => {
  let readService: SceneReadService;
  let repository: SceneRepository;

  beforeEach(async () => {
    await rm(TEST_DATA_DIR, { recursive: true, force: true });
    await mkdir(TEST_DATA_DIR, { recursive: true });
    process.env.SCENE_DATA_DIR = TEST_DATA_DIR;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SceneReadService,
        SceneRepository,
        {
          provide: AppLoggerService,
          useValue: {
            info: mock(() => {}),
            warn: mock(() => {}),
            error: mock(() => {}),
            fromRequest: mock(() => ({
              info: mock(() => {}),
              warn: mock(() => {}),
              error: mock(() => {}),
            })),
          },
        },
      ],
    }).compile();

    readService = module.get(SceneReadService);
    repository = module.get(SceneRepository);
    await repository.clear();
  });

  afterEach(async () => {
    await rm(TEST_DATA_DIR, { recursive: true, force: true });
    delete process.env.SCENE_DATA_DIR;
  });

  describe('getReadyScene happy path', () => {
    it('returns ReadyStoredScene when all family members are valid', async () => {
      const scene = makeHappyStoredScene();
      await seedStoredScene(scene);

      const result = await readService.getReadyScene('scene-corrupt-test');

      expect(result.scene.status).toBe('READY');
      expect(result.meta.sceneId).toBe('scene-corrupt-test');
      expect(result.detail.sceneId).toBe('scene-corrupt-test');
      expect(result.place.placeId).toBe('place-1');
    });
  });

  describe('getReadyScene rejects missing family members', () => {
    it('throws SCENE_NOT_READY when meta is undefined', async () => {
      const scene = makeHappyStoredScene({ meta: undefined });
      await seedStoredScene(scene);

      try {
        await readService.getReadyScene('scene-corrupt-test');
        throw new Error('Expected exception');
      } catch (error: unknown) {
        const err = error as { code: string; status: number };
        expect(err.code).toBe(ERROR_CODES.SCENE_NOT_READY);
        expect(err.status).toBe(409);
      }
    });

    it('throws SCENE_NOT_READY when detail is undefined', async () => {
      const scene = makeHappyStoredScene({ detail: undefined });
      await seedStoredScene(scene);

      try {
        await readService.getReadyScene('scene-corrupt-test');
        throw new Error('Expected exception');
      } catch (error: unknown) {
        const err = error as { code: string; status: number };
        expect(err.code).toBe(ERROR_CODES.SCENE_NOT_READY);
        expect(err.status).toBe(409);
      }
    });

    it('throws SCENE_NOT_READY when place is undefined', async () => {
      const scene = makeHappyStoredScene({ place: undefined });
      await seedStoredScene(scene);

      try {
        await readService.getReadyScene('scene-corrupt-test');
        throw new Error('Expected exception');
      } catch (error: unknown) {
        const err = error as { code: string; status: number };
        expect(err.code).toBe(ERROR_CODES.SCENE_NOT_READY);
        expect(err.status).toBe(409);
      }
    });
  });

  describe('getReadyScene rejects corrupt meta family', () => {
    it('throws SCENE_CORRUPT when meta.sceneId is empty', async () => {
      const scene = makeHappyStoredScene({
        meta: makeHappyStoredScene().meta
          ? { ...makeHappyStoredScene().meta!, sceneId: '' }
          : undefined,
      });
      await seedStoredScene(scene);

      try {
        await readService.getReadyScene('scene-corrupt-test');
        throw new Error('Expected exception');
      } catch (error: unknown) {
        const err = error as { code: string; status: number };
        expect(err.code).toBe(ERROR_CODES.SCENE_CORRUPT);
        expect(err.status).toBe(409);
      }
    });

    it('throws SCENE_CORRUPT when meta.pois is not an array', async () => {
      const scene = makeHappyStoredScene({
        meta: { ...makeHappyStoredScene().meta!, pois: null as unknown as [] },
      });
      await seedStoredScene(scene);

      try {
        await readService.getReadyScene('scene-corrupt-test');
        throw new Error('Expected exception');
      } catch (error: unknown) {
        const err = error as { code: string; status: number };
        expect(err.code).toBe(ERROR_CODES.SCENE_CORRUPT);
        expect(err.status).toBe(409);
      }
    });

    it('throws SCENE_CORRUPT when meta.buildings is not an array', async () => {
      const scene = makeHappyStoredScene({
        meta: { ...makeHappyStoredScene().meta!, buildings: 'corrupt' as unknown as [] },
      });
      await seedStoredScene(scene);

      try {
        await readService.getReadyScene('scene-corrupt-test');
        throw new Error('Expected exception');
      } catch (error: unknown) {
        const err = error as { code: string; status: number };
        expect(err.code).toBe(ERROR_CODES.SCENE_CORRUPT);
        expect(err.status).toBe(409);
      }
    });

    it('throws SCENE_CORRUPT when meta.roads is not an array', async () => {
      const scene = makeHappyStoredScene({
        meta: { ...makeHappyStoredScene().meta!, roads: 42 as unknown as [] },
      });
      await seedStoredScene(scene);

      try {
        await readService.getReadyScene('scene-corrupt-test');
        throw new Error('Expected exception');
      } catch (error: unknown) {
        const err = error as { code: string; status: number };
        expect(err.code).toBe(ERROR_CODES.SCENE_CORRUPT);
        expect(err.status).toBe(409);
      }
    });

    it('throws SCENE_CORRUPT when meta.bounds is missing', async () => {
      const scene = makeHappyStoredScene({
        meta: { ...makeHappyStoredScene().meta!, bounds: undefined as unknown as SceneMeta['bounds'] },
      });
      await seedStoredScene(scene);

      try {
        await readService.getReadyScene('scene-corrupt-test');
        throw new Error('Expected exception');
      } catch (error: unknown) {
        const err = error as { code: string; status: number };
        expect(err.code).toBe(ERROR_CODES.SCENE_CORRUPT);
        expect(err.status).toBe(409);
      }
    });

    it('throws SCENE_CORRUPT when meta.stats is missing', async () => {
      const scene = makeHappyStoredScene({
        meta: { ...makeHappyStoredScene().meta!, stats: undefined as unknown as SceneMeta['stats'] },
      });
      await seedStoredScene(scene);

      try {
        await readService.getReadyScene('scene-corrupt-test');
        throw new Error('Expected exception');
      } catch (error: unknown) {
        const err = error as { code: string; status: number };
        expect(err.code).toBe(ERROR_CODES.SCENE_CORRUPT);
        expect(err.status).toBe(409);
      }
    });
  });

  describe('getReadyScene rejects corrupt detail family', () => {
    it('throws SCENE_CORRUPT when detail.sceneId is empty', async () => {
      const scene = makeHappyStoredScene({
        detail: { ...makeHappyStoredScene().detail!, sceneId: '' },
      });
      await seedStoredScene(scene);

      try {
        await readService.getReadyScene('scene-corrupt-test');
        throw new Error('Expected exception');
      } catch (error: unknown) {
        const err = error as { code: string; status: number };
        expect(err.code).toBe(ERROR_CODES.SCENE_CORRUPT);
        expect(err.status).toBe(409);
      }
    });

    it('throws SCENE_CORRUPT when detail.provenance is missing', async () => {
      const scene = makeHappyStoredScene({
        detail: { ...makeHappyStoredScene().detail!, provenance: undefined as unknown as SceneDetail['provenance'] },
      });
      await seedStoredScene(scene);

      try {
        await readService.getReadyScene('scene-corrupt-test');
        throw new Error('Expected exception');
      } catch (error: unknown) {
        const err = error as { code: string; status: number };
        expect(err.code).toBe(ERROR_CODES.SCENE_CORRUPT);
        expect(err.status).toBe(409);
      }
    });

    it('throws SCENE_CORRUPT when detail.crossings is not an array', async () => {
      const scene = makeHappyStoredScene({
        detail: { ...makeHappyStoredScene().detail!, crossings: null as unknown as [] },
      });
      await seedStoredScene(scene);

      try {
        await readService.getReadyScene('scene-corrupt-test');
        throw new Error('Expected exception');
      } catch (error: unknown) {
        const err = error as { code: string; status: number };
        expect(err.code).toBe(ERROR_CODES.SCENE_CORRUPT);
        expect(err.status).toBe(409);
      }
    });
  });

  describe('getReadyScene rejects corrupt place family', () => {
    it('throws SCENE_CORRUPT when place.placeId is empty', async () => {
      const scene = makeHappyStoredScene({
        place: { ...makeHappyStoredScene().place!, placeId: '' },
      });
      await seedStoredScene(scene);

      try {
        await readService.getReadyScene('scene-corrupt-test');
        throw new Error('Expected exception');
      } catch (error: unknown) {
        const err = error as { code: string; status: number };
        expect(err.code).toBe(ERROR_CODES.SCENE_CORRUPT);
        expect(err.status).toBe(500);
      }
    });

    it('throws SCENE_CORRUPT when place.displayName is missing', async () => {
      const scene = makeHappyStoredScene({
        place: { ...makeHappyStoredScene().place!, displayName: '' },
      });
      await seedStoredScene(scene);

      try {
        await readService.getReadyScene('scene-corrupt-test');
        throw new Error('Expected exception');
      } catch (error: unknown) {
        const err = error as { code: string; status: number };
        expect(err.code).toBe(ERROR_CODES.SCENE_CORRUPT);
        expect(err.status).toBe(500);
      }
    });
  });

  describe('getReadyScene rejects partial write / truncated JSON', () => {
    it('throws SCENE_NOT_FOUND when JSON file is unparseable', async () => {
      await seedCorruptJson('scene-corrupt-test', '{"scene": {"sceneId": "scene-corrupt-test", "status": "READY",');

      try {
        await readService.getReadyScene('scene-corrupt-test');
        throw new Error('Expected exception');
      } catch (error: unknown) {
        const err = error as { code: string; status: number };
        expect(err.code).toBe(ERROR_CODES.SCENE_NOT_FOUND);
        expect(err.status).toBe(404);
      }
    });

    it('throws SCENE_NOT_FOUND when JSON file is empty', async () => {
      await seedCorruptJson('scene-corrupt-test', '');

      try {
        await readService.getReadyScene('scene-corrupt-test');
        throw new Error('Expected exception');
      } catch (error: unknown) {
        const err = error as { code: string; status: number };
        expect(err.code).toBe(ERROR_CODES.SCENE_NOT_FOUND);
        expect(err.status).toBe(404);
      }
    });
  });

  describe('adjacent read paths inherit corruption detection', () => {
    it('getBootstrap rejects corrupt meta', async () => {
      const scene = makeHappyStoredScene({
        meta: { ...makeHappyStoredScene().meta!, pois: null as unknown as [] },
      });
      await seedStoredScene(scene);

      try {
        await readService.getBootstrap('scene-corrupt-test');
        throw new Error('Expected exception');
      } catch (error: unknown) {
        const err = error as { code: string; status: number };
        expect(err.code).toBe(ERROR_CODES.SCENE_CORRUPT);
        expect(err.status).toBe(409);
      }
    });

    it('getPlaces rejects corrupt meta', async () => {
      const scene = makeHappyStoredScene({
        meta: { ...makeHappyStoredScene().meta!, buildings: 'bad' as unknown as [] },
      });
      await seedStoredScene(scene);

      try {
        await readService.getPlaces('scene-corrupt-test');
        throw new Error('Expected exception');
      } catch (error: unknown) {
        const err = error as { code: string; status: number };
        expect(err.code).toBe(ERROR_CODES.SCENE_CORRUPT);
        expect(err.status).toBe(409);
      }
    });

    it('getSceneMeta rejects corrupt detail', async () => {
      const scene = makeHappyStoredScene({
        detail: { ...makeHappyStoredScene().detail!, provenance: undefined as unknown as SceneDetail['provenance'] },
      });
      await seedStoredScene(scene);

      try {
        await readService.getSceneMeta('scene-corrupt-test');
        throw new Error('Expected exception');
      } catch (error: unknown) {
        const err = error as { code: string; status: number };
        expect(err.code).toBe(ERROR_CODES.SCENE_CORRUPT);
        expect(err.status).toBe(409);
      }
    });

    it('getSceneDetail rejects corrupt place', async () => {
      const scene = makeHappyStoredScene({
        place: { ...makeHappyStoredScene().place!, placeId: '' },
      });
      await seedStoredScene(scene);

      try {
        await readService.getSceneDetail('scene-corrupt-test');
        throw new Error('Expected exception');
      } catch (error: unknown) {
        const err = error as { code: string; status: number };
        expect(err.code).toBe(ERROR_CODES.SCENE_CORRUPT);
        expect(err.status).toBe(500);
      }
    });
  });
});
