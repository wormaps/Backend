import type { MeshPlan } from '../../../packages/contracts/mesh-plan';
import type { QaIssue } from '../../../packages/contracts/qa';
import type { RenderIntentSet } from '../../../packages/contracts/render-intent';
import type { TwinSceneGraph } from '../../../packages/contracts/twin-scene-graph';

export type QaGateInput = {
  graph: TwinSceneGraph;
  intentSet: RenderIntentSet;
  meshPlan: MeshPlan;
};

export type QaGateResult = {
  passed: boolean;
  issues: QaIssue[];
};

export class QaGateService {
  evaluate(input: QaGateInput): QaGateResult {
    const issues = [
      ...input.graph.metadata.qualityIssues,
      ...input.meshPlan.nodes.flatMap((node) =>
        !input.meshPlan.materials.some((material) => material.id === node.materialId)
          ? [
              {
                code: 'DCC_MATERIAL_MISSING',
                severity: 'critical',
                scope: 'mesh',
                message: `MeshPlan node ${node.id} references missing material ${node.materialId}.`,
                action: 'fail_build',
              } satisfies QaIssue,
            ]
          : [],
      ),
    ];

    return {
      passed: issues.every((issue) => issue.severity !== 'critical'),
      issues,
    };
  }
}
