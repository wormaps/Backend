import type { MaterialPlan, MeshPlan, MeshPlanNode } from '../../../../../shared/contracts';
import type { QaIssue } from '../../../../../shared/contracts';

import { createQaIssue } from '../common/issue.factory';
import { isFinitePoint } from '../common/validation-utils';

export function validateMeshPlan(meshPlan: MeshPlan): QaIssue[] {
  const issues: QaIssue[] = [];
  const nodeById = new Map<string, MeshPlanNode>();
  const materialById = new Map<string, MaterialPlan>(meshPlan.materials.map((material) => [material.id, material]));

  for (const node of meshPlan.nodes) {
    if (nodeById.has(node.id)) {
      issues.push(createQaIssue('DCC_GLB_DUPLICATE_NODE_ID', 'critical', 'fail_build', 'mesh', `Duplicate MeshPlan node id detected: ${node.id}`));
    }
    nodeById.set(node.id, node);

    if (!isFinitePoint(node.pivot)) {
      issues.push(createQaIssue('DCC_GLB_INVALID_PIVOT', 'critical', 'fail_build', 'mesh', `MeshPlan node ${node.id} has a non-finite pivot.`));
    }

    if (!materialById.has(node.materialId)) {
      issues.push(createQaIssue('DCC_MATERIAL_MISSING', 'critical', 'fail_build', 'material', `MeshPlan node ${node.id} references missing material ${node.materialId}.`));
    }
  }

  if (meshPlan.nodes.length > meshPlan.budgets.maxNodeCount) {
    issues.push(createQaIssue('DCC_GLB_NODE_COUNT_EXCEEDED', 'critical', 'fail_build', 'mesh', `MeshPlan node count ${meshPlan.nodes.length} exceeds budget ${meshPlan.budgets.maxNodeCount}.`, meshPlan.nodes.length, meshPlan.budgets.maxNodeCount));
  }
  if (meshPlan.materials.length > meshPlan.budgets.maxMaterialCount) {
    issues.push(createQaIssue('DCC_GLB_MATERIAL_COUNT_EXCEEDED', 'critical', 'fail_build', 'material', `MeshPlan material count ${meshPlan.materials.length} exceeds budget ${meshPlan.budgets.maxMaterialCount}.`, meshPlan.materials.length, meshPlan.budgets.maxMaterialCount));
  }

  for (const node of meshPlan.nodes) {
    if (node.parentId !== undefined && !nodeById.has(node.parentId)) {
      issues.push(createQaIssue('DCC_GLB_ORPHAN_NODE', 'critical', 'fail_build', 'mesh', `MeshPlan node ${node.id} references missing parent ${node.parentId}.`));
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const detectCycle = (nodeId: string): void => {
    if (visited.has(nodeId)) return;
    if (visiting.has(nodeId)) {
      issues.push(createQaIssue('DCC_GLB_PARENT_CYCLE', 'critical', 'fail_build', 'mesh', `MeshPlan hierarchy contains a cycle around ${nodeId}.`));
      return;
    }

    const node = nodeById.get(nodeId);
    if (node === undefined || node.parentId === undefined) {
      visited.add(nodeId);
      return;
    }

    visiting.add(nodeId);
    detectCycle(node.parentId);
    visiting.delete(nodeId);
    visited.add(nodeId);
  };

  for (const node of meshPlan.nodes) {
    detectCycle(node.id);
  }

  return issues;
}
