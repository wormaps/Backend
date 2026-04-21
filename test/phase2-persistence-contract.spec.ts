import { mkdir, rm, writeFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { Test, TestingModule } from '@nestjs/testing';
import { AppLoggerService } from '../src/common/logging/app-logger.service';
import { SceneRepository } from '../src/scene/storage/scene.repository';
import {
  parseSceneJson,
  readSceneJsonFile,
  SceneCorruptionError,
} from '../src/scene/storage/scene-storage.utils';

const TEST_SCENE_ID = 'scene-test-corrupt';
const TEST_DATA_DIR = join(process.cwd(), 'data', 'scene', '.spec-temp-phase2');

describe('Phase 2 persistence contract', () => {
  let repository: SceneRepository;
  let module: TestingModule;

  beforeEach(async () => {
    await rm(TEST_DATA_DIR, { recursive: true, force: true });
    await mkdir(TEST_DATA_DIR, { recursive: true });
    process.env.SCENE_DATA_DIR = TEST_DATA_DIR;

    module = await Test.createTestingModule({
      providers: [
        SceneRepository,
        {
          provide: AppLoggerService,
          useValue: {
            info: () => {},
            warn: () => {},
            error: () => {},
            fromRequest: () => ({
              info: () => {},
              warn: () => {},
              error: () => {},
            }),
          },
        },
      ],
    }).compile();

    repository = module.get(SceneRepository);
    await repository.clear();
    await mkdir(TEST_DATA_DIR, { recursive: true });
  });

  afterEach(async () => {
    await rm(TEST_DATA_DIR, { recursive: true, force: true });
    delete process.env.SCENE_DATA_DIR;
  });

  describe('SceneCorruptionError classification', () => {
    it('classifies empty content as empty-file', () => {
      expect(() => parseSceneJson('', 'test')).toThrow(SceneCorruptionError);
      try {
        parseSceneJson('', 'test');
      } catch (err) {
        expect((err as SceneCorruptionError).kind).toBe('empty-file');
      }
    });

    it('classifies whitespace-only content as empty-file', () => {
      try {
        parseSceneJson('   \n  ', 'test');
      } catch (err) {
        expect((err as SceneCorruptionError).kind).toBe('empty-file');
      }
    });

    it('classifies malformed JSON as parse-failure', () => {
      try {
        parseSceneJson('{ "key": ', 'test');
      } catch (err) {
        expect((err as SceneCorruptionError).kind).toBe('parse-failure');
      }
    });

    it('includes label in parse-failure message', () => {
      try {
        parseSceneJson('bad', 'scene-abc123');
      } catch (err) {
        expect((err as SceneCorruptionError).message).toContain('scene-abc123');
      }
    });
  });

  describe('readSceneJsonFile graceful degradation', () => {
    it('returns null for missing file', async () => {
      const result = await readSceneJsonFile<Record<string, string>>(
        join(TEST_DATA_DIR, 'nonexistent.json'),
        'missing',
      );
      expect(result).toBeNull();
    });

    it('throws SceneCorruptionError for empty file', async () => {
      const path = join(TEST_DATA_DIR, 'empty.json');
      await writeFile(path, '', 'utf8');
      try {
        await readSceneJsonFile(path, 'empty');
        throw new Error('Expected SceneCorruptionError');
      } catch (err) {
        expect(err).toBeInstanceOf(SceneCorruptionError);
      }
    });

    it('throws SceneCorruptionError for malformed JSON', async () => {
      const path = join(TEST_DATA_DIR, 'bad.json');
      await writeFile(path, '{ broken', 'utf8');
      try {
        await readSceneJsonFile(path, 'bad');
        throw new Error('Expected SceneCorruptionError');
      } catch (err) {
        expect(err).toBeInstanceOf(SceneCorruptionError);
        expect((err as SceneCorruptionError).kind).toBe('parse-failure');
      }
    });
  });

  describe('repository findById with corrupted scene files', () => {
    it('returns undefined for malformed JSON scene file', async () => {
      const scenePath = join(TEST_DATA_DIR, `${TEST_SCENE_ID}.json`);
      await writeFile(scenePath, '{ "scene": {', 'utf8');

      const result = await repository.findById(TEST_SCENE_ID);

      expect(result).toBeUndefined();
    });

    it('returns undefined for empty scene file', async () => {
      const scenePath = join(TEST_DATA_DIR, `${TEST_SCENE_ID}.json`);
      await writeFile(scenePath, '', 'utf8');

      const result = await repository.findById(TEST_SCENE_ID);

      expect(result).toBeUndefined();
    });

    it('returns undefined for non-JSON text', async () => {
      const scenePath = join(TEST_DATA_DIR, `${TEST_SCENE_ID}.json`);
      await writeFile(scenePath, 'not json', 'utf8');

      const result = await repository.findById(TEST_SCENE_ID);

      expect(result).toBeUndefined();
    });
  });

  describe('repository findByRequestKey with corrupt index', () => {
    it('returns undefined when index.json contains malformed JSON', async () => {
      const indexPath = join(TEST_DATA_DIR, 'index.json');
      await writeFile(indexPath, '{ broken ', 'utf8');

      const result = await repository.findByRequestKey('test:unknown:MEDIUM');

      expect(result).toBeUndefined();
    });

    it('returns undefined when index.json is empty', async () => {
      const indexPath = join(TEST_DATA_DIR, 'index.json');
      await writeFile(indexPath, '', 'utf8');

      const result = await repository.findByRequestKey('test:unknown:MEDIUM');

      expect(result).toBeUndefined();
    });

    it('does not throw when index.json contains non-object JSON', async () => {
      const indexPath = join(TEST_DATA_DIR, 'index.json');
      await writeFile(indexPath, '"string"', 'utf8');

      const result = await repository.findByRequestKey('test:unknown:MEDIUM');

      expect(result).toBeUndefined();
    });

    it('does not throw when index.json is an array', async () => {
      const indexPath = join(TEST_DATA_DIR, 'index.json');
      await writeFile(indexPath, '["a"]', 'utf8');

      const result = await repository.findByRequestKey('test:unknown:MEDIUM');

      expect(result).toBeUndefined();
    });
  });

  describe('explicit corruption handling — no auto-repair', () => {
    it('does not modify corrupted scene file across multiple reads', async () => {
      const scenePath = join(TEST_DATA_DIR, `${TEST_SCENE_ID}.json`);
      const corruptContent = '{ partial ';
      await writeFile(scenePath, corruptContent, 'utf8');

      for (let i = 0; i < 3; i += 1) {
        const result = await repository.findById(TEST_SCENE_ID);
        expect(result).toBeUndefined();
      }

      const finalContent = await Bun.file(scenePath).text();
      expect(finalContent).toBe(corruptContent);
    });

    it('does not delete corrupted scene file on read', async () => {
      const scenePath = join(TEST_DATA_DIR, `${TEST_SCENE_ID}.json`);
      await writeFile(scenePath, '{ bad }', 'utf8');

      await repository.findById(TEST_SCENE_ID);

      const exists = await stat(scenePath).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });

    it('does not rebuild or repair corrupt index.json', async () => {
      const indexPath = join(TEST_DATA_DIR, 'index.json');
      const corruptIndex = '{ bad ';
      await writeFile(indexPath, corruptIndex, 'utf8');

      await repository.findByRequestKey('test:any:MEDIUM');

      const content = await Bun.file(indexPath).text();
      expect(content).toBe(corruptIndex);
    });

    it('rejects structurally incomplete scene entity (missing required fields)', async () => {
      const scenePath = join(TEST_DATA_DIR, `${TEST_SCENE_ID}.json`);
      await writeFile(scenePath, '{"scene":{"sceneId":"x"}}', 'utf8');

      const result = await repository.findById(TEST_SCENE_ID);

      expect(result).toBeUndefined();
    });
  });
});
