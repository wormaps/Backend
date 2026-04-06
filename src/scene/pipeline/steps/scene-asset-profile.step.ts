import { Injectable } from '@nestjs/common';
import { SceneAssetProfileService } from '../../services/scene-asset-profile.service';
import type { SceneDetail, SceneMeta, SceneScale } from '../../types/scene.types';

@Injectable()
export class SceneAssetProfileStep {
  constructor(
    private readonly sceneAssetProfileService: SceneAssetProfileService = new SceneAssetProfileService(),
  ) {}

  execute(
    meta: SceneMeta,
    detail: SceneDetail,
    scale: SceneScale,
  ): SceneMeta {
    const assetSelection = this.sceneAssetProfileService.buildSceneAssetSelection(
      meta,
      detail,
      scale,
    );
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
