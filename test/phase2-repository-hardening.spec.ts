import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Test, TestingModule } from '@nestjs/testing';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'bun:test';
import { AppLoggerService } from '../src/common/logging/app-logger.service';
import { SceneRepository } from '../src/scene/storage/scene.repository';
import {
  parseSceneJson,
  readSceneJsonFile,
  SceneCorruptionError,
  writeFileAtomically,
} from '../src/scene/storage/scene-storage.utils';
import { StoredScene } from '../src/scene/types/scene.types';

function makeStoredScene(sceneId: string): StoredScene {
  return {
    requestKey: `key-${sceneId}`,
    query: `query-${sceneId}`,
    scale: 'SMALL',
    attempts: 1,
    scene: {
      sceneId,
      placeId: 'place-1',
      name: sceneId,
      centerLat: 37.5,
      centerLng: 127.0,
      radiusM: 500,
      status: 'READY',
      metaUrl: `/api/scenes/${sceneId}/meta`,
      assetUrl: `/api/scenes/${sceneId}/assets/base.glb`,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
  };
}

async function createTempDir(): Promise<string> {
  const dir = join(process.cwd(), 'data', 'scene', '.spec-temp-repo');
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  return dir;
}

async function buildModule(dir: string): Promise<{
  module: TestingModule;
  repository: SceneRepository;
  logger: ReturnType<typeof vi.fn>;
}> {
  const warnFn = vi.fn();
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      SceneRepository,
      {
        provide: AppLoggerService,
        useValue: { info: vi.fn(), warn: warnFn, error: vi.fn(), fromRequest: vi.fn() },
      },
    ],
  }).compile();
  const repository = module.get(SceneRepository);
  await repository.clear();
  await mkdir(dir, { recursive: true });
  return { module, repository, logger: warnFn };
}

