import type { MeshPlan } from '../../../packages/contracts/mesh-plan';
import type { RenderIntentSet } from '../../../packages/contracts/render-intent';

export class MeshPlanBuilderService {
  build(intentSet: RenderIntentSet): MeshPlan {
    return {
      sceneId: intentSet.sceneId,
      renderPolicyVersion: intentSet.policyVersion,
      nodes: [],
      materials: [],
      budgets: {
        maxGlbBytes: 30_000_000,
        maxTriangleCount: 0,
        maxNodeCount: 0,
        maxMaterialCount: 0,
      },
    };
  }
}
