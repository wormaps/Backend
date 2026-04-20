import { Injectable } from '@nestjs/common';
import {
  SceneDetail,
  SceneEvidenceProfile,
  SceneMeta,
} from '../../types/scene.types';
import { buildEvidenceProfile } from './asset-evidence-profile.utils';
import { AssetMaterialClassService } from './asset-material-class.service';
import type { SceneAssetSelection } from './scene-asset-profile.types';

export interface ContextProfileResult {
  evidenceProfile?: SceneEvidenceProfile;
  structuralCoverage: SceneMeta['structuralCoverage'];
}

@Injectable()
export class ContextProfileService {
  constructor(
    private readonly materialClassService: AssetMaterialClassService,
  ) {}

  buildContextProfile(
    sceneMeta: SceneMeta,
    selection: Pick<SceneAssetSelection, 'buildings' | 'budget'>,
    sceneDetail?: SceneDetail,
  ): ContextProfileResult {
    const evidenceProfile = sceneDetail
      ? buildEvidenceProfile(sceneDetail)
      : undefined;
    const structuralCoverage = this.materialClassService.buildStructuralCoverage(
      sceneMeta,
      selection.buildings,
      this.resolveCoreRadiusMeters(selection.budget),
    );

    return {
      evidenceProfile,
      structuralCoverage,
    };
  }

  buildSceneMetaWithAssetSelection(
    sceneMeta: SceneMeta,
    selection: Pick<
      SceneAssetSelection,
      'budget' | 'selected' | 'structuralCoverage'
    >,
    sceneDetail?: SceneDetail,
  ): SceneMeta {
    const evidenceProfile = sceneDetail
      ? buildEvidenceProfile(sceneDetail)
      : undefined;
    return {
      ...sceneMeta,
      assetProfile: {
        ...sceneMeta.assetProfile,
        budget: selection.budget,
        selected: selection.selected,
        ...(evidenceProfile ? { evidenceProfile } : {}),
      },
      structuralCoverage: selection.structuralCoverage,
    };
  }

  buildEvidenceProfile(sceneDetail: SceneDetail): SceneEvidenceProfile {
    return buildEvidenceProfile(sceneDetail);
  }

  composeSelection(
    buildings: SceneAssetSelection['buildings'],
    roads: SceneAssetSelection['roads'],
    walkways: SceneAssetSelection['walkways'],
    pois: SceneAssetSelection['pois'],
    crossings: SceneAssetSelection['crossings'],
    trafficLights: SceneAssetSelection['trafficLights'],
    streetLights: SceneAssetSelection['streetLights'],
    signPoles: SceneAssetSelection['signPoles'],
    vegetation: SceneAssetSelection['vegetation'],
    billboardPanels: SceneAssetSelection['billboardPanels'],
    budget: SceneAssetSelection['budget'],
    structuralCoverage: SceneMeta['structuralCoverage'],
  ): SceneAssetSelection {
    return {
      buildings, roads, walkways, pois, crossings, trafficLights, streetLights, signPoles, vegetation, billboardPanels, budget,
      selected: {
        buildingCount: buildings.length, roadCount: roads.length, walkwayCount: walkways.length,
        poiCount: pois.length, crossingCount: crossings.length, trafficLightCount: trafficLights.length,
        streetLightCount: streetLights.length, signPoleCount: signPoles.length,
        treeClusterCount: vegetation.length, billboardPanelCount: billboardPanels.length,
      },
      structuralCoverage,
    };
  }

  private resolveCoreRadiusMeters(
    budget: SceneMeta['assetProfile']['budget'],
  ): number {
    const isSmallScale = budget.buildingCount < 760;
    return isSmallScale ? 150 : 230;
  }
}
