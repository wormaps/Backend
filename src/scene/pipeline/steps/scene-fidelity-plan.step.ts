import { Injectable } from '@nestjs/common';
import type { ExternalPlaceDetail } from '../../../places/types/external-place.types';
import type { PlacePackage } from '../../../places/types/place.types';
import { appendSceneDiagnosticsLog } from '../../storage/scene-storage.utils';
import { SceneFidelityPlannerService } from '../../services/planning';
import type { CuratedAssetPayload } from '../../services/planning';
import type {
  SceneDetail,
  SceneFidelityPlan,
  SceneScale,
} from '../../types/scene.types';

@Injectable()
export class SceneFidelityPlanStep {
  constructor(
    private readonly sceneFidelityPlannerService: SceneFidelityPlannerService,
  ) {}

  async execute(
    sceneId: string,
    place: ExternalPlaceDetail,
    scale: SceneScale,
    placePackage: PlacePackage,
    detail: SceneDetail,
    stage: 'fidelity_plan' | 'fidelity_plan_final' = 'fidelity_plan',
    curatedPayload?: CuratedAssetPayload,
  ): Promise<SceneFidelityPlan> {
    const plan = this.sceneFidelityPlannerService.buildPlan(
      place,
      scale,
      placePackage,
      detail,
      curatedPayload,
    );

    await appendSceneDiagnosticsLog(sceneId, stage, {
      currentMode: plan.currentMode,
      targetMode: plan.targetMode,
      targetCoverageRatio: plan.targetCoverageRatio,
      achievedCoverageRatio: plan.achievedCoverageRatio,
      coverageGapRatio: plan.coverageGapRatio,
      phase: plan.phase,
      coreRadiusM: plan.coreRadiusM,
      evidence: plan.evidence,
      sourceRegistry: plan.sourceRegistry,
      priorities: plan.priorities,
    });

    return plan;
  }
}
