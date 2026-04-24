import type { SceneBuildManifest, QaSummary } from '../../../packages/contracts/manifest';
import type { MaterialPlan, MeshPlan, MeshPlanNode } from '../../../packages/contracts/mesh-plan';
import type { QaIssue } from '../../../packages/contracts/qa';
import type { GlbArtifact } from './glb-compiler.service';

export type GlbValidationInput = {
  manifest: SceneBuildManifest;
  artifact: GlbArtifact;
  meshPlan: MeshPlan;
};

export type GlbValidationResult = {
  passed: boolean;
  issues: QaIssue[];
};

export class GlbValidationService {
  validate(input: GlbValidationInput): GlbValidationResult {
    const issues = [
      ...this.validateConsistency(input.manifest, input.artifact, input.meshPlan),
      ...this.validateMeshPlan(input.meshPlan),
    ];

    return {
      passed: !issues.some((issue) => issue.severity === 'critical' || issue.action === 'fail_build'),
      issues,
    };
  }

  private validateConsistency(
    manifest: SceneBuildManifest,
    artifact: GlbArtifact,
    meshPlan: MeshPlan,
  ): QaIssue[] {
    const issues: QaIssue[] = [];

    if (manifest.sceneId !== artifact.sceneId || manifest.sceneId !== meshPlan.sceneId) {
      issues.push(
        this.issue(
          'REPLAY_MANIFEST_ARTIFACT_MISMATCH',
          'critical',
          'fail_build',
          'scene',
          'Scene identity differs between manifest, artifact, and mesh plan.',
        ),
      );
    }

    if (manifest.finalTier !== artifact.finalTier) {
      issues.push(
        this.issue(
          'REPLAY_MANIFEST_ARTIFACT_MISMATCH',
          'critical',
          'fail_build',
          'scene',
          'Final tier differs between manifest and GLB artifact.',
        ),
      );
    }

    if (!this.sameQaSummary(manifest.qaSummary, artifact.qaSummary)) {
      issues.push(
        this.issue(
          'REPLAY_MANIFEST_ARTIFACT_MISMATCH',
          'critical',
          'fail_build',
          'scene',
          'QA summary differs between manifest and GLB artifact.',
        ),
      );
    }

    const manifestArtifactHash = manifest.artifactHashes['glb'];
    if (manifestArtifactHash !== artifact.artifactHash) {
      issues.push(
        this.issue(
          'REPLAY_MANIFEST_ARTIFACT_MISMATCH',
          'critical',
          'fail_build',
          'scene',
          'Manifest GLB hash does not match the artifact metadata.',
        ),
      );
    }

    if (manifest.renderPolicyVersion !== meshPlan.renderPolicyVersion) {
      issues.push(
        this.issue(
          'REPLAY_MANIFEST_ARTIFACT_MISMATCH',
          'critical',
          'fail_build',
          'scene',
          'Render policy version differs between manifest and mesh plan.',
        ),
      );
    }

    return issues;
  }

  private validateMeshPlan(meshPlan: MeshPlan): QaIssue[] {
    const issues: QaIssue[] = [];
    const nodeById = new Map<string, MeshPlanNode>();
    const materialById = new Map<string, MaterialPlan>(meshPlan.materials.map((material) => [material.id, material]));

    for (const node of meshPlan.nodes) {
      if (nodeById.has(node.id)) {
        issues.push(
          this.issue(
            'DCC_GLB_DUPLICATE_NODE_ID',
            'critical',
            'fail_build',
            'mesh',
            `Duplicate MeshPlan node id detected: ${node.id}`,
          ),
        );
      }

      nodeById.set(node.id, node);

      if (!this.isFinitePoint(node.pivot)) {
        issues.push(
          this.issue(
            'DCC_GLB_INVALID_PIVOT',
            'critical',
            'fail_build',
            'mesh',
            `MeshPlan node ${node.id} has a non-finite pivot.`,
          ),
        );
      }

      if (!materialById.has(node.materialId)) {
        issues.push(
          this.issue(
            'DCC_MATERIAL_MISSING',
            'critical',
            'fail_build',
            'material',
            `MeshPlan node ${node.id} references missing material ${node.materialId}.`,
          ),
        );
      }
    }

    for (const node of meshPlan.nodes) {
      if (node.parentId !== undefined && !nodeById.has(node.parentId)) {
        issues.push(
          this.issue(
            'DCC_GLB_ORPHAN_NODE',
            'critical',
            'fail_build',
            'mesh',
            `MeshPlan node ${node.id} references missing parent ${node.parentId}.`,
          ),
        );
      }
    }

    const visiting = new Set<string>();
    const visited = new Set<string>();

    const detectCycle = (nodeId: string): void => {
      if (visited.has(nodeId)) {
        return;
      }

      if (visiting.has(nodeId)) {
        issues.push(
          this.issue(
            'DCC_GLB_PARENT_CYCLE',
            'critical',
            'fail_build',
            'mesh',
            `MeshPlan hierarchy contains a cycle around ${nodeId}.`,
          ),
        );
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

  private sameQaSummary(left: QaSummary, right: QaSummary): boolean {
    return (
      left.issueCount === right.issueCount &&
      left.criticalCount === right.criticalCount &&
      left.majorCount === right.majorCount &&
      left.minorCount === right.minorCount &&
      left.infoCount === right.infoCount &&
      this.sameStringArray(left.topCodes, right.topCodes)
    );
  }

  private sameStringArray(left: string[], right: string[]): boolean {
    return left.length === right.length && left.every((value, index) => value === right[index]);
  }

  private isFinitePoint(point: MeshPlanNode['pivot']): boolean {
    return Number.isFinite(point.x) && Number.isFinite(point.y) && Number.isFinite(point.z);
  }

  private issue(
    code: QaIssue['code'],
    severity: QaIssue['severity'],
    action: QaIssue['action'],
    scope: QaIssue['scope'],
    message: string,
  ): QaIssue {
    return {
      code,
      severity,
      scope,
      message,
      action,
    };
  }
}
