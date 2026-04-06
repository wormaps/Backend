import { Injectable } from '@nestjs/common';
import type { ExternalPlaceDetail } from '../../../places/types/external-place.types';
import type { PlacePackage } from '../../../places/types/place.types';
import { appendSceneDiagnosticsLog } from '../../storage/scene-storage.utils';
import { SceneFidelityPlannerService } from '../../services/scene-fidelity-planner.service';
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
  ): Promise<SceneFidelityPlan> {
    const plan = this.sceneFidelityPlannerService.buildPlan(
      place,
      scale,
      placePackage,
      detail,
    );

    await appendSceneDiagnosticsLog(sceneId, 'fidelity_plan', {
      currentMode: plan.currentMode,
      targetMode: plan.targetMode,
      phase: plan.phase,
      coreRadiusM: plan.coreRadiusM,
      evidence: plan.evidence,
      sourceRegistry: plan.sourceRegistry,
      priorities: plan.priorities,
    });

    return plan;
  }
}
