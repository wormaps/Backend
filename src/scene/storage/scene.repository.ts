import { Injectable } from '@nestjs/common';
import { mkdir, readFile, rm, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { ERROR_CODES } from '../../common/constants/error-codes';
import { AppException } from '../../common/errors/app.exception';
import { StoredScene } from '../types/scene.types';
import {
  getSceneDataDir,
  parseSceneJson,
  readSceneJsonFile,
  SceneCorruptionError,
  writeFileAtomically,
} from './scene-storage.utils';
import { assertSceneEntityIntegrity } from '../utils/scene-assertions.utils';
import { AppLoggerService } from '../../common/logging/app-logger.service';

@Injectable()
export class SceneRepository {
  private readonly scenes = new Map<string, StoredScene>();
  private readonly requestIndex = new Map<string, string>();
  private readonly baseDir = getSceneDataDir();
  private readonly indexPath = join(this.baseDir, 'index.json');
  private readonly maxInMemoryScenes = 256;
  private readonly maxRequestIndexEntries = 1024;

  constructor(private readonly appLoggerService: AppLoggerService) {}

  async save(scene: StoredScene, requestKey?: string): Promise<StoredScene> {
    await mkdir(this.baseDir, { recursive: true });

    await writeFileAtomically(
      this.buildScenePath(scene.scene.sceneId),
      JSON.stringify(scene, null, 2),
      'utf8',
    );
    await this.persistArtifacts(scene);

    this.scenes.set(scene.scene.sceneId, scene);
    this.touchScene(scene.scene.sceneId);
    this.evictOldestSceneIfNeeded();

    if (requestKey) {
      this.requestIndex.set(requestKey, scene.scene.sceneId);
      this.touchRequestKey(requestKey);
      this.evictOldestRequestKeyIfNeeded();
      await this.persistIndex();
    }

    return scene;
  }

  async update(
    sceneId: string,
    updater: (scene: StoredScene) => StoredScene,
  ): Promise<StoredScene | undefined> {
    const existing = await this.findById(sceneId);
    if (!existing) {
      return undefined;
    }

    const updated = updater(existing);
    return this.save(updated, updated.requestKey);
  }

  async findById(sceneId: string): Promise<StoredScene | undefined> {
    const cached = this.scenes.get(sceneId);
    if (cached) {
      const disk = await this.readSceneFromDisk(sceneId);
      if (disk === null) {
        this.scenes.delete(sceneId);
        this.removeRequestIndexEntriesForScene(sceneId);
        return undefined;
      }
      if (disk !== 'corrupted') {
        this.scenes.set(sceneId, disk);
        this.touchScene(sceneId);
        return disk;
      }
      this.scenes.delete(sceneId);
      this.removeRequestIndexEntriesForScene(sceneId);
      return undefined;
    }

    const disk = await this.readSceneFromDisk(sceneId);
    if (disk === null || disk === 'corrupted') {
      return undefined;
    }
    this.scenes.set(sceneId, disk);
    this.touchScene(sceneId);
    this.evictOldestSceneIfNeeded();
    return disk;
  }

  async findByRequestKey(requestKey: string): Promise<StoredScene | undefined> {
    const cachedSceneId = this.requestIndex.get(requestKey);
    if (cachedSceneId) {
      const diskSceneId = await this.readSceneIdFromIndex(requestKey);
      if (diskSceneId === null) {
        this.requestIndex.delete(requestKey);
        return undefined;
      }
      if (diskSceneId !== cachedSceneId) {
        this.requestIndex.delete(requestKey);
        this.scenes.delete(cachedSceneId);
        this.removeRequestIndexEntriesForScene(cachedSceneId);
      }
      this.touchRequestKey(requestKey);
      return this.findById(diskSceneId);
    }

    const diskSceneId = await this.readSceneIdFromIndex(requestKey);
    if (diskSceneId === null) {
      return undefined;
    }
    this.touchRequestKey(requestKey);
    this.evictOldestRequestKeyIfNeeded();
    return this.findById(diskSceneId);
  }

  async clear(): Promise<void> {
    this.scenes.clear();
    this.requestIndex.clear();
    try {
      await rm(this.baseDir, { recursive: true, force: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOTEMPTY') {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 0));
      await rm(this.baseDir, { recursive: true, force: true });
    }
  }

  private buildScenePath(sceneId: string): string {
    return join(this.baseDir, `${sceneId}.json`);
  }

  private buildMetaPath(sceneId: string): string {
    return join(this.baseDir, `${sceneId}.meta.json`);
  }

  private buildDetailPath(sceneId: string): string {
    return join(this.baseDir, `${sceneId}.detail.json`);
  }

  private buildTwinPath(sceneId: string): string {
    return join(this.baseDir, `${sceneId}.twin.json`);
  }

  private buildValidationPath(sceneId: string): string {
    return join(this.baseDir, `${sceneId}.validation.json`);
  }

  private buildQaPath(sceneId: string): string {
    return join(this.baseDir, `${sceneId}.qa.json`);
  }

  private async persistIndex(): Promise<void> {
    await writeFileAtomically(
      this.indexPath,
      JSON.stringify(Object.fromEntries(this.requestIndex), null, 2),
      'utf8',
    );
  }

  private async persistArtifacts(scene: StoredScene): Promise<void> {
    if (scene.meta) {
      await writeFileAtomically(
        this.buildMetaPath(scene.scene.sceneId),
        JSON.stringify(scene.meta, null, 2),
        'utf8',
      );
    } else {
      await this.safeUnlink(this.buildMetaPath(scene.scene.sceneId));
    }

    if (scene.detail) {
      await writeFileAtomically(
        this.buildDetailPath(scene.scene.sceneId),
        JSON.stringify(scene.detail, null, 2),
        'utf8',
      );
    } else {
      await this.safeUnlink(this.buildDetailPath(scene.scene.sceneId));
    }

    if (scene.twin) {
      await writeFileAtomically(
        this.buildTwinPath(scene.scene.sceneId),
        JSON.stringify(scene.twin, null, 2),
        'utf8',
      );
    } else {
      await this.safeUnlink(this.buildTwinPath(scene.scene.sceneId));
    }

    if (scene.validation) {
      await writeFileAtomically(
        this.buildValidationPath(scene.scene.sceneId),
        JSON.stringify(scene.validation, null, 2),
        'utf8',
      );
    } else {
      await this.safeUnlink(this.buildValidationPath(scene.scene.sceneId));
    }

    if (scene.qa) {
      await writeFileAtomically(
        this.buildQaPath(scene.scene.sceneId),
        JSON.stringify(scene.qa, null, 2),
        'utf8',
      );
    } else {
      await this.safeUnlink(this.buildQaPath(scene.scene.sceneId));
    }
  }

  private async safeUnlink(path: string): Promise<void> {
    try {
      await unlink(path);
    } catch {
      return;
    }
  }

  private async readSceneFromDisk(
    sceneId: string,
  ): Promise<StoredScene | 'corrupted' | null> {
    try {
      const raw = await readFile(this.buildScenePath(sceneId), 'utf8');
      const parsed = parseSceneJson<StoredScene>(raw, `scene ${sceneId}`);
      assertSceneEntityIntegrity(parsed.scene, sceneId);
      return parsed;
    } catch (err) {
      if (err instanceof SceneCorruptionError) {
        this.appLoggerService.warn('scene.repository.corrupted', {
          sceneId,
          kind: err.kind,
          message: err.message,
        });
        return 'corrupted';
      }
      if (err instanceof AppException && err.code === ERROR_CODES.SCENE_CORRUPT) {
        this.appLoggerService.warn('scene.repository.corrupted', {
          sceneId,
          kind: 'partial-family',
          message: err.message,
        });
        return 'corrupted';
      }
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      this.appLoggerService.warn('scene.repository.read-failed', {
        sceneId,
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }

  private async readSceneIdFromIndex(
    requestKey: string,
  ): Promise<string | null> {
    let parsed: Record<string, string> | null;
    try {
      parsed = await readSceneJsonFile<Record<string, string>>(
        this.indexPath,
        'index',
      );
    } catch (err) {
      if (err instanceof SceneCorruptionError) {
        this.appLoggerService.warn('scene.repository.index-corrupted', {
          kind: err.kind,
          message: err.message,
        });
        return null;
      }
      throw err;
    }
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }
    const sceneId = parsed[requestKey];
    if (!sceneId) {
      return null;
    }
    this.requestIndex.clear();
    Object.entries(parsed).forEach(([key, id]) => {
      this.requestIndex.set(key, id);
    });
    return sceneId;
  }

  private touchScene(sceneId: string): void {
    const entry = this.scenes.get(sceneId);
    if (entry != null) {
      this.scenes.delete(sceneId);
      this.scenes.set(sceneId, entry);
    }
  }

  private evictOldestSceneIfNeeded(): void {
    while (this.scenes.size > this.maxInMemoryScenes) {
      const oldestKey = this.scenes.keys().next().value;
      if (oldestKey == null) {
        break;
      }
      this.scenes.delete(oldestKey);
      this.removeRequestIndexEntriesForScene(oldestKey);
    }
  }

  private removeRequestIndexEntriesForScene(sceneId: string): void {
    for (const [requestKey, id] of this.requestIndex) {
      if (id === sceneId) {
        this.requestIndex.delete(requestKey);
      }
    }
  }

  private touchRequestKey(requestKey: string): void {
    const entry = this.requestIndex.get(requestKey);
    if (entry != null) {
      this.requestIndex.delete(requestKey);
      this.requestIndex.set(requestKey, entry);
    }
  }

  private evictOldestRequestKeyIfNeeded(): void {
    while (this.requestIndex.size > this.maxRequestIndexEntries) {
      const oldestKey = this.requestIndex.keys().next().value;
      if (oldestKey == null) {
        break;
      }
      this.requestIndex.delete(oldestKey);
    }
  }
}
