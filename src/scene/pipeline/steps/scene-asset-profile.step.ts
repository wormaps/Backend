import { Injectable } from '@nestjs/common';
import { buildSceneAssetSelection } from '../../utils/scene-asset-profile.utils';
import type { SceneDetail, SceneMeta, SceneScale } from '../../types/scene.types';

@Injectable()
export class SceneAssetProfileStep {
  execute(
    meta: SceneMeta,
    detail: SceneDetail,
    scale: SceneScale,
  ): SceneMeta {
    const assetSelection = buildSceneAssetSelection(meta, detail, scale);
    return {
      ...meta,
      assetProfile: {
        preset: scale,
        budget: assetSelection.budget,
        selected: assetSelection.selected,
      },
    };
  }
}