describe('Phase 2 repository hardening', () => {
  let tempDir: string;
  const originalDir = process.env.SCENE_DATA_DIR;

  beforeEach(async () => {
    tempDir = await createTempDir();
    process.env.SCENE_DATA_DIR = tempDir;
  });

  afterEach(async () => {
    delete process.env.SCENE_DATA_DIR;
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  afterAll(() => {
    if (originalDir) {
      process.env.SCENE_DATA_DIR = originalDir;
    } else {
      delete process.env.SCENE_DATA_DIR;
    }
  });

  describe('parseSceneJson', () => {
    it('returns parsed object for valid JSON', () => {
      const result = parseSceneJson<{ a: number }>('{"a":1}', 'test');
      expect(result).toEqual({ a: 1 });
    });

    it('throws SceneCorruptionError with kind empty-file for empty string', () => {
      expect(() => parseSceneJson('', 'test')).toThrow(SceneCorruptionError);
      try {
        parseSceneJson('', 'test');
      } catch (err) {
        expect(err).toBeInstanceOf(SceneCorruptionError);
        expect((err as SceneCorruptionError).kind).toBe('empty-file');
      }
    });

    it('throws SceneCorruptionError with kind empty-file for whitespace-only', () => {
      expect(() => parseSceneJson('   \n  ', 'test')).toThrow(SceneCorruptionError);
      try {
        parseSceneJson('   \n  ', 'test');
      } catch (err) {
        expect((err as SceneCorruptionError).kind).toBe('empty-file');
      }
    });

    it('throws SceneCorruptionError with kind parse-failure for malformed JSON', () => {
      expect(() => parseSceneJson('{bad json', 'test')).toThrow(SceneCorruptionError);
      try {
        parseSceneJson('{bad json', 'test');
      } catch (err) {
        expect(err).toBeInstanceOf(SceneCorruptionError);
        expect((err as SceneCorruptionError).kind).toBe('parse-failure');
      }
    });

    it('throws SceneCorruptionError for truncated JSON', () => {
      expect(() => parseSceneJson('{"scene":{"sceneId":"x"', 'test')).toThrow(
        SceneCorruptionError,
      );
      try {
        parseSceneJson('{"scene":{"sceneId":"x"', 'test');
      } catch (err) {
        expect((err as SceneCorruptionError).kind).toBe('parse-failure');
      }
    });
  });

  describe('readSceneJsonFile', () => {
    it('returns null for non-existent file', async () => {
      const result = await readSceneJsonFile(join(tempDir, 'nope.json'), 'nope');
      expect(result).toBeNull();
    });

    it('throws SceneCorruptionError for empty file', async () => {
      const path = join(tempDir, 'empty.json');
      await writeFile(path, '');
      await expect(readSceneJsonFile(path, 'empty')).rejects.toThrow(
        SceneCorruptionError,
      );
    });

    it('throws SceneCorruptionError for malformed file', async () => {
      const path = join(tempDir, 'bad.json');
      await writeFile(path, 'not json at all');
      await expect(readSceneJsonFile(path, 'bad')).rejects.toThrow(
        SceneCorruptionError,
      );
    });

    it('returns parsed object for valid file', async () => {
      const path = join(tempDir, 'good.json');
      await writeFile(path, '{"x":42}');
      const result = await readSceneJsonFile<{ x: number }>(path, 'good');
      expect(result).toEqual({ x: 42 });
    });
  });

  describe('findById with corruption', () => {
    it('returns undefined and logs warning for corrupted scene file', async () => {
      const { repository, logger } = await buildModule(tempDir);
      const sceneId = 'corrupt-1';
      const scenePath = join(tempDir, `${sceneId}.json`);
      await writeFile(scenePath, '{broken json');

      const result = await repository.findById(sceneId);
      expect(result).toBeUndefined();
      expect(logger).toHaveBeenCalledWith(
        'scene.repository.corrupted',
        expect.objectContaining({ sceneId, kind: 'parse-failure' }),
      );
    });

    it('returns undefined for empty scene file', async () => {
      const { repository, logger } = await buildModule(tempDir);
      const sceneId = 'empty-1';
      await writeFile(join(tempDir, `${sceneId}.json`), '');

      const result = await repository.findById(sceneId);
      expect(result).toBeUndefined();
      expect(logger).toHaveBeenCalledWith(
        'scene.repository.corrupted',
        expect.objectContaining({ sceneId, kind: 'empty-file' }),
      );
    });

    it('invalidates cache when disk file is corrupted', async () => {
      const { repository } = await buildModule(tempDir);
      const scene = makeStoredScene('cache-corrupt');

      await repository.save(scene);
      const cached = await repository.findById(scene.scene.sceneId);
      expect(cached).toBeDefined();

      await writeFile(
        join(tempDir, `${scene.scene.sceneId}.json`),
        '{corrupted',
      );

      const result = await repository.findById(scene.scene.sceneId);
      expect(result).toBeUndefined();

      const result2 = await repository.findById(scene.scene.sceneId);
      expect(result2).toBeUndefined();
    });

    it('invalidates cache when disk file is missing but cache has entry', async () => {
      const { repository } = await buildModule(tempDir);
      const scene = makeStoredScene('missing-disk');

      await repository.save(scene);
      const cached = await repository.findById(scene.scene.sceneId);
      expect(cached).toBeDefined();

      await rm(join(tempDir, `${scene.scene.sceneId}.json`));

      const result = await repository.findById(scene.scene.sceneId);
      expect(result).toBeUndefined();
    });

    it('returns valid scene from disk when cache is empty', async () => {
      const { repository } = await buildModule(tempDir);
      const scene = makeStoredScene('disk-only');

      await writeFileAtomically(
        join(tempDir, `${scene.scene.sceneId}.json`),
        JSON.stringify(scene, null, 2),
        'utf8',
      );

      const result = await repository.findById(scene.scene.sceneId);
      expect(result).toBeDefined();
      expect(result?.scene.sceneId).toBe('disk-only');
    });
  });

  describe('findByRequestKey with disk truth', () => {
    it('uses disk index when cache disagrees', async () => {
      const { repository } = await buildModule(tempDir);
      const scene1 = makeStoredScene('scene-a');
      const scene2 = makeStoredScene('scene-b');

      await repository.save(scene1, 'shared-key');
      await repository.save(scene2, 'shared-key');

      const result = await repository.findByRequestKey('shared-key');
      expect(result?.scene.sceneId).toBe('scene-b');
    });

    it('returns undefined when index file is missing', async () => {
      const { repository } = await buildModule(tempDir);
      const result = await repository.findByRequestKey('no-such-key');
      expect(result).toBeUndefined();
    });

    it('returns undefined when index file is corrupted', async () => {
      const { repository, logger } = await buildModule(tempDir);
      await writeFile(join(tempDir, 'index.json'), '{bad');

      const result = await repository.findByRequestKey('any-key');
      expect(result).toBeUndefined();
    });
  });

  describe('save disk-before-cache ordering', () => {
    it('persists scene to disk and cache is populated after save', async () => {
      const { repository } = await buildModule(tempDir);
      const scene = makeStoredScene('order-test');

      const saved = await repository.save(scene);
      expect(saved).toBe(scene);

      const fromDisk = await repository.findById(scene.scene.sceneId);
      expect(fromDisk?.scene.sceneId).toBe('order-test');
    });

    it('persists artifacts to disk', async () => {
      const { repository } = await buildModule(tempDir);
      const scene = makeStoredScene('artifact-test');
      scene.meta = {
        sceneId: scene.scene.sceneId,
        placeId: 'p1',
        name: 'test',
        generatedAt: '2026-01-01T00:00:00Z',
        origin: { lat: 0, lng: 0 },
        camera: { topView: { x: 0, y: 0, z: 0 }, walkViewStart: { x: 0, y: 0, z: 0 } },
        bounds: {
          radiusM: 100,
          northEast: { lat: 0, lng: 0 },
          southWest: { lat: 0, lng: 0 },
        },
        stats: { buildingCount: 0, roadCount: 0, walkwayCount: 0, poiCount: 0 },
        diagnostics: {
          droppedBuildings: 0,
          droppedRoads: 0,
          droppedWalkways: 0,
          droppedPois: 0,
          droppedCrossings: 0,
          droppedStreetFurniture: 0,
          droppedVegetation: 0,
          droppedLandCovers: 0,
          droppedLinearFeatures: 0,
        },
        detailStatus: 'OSM_ONLY',
        visualCoverage: { structure: 0, streetDetail: 0, landmark: 0, signage: 0 },
        materialClasses: [],
        landmarkAnchors: [],
        assetProfile: {
          preset: 'SMALL',
          budget: {
            buildingCount: 0, roadCount: 0, walkwayCount: 0, poiCount: 0,
            crossingCount: 0, trafficLightCount: 0, streetLightCount: 0,
            signPoleCount: 0, treeClusterCount: 0, billboardPanelCount: 0,
          },
          selected: {
            buildingCount: 0, roadCount: 0, walkwayCount: 0, poiCount: 0,
            crossingCount: 0, trafficLightCount: 0, streetLightCount: 0,
            signPoleCount: 0, treeClusterCount: 0, billboardPanelCount: 0,
          },
        },
        structuralCoverage: {
          selectedBuildingCoverage: 0,
          coreAreaBuildingCoverage: 0,
          fallbackMassingRate: 0,
          footprintPreservationRate: 0,
          heroLandmarkCoverage: 0,
        },
        roads: [],
        buildings: [],
        walkways: [],
        pois: [],
      };

      await repository.save(scene);

      const metaPath = join(tempDir, `${scene.scene.sceneId}.meta.json`);
      const { readFile } = await import('node:fs/promises');
      const metaRaw = await readFile(metaPath, 'utf8');
      expect(JSON.parse(metaRaw).sceneId).toBe('artifact-test');
    });
  });

  describe('partial family detection', () => {
    it('returns undefined when scene json is valid but meta is corrupted', async () => {
      const { repository } = await buildModule(tempDir);
      const scene = makeStoredScene('partial-meta');

      await repository.save(scene);

      await writeFile(
        join(tempDir, `${scene.scene.sceneId}.meta.json`),
        '{bad meta',
      );

      const result = await repository.findById(scene.scene.sceneId);
      expect(result).toBeDefined();
      expect(result?.scene.sceneId).toBe('partial-meta');
    });

    it('returns undefined when scene json is truncated', async () => {
      const { repository } = await buildModule(tempDir);
      const scene = makeStoredScene('truncated');

      await repository.save(scene);

      const scenePath = join(tempDir, `${scene.scene.sceneId}.json`);
      const { readFile } = await import('node:fs/promises');
      const raw = await readFile(scenePath, 'utf8');
      const truncated = raw.slice(0, Math.floor(raw.length / 2));
      await writeFile(scenePath, truncated);

      const result = await repository.findById(scene.scene.sceneId);
      expect(result).toBeUndefined();
    });
  });
});
