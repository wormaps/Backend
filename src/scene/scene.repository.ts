import { Injectable } from '@nestjs/common';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { StoredScene } from './scene.types';

@Injectable()
export class SceneRepository {
  private readonly scenes = new Map<string, StoredScene>();
  private readonly requestIndex = new Map<string, string>();
  private readonly baseDir = join(process.cwd(), 'data', 'scenes');
  private readonly indexPath = join(this.baseDir, 'index.json');

  async save(scene: StoredScene, requestKey?: string): Promise<StoredScene> {
    await mkdir(this.baseDir, { recursive: true });
    this.scenes.set(scene.scene.sceneId, scene);
    if (requestKey) {
      this.requestIndex.set(requestKey, scene.scene.sceneId);
      await this.persistIndex();
    }
    await writeFile(
      this.buildScenePath(scene.scene.sceneId),
      JSON.stringify(scene, null, 2),
      'utf8',
    );

    return scene;
  }

  async findById(sceneId: string): Promise<StoredScene | undefined> {
    const cached = this.scenes.get(sceneId);
    if (cached) {
      return cached;
    }

    try {
      const raw = await readFile(this.buildScenePath(sceneId), 'utf8');
      const parsed = JSON.parse(raw) as StoredScene;
      this.scenes.set(sceneId, parsed);
      return parsed;
    } catch {
      return undefined;
    }
  }

  async findByRequestKey(requestKey: string): Promise<StoredScene | undefined> {
    const cachedSceneId = this.requestIndex.get(requestKey);
    if (cachedSceneId) {
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
      return this.findById(sceneId);
    } catch {
      return undefined;
    }
  }

  async clear(): Promise<void> {
    this.scenes.clear();
    this.requestIndex.clear();
    await rm(this.baseDir, { recursive: true, force: true });
  }

  private buildScenePath(sceneId: string): string {
    return join(this.baseDir, `${sceneId}.json`);
  }

  private async persistIndex(): Promise<void> {
    await writeFile(
      this.indexPath,
      JSON.stringify(Object.fromEntries(this.requestIndex), null, 2),
      'utf8',
    );
  }
}
