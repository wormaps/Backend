import { Injectable } from '@nestjs/common';
import { mkdir, readFile, rm, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { StoredScene } from '../types/scene.types';
import { getSceneDataDir } from './scene-storage.utils';

@Injectable()
export class SceneRepository {
  private readonly scenes = new Map<string, StoredScene>();
  private readonly requestIndex = new Map<string, string>();
  private readonly baseDir = getSceneDataDir();
  private readonly indexPath = join(this.baseDir, 'index.json');
  private readonly maxInMemoryScenes = 256;
  private readonly maxRequestIndexEntries = 1024;

  async save(scene: StoredScene, requestKey?: string): Promise<StoredScene> {
    await mkdir(this.baseDir, { recursive: true });
    this.scenes.set(scene.scene.sceneId, scene);
    this.touchScene(scene.scene.sceneId);
    this.evictOldestSceneIfNeeded();

    if (requestKey) {
      this.requestIndex.set(requestKey, scene.scene.sceneId);
      this.touchRequestKey(requestKey);
      this.evictOldestRequestKeyIfNeeded();
      await this.persistIndex();
    }

    await writeFile(
      this.buildScenePath(scene.scene.sceneId),
      JSON.stringify(scene, null, 2),
      'utf8',
    );
    await this.persistArtifacts(scene);

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
      this.touchScene(sceneId);
      return cached;
    }

    try {
      const raw = await readFile(this.buildScenePath(sceneId), 'utf8');
      const parsed = JSON.parse(raw) as StoredScene;
      this.scenes.set(sceneId, parsed);
      this.touchScene(sceneId);
      this.evictOldestSceneIfNeeded();
      return parsed;
    } catch {
      return undefined;
    }
  }

  async findByRequestKey(requestKey: string): Promise<StoredScene | undefined> {
    const cachedSceneId = this.requestIndex.get(requestKey);
    if (cachedSceneId) {
      this.touchRequestKey(requestKey);
      return this.findById(cachedSceneId);
    }

    try {
      const raw = await readFile(this.indexPath, 'utf8');
      const parsed = JSON.parse(raw) as Record<string, string>;
      Object.entries(parsed).forEach(([key, sceneId]) => {
        this.requestIndex.set(key, sceneId);
      });
      const sceneId = parsed[requestKey];
      if (!sceneId) {
        return undefined;
      }
      this.touchRequestKey(requestKey);
      this.evictOldestRequestKeyIfNeeded();
      return this.findById(sceneId);
    } catch {
      return undefined;
    }
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
    await writeFile(
      this.indexPath,
      JSON.stringify(Object.fromEntries(this.requestIndex), null, 2),
      'utf8',
    );
  }

  private async persistArtifacts(scene: StoredScene): Promise<void> {
    if (scene.meta) {
      await writeFile(
        this.buildMetaPath(scene.scene.sceneId),
        JSON.stringify(scene.meta, null, 2),
        'utf8',
      );
    } else {
      await this.safeUnlink(this.buildMetaPath(scene.scene.sceneId));
    }

    if (scene.detail) {
      await writeFile(
        this.buildDetailPath(scene.scene.sceneId),
        JSON.stringify(scene.detail, null, 2),
        'utf8',
      );
    } else {
      await this.safeUnlink(this.buildDetailPath(scene.scene.sceneId));
    }

    if (scene.twin) {
      await writeFile(
        this.buildTwinPath(scene.scene.sceneId),
        JSON.stringify(scene.twin, null, 2),
        'utf8',
      );
    } else {
      await this.safeUnlink(this.buildTwinPath(scene.scene.sceneId));
    }

    if (scene.validation) {
      await writeFile(
        this.buildValidationPath(scene.scene.sceneId),
        JSON.stringify(scene.validation, null, 2),
        'utf8',
      );
    } else {
      await this.safeUnlink(this.buildValidationPath(scene.scene.sceneId));
    }

    if (scene.qa) {
      await writeFile(
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
      for (const [requestKey, sceneId] of this.requestIndex) {
        if (sceneId === oldestKey) {
          this.requestIndex.delete(requestKey);
        }
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
