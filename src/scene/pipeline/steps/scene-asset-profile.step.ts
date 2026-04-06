import { Injectable } from '@nestjs/common';
import { AppLoggerService } from '../../../common/logging/app-logger.service';
import { appendSceneDiagnosticsLog } from '../../storage/scene-storage.utils';
import { SceneAssetProfileService } from '../../services/asset-profile';
import type {
  SceneDetail,
  SceneMeta,
  SceneScale,
} from '../../types/scene.types';

@Injectable()
export class SceneAssetProfileStep {
  constructor(
    private readonly sceneAssetProfileService: SceneAssetProfileService = new SceneAssetProfileService(),
    private readonly appLoggerService: AppLoggerService = new AppLoggerService(),
  ) {}

  async execute(
    meta: SceneMeta,
    detail: SceneDetail,
    scale: SceneScale,
  ): Promise<SceneMeta> {
    const assetSelection =
      this.sceneAssetProfileService.buildSceneAssetSelection(
        meta,
        detail,
        scale,
      );
    const updatedMeta = {
      ...meta,
      assetProfile: {
        preset: scale,
        budget: assetSelection.budget,
        selected: assetSelection.selected,
      },
      structuralCoverage: assetSelection.structuralCoverage,
    };
    const payload = {
      preset: scale,
      selected: assetSelection.selected,
      budget: assetSelection.budget,
      structuralCoverage: assetSelection.structuralCoverage,
      sourceCounts: {
        buildings: meta.buildings.length,
        roads: meta.roads.length,
        walkways: meta.walkways.length,
        crossings: detail.crossings.length,
        signageClusters: detail.signageClusters.length,
      },
    };
    this.appLoggerService.info('scene.asset_profile.diagnostics', {
      sceneId: meta.sceneId,
      step: 'asset_profile',
      ...payload,
    });
    void appendSceneDiagnosticsLog(meta.sceneId, 'asset_profile', payload);
    return updatedMeta;
  }
}
