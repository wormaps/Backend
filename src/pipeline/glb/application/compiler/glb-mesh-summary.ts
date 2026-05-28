import type { MeshPlan } from '../../../../shared/contracts';

export function summarizeMeshSummary(meshPlan: MeshPlan) {
  return {
    nodeCount: meshPlan.nodes.length,
    materialCount: meshPlan.materials.length,
    primitiveCounts: meshPlan.nodes.reduce<Record<string, number>>((distribution, node) => {
      distribution[node.primitive] = (distribution[node.primitive] ?? 0) + 1;
      return distribution;
    }, {}),
  };
}
