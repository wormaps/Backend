import { Injectable } from '@nestjs/common';
import { AppLoggerService } from '../../../common/logging/app-logger.service';
import { appendSceneDiagnosticsLog } from '../../storage/scene-storage.utils';
import { SceneAssetProfileService } from '../../services/asset-profile';
import type { SceneAssetSelection } from '../../services/asset-profile';
import type {
  SceneDetail,
  SceneMeta,
  SceneScale,
} from '../../types/scene.types';

export interface SceneAssetProfileStepResult {
  meta: SceneMeta;
  assetSelection: SceneAssetSelection;
}

interface SkipCauseReport {
  trafficLights: { source: number; selected: number; reason: string };
  streetLights: { source: number; selected: number; reason: string };
  signPoles: { source: number; selected: number; reason: string };
  vegetation: { source: number; selected: number; reason: string };
  crossings: { source: number; selected: number; reason: string };
  walkways: { source: number; selected: number; reason: string };
}

@Injectable()
export class SceneAssetProfileStep {
  constructor(
    private readonly sceneAssetProfileService: SceneAssetProfileService,
    private readonly appLoggerService: AppLoggerService,
  ) {}

  private resolveSkipCauses(
    meta: SceneMeta,
    detail: SceneDetail,
    selection: SceneAssetSelection,
  ): SkipCauseReport {
    const resolve = (
      sourceCount: number,
      selectedCount: number,
      label: string,
    ): { source: number; selected: number; reason: string } => {
      if (sourceCount === 0) {
        return { source: 0, selected: 0, reason: 'missing_source' };
      }
      if (selectedCount === 0) {
        return {
          source: sourceCount,
          selected: 0,
          reason: 'budget_exceeded',
        };
      }
      if (selectedCount < sourceCount) {
        return {
          source: sourceCount,
          selected: selectedCount,
          reason: 'lod_filtered',
        };
      }
      return {
        source: sourceCount,
        selected: selectedCount,
        reason: 'fully_selected',
      };
    };

    const streetFurniture = detail.streetFurniture ?? [];
    return {
      trafficLights: resolve(
        streetFurniture.filter((f) => f.type === 'TRAFFIC_LIGHT').length,
        selection.trafficLights.length,
        'trafficLights',
      ),
      streetLights: resolve(
        streetFurniture.filter((f) => f.type === 'STREET_LIGHT').length,
        selection.streetLights.length,
        'streetLights',
      ),
      signPoles: resolve(
        streetFurniture.filter((f) => f.type === 'SIGN_POLE').length,
        selection.signPoles.length,
        'signPoles',
      ),
      vegetation: resolve(
        detail.vegetation?.length ?? 0,
        selection.vegetation.length,
        'vegetation',
      ),
      crossings: resolve(
        detail.crossings.length,
        selection.crossings.length,
        'crossings',
      ),
      walkways: resolve(
        meta.walkways.length,
        selection.walkways.length,
        'walkways',
      ),
    };
  }

  async execute(
    meta: SceneMeta,
    detail: SceneDetail,
    scale: SceneScale,
  ): Promise<SceneAssetProfileStepResult> {
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
    const skipCauses = this.resolveSkipCauses(meta, detail, assetSelection);
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
      skipCauses,
    };
    this.appLoggerService.info('scene.asset_profile.diagnostics', {
      sceneId: meta.sceneId,
      step: 'asset_profile',
      ...payload,
    });
    try {
      await appendSceneDiagnosticsLog(meta.sceneId, 'asset_profile', payload);
    } catch (error) {
      this.appLoggerService.warn('scene.diagnostics.log-failed', {
        sceneId: meta.sceneId,
        step: 'asset_profile',
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return {
      meta: updatedMeta,
      assetSelection,
    };
  }
}
