import { SceneDetail, SceneMeta, SceneScale } from '../types/scene.types';
import {
  SceneAssetProfileService,
  SceneAssetSelection,
} from '../services/asset-profile';

const sceneAssetProfileService = Object.create(
  SceneAssetProfileService.prototype,
) as SceneAssetProfileService;

export type { SceneAssetSelection };

export function buildSceneAssetSelection(
  sceneMeta: SceneMeta,
  sceneDetail: SceneDetail,
  scale: SceneScale,
): SceneAssetSelection {
  return sceneAssetProfileService.buildSceneAssetSelection(
    sceneMeta,
    sceneDetail,
    scale,
  );
}
