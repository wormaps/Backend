import { SceneDetail, SceneMeta, SceneScale } from '../types/scene.types';
import { SceneAssetProfileService } from '../services/scene-asset-profile.service';
import { SceneAssetSelection } from '../services/scene-asset-profile.types';

const sceneAssetProfileService = new SceneAssetProfileService();

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
