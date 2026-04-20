import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { isFiniteCoordinate } from '../../../places/utils/geo.utils';
import { getSceneDataDir } from '../../storage/scene-storage.utils';
import type { StoredScene } from '../../types/scene.types';

export async function checkSceneReusability(storedScene: StoredScene): Promise<boolean> {
  if (storedScene.scene.status !== 'READY' || !storedScene.scene.assetUrl) {
    return false;
  }

  if (
    !storedScene.place ||
    !storedScene.meta ||
    !storedScene.detail ||
    !isFiniteCoordinate(storedScene.place.location) ||
    !isFiniteCoordinate(storedScene.meta.origin)
  ) {
    return false;
  }

  try {
    await access(join(getSceneDataDir(), `${storedScene.scene.sceneId}.glb`));
    await access(
      join(getSceneDataDir(), `${storedScene.scene.sceneId}.detail.json`),
    );
    return true;
  } catch {
    return false;
  }
}
