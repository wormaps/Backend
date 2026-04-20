import { SceneDetail, SceneMeta, SceneScale } from '../types/scene.types';
import {
  SceneAssetProfileService,
  SceneAssetSelection,
  VisualArchetypeSelectionService,
  ContextProfileService,
  AssetMaterialClassService,
} from '../services/asset-profile';

const materialClassService = new AssetMaterialClassService();
const contextProfileService = new ContextProfileService(materialClassService);
const visualArchetypeService = new VisualArchetypeSelectionService();
const sceneAssetProfileService = new SceneAssetProfileService(
  visualArchetypeService,
  contextProfileService,
);

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
