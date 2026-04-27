import type { SceneBuildManifest, QaSummary } from '../../../packages/contracts/manifest';
import type { MaterialPlan, MeshPlan, MeshPlanNode } from '../../../packages/contracts/mesh-plan';
import type { QaIssue } from '../../../packages/contracts/qa';
import type { GlbArtifact } from './glb-compiler.service';
import { Document, NodeIO } from '@gltf-transform/core';
import { createHash } from 'node:crypto';
import { validateBytes } from 'gltf-validator';

import { computeCanonicalGlbArtifactHash } from './glb-artifact-hash';

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
  async validate(input: GlbValidationInput): Promise<GlbValidationResult> {
    const issues = [
      ...this.validateConsistency(input.manifest, input.artifact, input.meshPlan),
      ...this.validateMeshPlan(input.meshPlan),
      ...(await this.validateArtifactBytes(input.artifact)),
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

    const worMap = artifact.gltfMetadata.extras.value.worMap;

    if (worMap.sceneId !== manifest.sceneId || worMap.buildId !== manifest.buildId) {
      issues.push(
        this.issue(
          'REPLAY_MANIFEST_ARTIFACT_MISMATCH',
          'critical',
          'fail_build',
          'scene',
          'glTF extras identity does not match the manifest.',
        ),
      );
    }

    if (worMap.snapshotBundleId !== manifest.snapshotBundleId) {
      issues.push(
        this.issue(
          'REPLAY_MANIFEST_ARTIFACT_MISMATCH',
          'critical',
          'fail_build',
          'scene',
          'glTF extras snapshot bundle does not match the manifest.',
        ),
      );
    }

    if (worMap.artifactHash !== artifact.artifactHash) {
      issues.push(
        this.issue(
          'REPLAY_MANIFEST_ARTIFACT_MISMATCH',
          'critical',
          'fail_build',
          'scene',
          'glTF extras artifact hash does not match the GLB artifact hash.',
        ),
      );
    }

    if (worMap.validationStamp !== this.hashJson({ ...worMap, validationStamp: undefined })) {
      issues.push(
        this.issue(
          'REPLAY_MANIFEST_ARTIFACT_MISMATCH',
          'critical',
          'fail_build',
          'scene',
          'glTF extras validation stamp is invalid.',
        ),
      );
    }

    if (artifact.gltfMetadata.extras.jsonHash !== this.hashJson(artifact.gltfMetadata.extras.value)) {
      issues.push(
        this.issue(
          'REPLAY_MANIFEST_ARTIFACT_MISMATCH',
          'critical',
          'fail_build',
          'scene',
          'glTF extras round-trip hash is invalid.',
        ),
      );
    }

    if (artifact.gltfMetadata.sidecar !== undefined) {
      const sidecar = artifact.gltfMetadata.sidecar.value.worMap;

      if (sidecar.extrasValidationStamp !== worMap.validationStamp) {
        issues.push(
          this.issue(
            'REPLAY_MANIFEST_ARTIFACT_MISMATCH',
            'critical',
            'fail_build',
            'scene',
            'Sidecar does not reference the extras validation stamp.',
          ),
        );
      }

      if (sidecar.validationStamp !== this.hashJson({ ...sidecar, validationStamp: undefined })) {
        issues.push(
          this.issue(
            'REPLAY_MANIFEST_ARTIFACT_MISMATCH',
            'critical',
            'fail_build',
            'scene',
            'Sidecar validation stamp is invalid.',
          ),
        );
      }
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

  private validateTransformFinite(document: Document): QaIssue[] {
    const issues: QaIssue[] = [];
    const root = document.getRoot();

    for (const node of root.listNodes()) {
      const translation = node.getTranslation();
      const rotation = node.getRotation();
      const scale = node.getScale();

      for (let i = 0; i < 3; i++) {
        if (!Number.isFinite(translation[i])) {
          issues.push(this.issue('DCC_GLB_INVALID_TRANSFORM', 'critical', 'fail_build', 'mesh', `Node "${node.getName()}" has non-finite translation[${i}]: ${translation[i]}.`));
        }
        if (!Number.isFinite(scale[i])) {
          issues.push(this.issue('DCC_GLB_INVALID_TRANSFORM', 'critical', 'fail_build', 'mesh', `Node "${node.getName()}" has non-finite scale[${i}]: ${scale[i]}.`));
        }
      }

      for (let i = 0; i < 4; i++) {
        if (!Number.isFinite(rotation[i])) {
          issues.push(this.issue('DCC_GLB_INVALID_TRANSFORM', 'critical', 'fail_build', 'mesh', `Node "${node.getName()}" has non-finite rotation[${i}]: ${rotation[i]}.`));
        }
      }
    }

    return issues;
  }

  private validateBoundsSanity(document: Document): QaIssue[] {
    const issues: QaIssue[] = [];
    const MAX_SCENE_EXTENT_METERS = 5000;
    const root = document.getRoot();
    const globalMin: number[] = [Infinity, Infinity, Infinity];
    const globalMax: number[] = [-Infinity, -Infinity, -Infinity];

    for (const mesh of root.listMeshes()) {
      for (const primitive of mesh.listPrimitives()) {
        const position = primitive.getAttribute('POSITION');
        if (position === null) continue;

        const min = position.getMin([]);
        const max = position.getMax([]);
        if (min === undefined || max === undefined) continue;

        for (let i = 0; i < 3; i++) {
          const minVal = min[i] ?? 0;
          const maxVal = max[i] ?? 0;
          if (minVal < globalMin[i]!) globalMin[i] = minVal;
          if (maxVal > globalMax[i]!) globalMax[i] = maxVal;
        }
      }
    }

    for (let i = 0; i < 3; i++) {
      if (!Number.isFinite(globalMin[i]) || !Number.isFinite(globalMax[i])) {
        issues.push(this.issue('DCC_GLB_BOUNDS_INVALID', 'critical', 'fail_build', 'mesh', `Scene bounds contain non-finite values at axis ${i}: min=${globalMin[i]}, max=${globalMax[i]}.`));
        return issues;
      }
    }

    // Allow 0 extent on individual axes (flat mesh is valid).
    // Only flag if ALL axes have 0 extent (degenerate point).
    const minExtent = Math.min(...globalMin.map((_, i) => globalMax[i]! - globalMin[i]!));
    const maxExtent = Math.max(...globalMax.map((_, i) => globalMax[i]! - globalMin[i]!));

    if (maxExtent <= 0) {
      issues.push(this.issue('DCC_GLB_BOUNDS_INVALID', 'critical', 'fail_build', 'mesh', `Scene bounding box is degenerate (all axes have zero extent).`));
      return issues;
    }

    if (!Number.isFinite(minExtent) || !Number.isFinite(maxExtent)) {
      issues.push(this.issue('DCC_GLB_BOUNDS_INVALID', 'critical', 'fail_build', 'mesh', `Scene bounding box has non-finite extent: min=${minExtent}, max=${maxExtent}.`));
      return issues;
    }

    if (maxExtent >= MAX_SCENE_EXTENT_METERS) {
      issues.push(this.issue('DCC_GLB_BOUNDS_INVALID', 'critical', 'fail_build', 'mesh', `Scene bounding box max extent ${maxExtent}m exceeds limit of ${MAX_SCENE_EXTENT_METERS}m.`));
    }

    return issues;
  }

  private validatePrimitivePolicy(document: Document): QaIssue[] {
    const issues: QaIssue[] = [];
    const root = document.getRoot();

    for (const mesh of root.listMeshes()) {
      for (const primitive of mesh.listPrimitives()) {
        if (primitive.getMode() !== 4) {
          issues.push(this.issue('DCC_GLB_PRIMITIVE_POLICY_VIOLATION', 'major', 'warn_only', 'mesh', `Primitive "${primitive.getName()}" uses mode ${primitive.getMode()}, expected TRIANGLES (4).`));
        }

        const position = primitive.getAttribute('POSITION');
        if (position === null) {
          issues.push(this.issue('DCC_GLB_PRIMITIVE_POLICY_VIOLATION', 'major', 'warn_only', 'mesh', `Primitive "${primitive.getName()}" has no POSITION accessor.`));
        } else if (position.getCount() < 3) {
          issues.push(this.issue('DCC_GLB_PRIMITIVE_POLICY_VIOLATION', 'major', 'warn_only', 'mesh', `Primitive "${primitive.getName()}" has only ${position.getCount()} vertices, minimum is 3.`));
        }

        if (primitive.getMaterial() === null) {
          issues.push(this.issue('DCC_GLB_PRIMITIVE_POLICY_VIOLATION', 'major', 'warn_only', 'mesh', `Primitive "${primitive.getName()}" has no material.`));
        }
      }
    }

    return issues;
  }

  private validateAccessorMinMax(document: Document): QaIssue[] {
    const issues: QaIssue[] = [];
    const root = document.getRoot();

    for (const mesh of root.listMeshes()) {
      for (const primitive of mesh.listPrimitives()) {
        const position = primitive.getAttribute('POSITION');
        if (position === null) continue;

        const min = position.getMin([]);
        const max = position.getMax([]);

        if (min === undefined || max === undefined) {
          issues.push(
            this.issue(
              'DCC_GLB_ACCESSOR_MINMAX_INVALID',
              'critical',
              'fail_build',
              'mesh',
              `POSITION accessor for primitive "${primitive.getName()}" is missing min/max bounds.`,
            ),
          );
        } else {
          for (let i = 0; i < 3; i++) {
            const minVal = min[i];
            const maxVal = max[i];
            if (minVal !== undefined && maxVal !== undefined && minVal > maxVal) {
              issues.push(
                this.issue(
                  'DCC_GLB_ACCESSOR_MINMAX_INVALID',
                  'critical',
                  'fail_build',
                  'mesh',
                  `POSITION accessor for primitive "${primitive.getName()}" has min[${i}] (${minVal}) > max[${i}] (${maxVal}).`,
                ),
              );
            }
          }

          const count = position.getCount();
          const sampleSize = Math.min(count, 100);
          const step = Math.max(1, Math.floor(count / sampleSize));

          for (let i = 0; i < count; i += step) {
            const element = position.getElement(i, []);
            for (let j = 0; j < 3; j++) {
              const val = element[j];
              if (val === undefined || !Number.isFinite(val)) continue;
              const minVal = min[j];
              const maxVal = max[j];
              if (minVal !== undefined && val < minVal) {
                issues.push(
                  this.issue(
                    'DCC_GLB_ACCESSOR_MINMAX_INVALID',
                    'critical',
                    'fail_build',
                    'mesh',
                    `POSITION vertex ${i} of primitive "${primitive.getName()}" has value ${val} below min[${j}] (${minVal}).`,
                  ),
                );
                break;
              }
              if (maxVal !== undefined && val > maxVal) {
                issues.push(
                  this.issue(
                    'DCC_GLB_ACCESSOR_MINMAX_INVALID',
                    'critical',
                    'fail_build',
                    'mesh',
                    `POSITION vertex ${i} of primitive "${primitive.getName()}" has value ${val} above max[${j}] (${maxVal}).`,
                  ),
                );
                break;
              }
            }
          }
        }

        const indices = primitive.getIndices();
        if (indices !== null) {
          const indexMin = indices.getMin([]);
          if (indexMin === undefined) {
            issues.push(
              this.issue(
                'DCC_GLB_ACCESSOR_MINMAX_INVALID',
                'critical',
                'fail_build',
                'mesh',
                `INDICES accessor for primitive "${primitive.getName()}" is missing min bounds.`,
              ),
            );
          } else if (indexMin[0] !== undefined && indexMin[0] < 0) {
            issues.push(
              this.issue(
                'DCC_GLB_ACCESSOR_MINMAX_INVALID',
                'critical',
                'fail_build',
                'mesh',
                `INDICES accessor for primitive "${primitive.getName()}" has negative min value (${indexMin[0]}).`,
              ),
            );
          }
        }
      }
    }

    return issues;
  }

  private validateIndexBufferRanges(document: Document): QaIssue[] {
    const issues: QaIssue[] = [];
    const root = document.getRoot();

    for (const mesh of root.listMeshes()) {
      for (const primitive of mesh.listPrimitives()) {
        const indices = primitive.getIndices();
        const position = primitive.getAttribute('POSITION');

        if (indices === null || position === null) continue;

        const vertexCount = position.getCount();
        const indexMax = indices.getMax([]);

        if (indexMax === undefined) continue;

        const maxIndex = indexMax[0];
        if (maxIndex !== undefined && maxIndex >= vertexCount) {
          issues.push(
            this.issue(
              'DCC_GLB_INDEX_OUT_OF_RANGE',
              'critical',
              'fail_build',
              'mesh',
              `Index buffer max value (${maxIndex}) exceeds vertex count (${vertexCount}) for primitive "${primitive.getName()}".`,
            ),
          );
        }
      }
    }

    return issues;
  }

  private async validateArtifactBytes(artifact: GlbArtifact): Promise<QaIssue[]> {
    const issues: QaIssue[] = [];

    try {
      const canonicalHash = await computeCanonicalGlbArtifactHash(artifact.bytes);
      if (canonicalHash !== artifact.artifactHash) {
        issues.push(
          this.issue(
            'DCC_GLB_BINARY_HASH_MISMATCH',
            'critical',
            'fail_build',
            'scene',
            `Canonical GLB hash ${canonicalHash} does not match the recorded artifact hash ${artifact.artifactHash}.`,
          ),
        );
      }
    } catch (error) {
      issues.push(
        this.issue(
          'DCC_GLB_VALIDATOR_ERROR',
          'critical',
          'fail_build',
          'scene',
          `Failed to canonicalize emitted GLB bytes: ${this.describeError(error)}`,
        ),
      );
      return issues;
    }

    try {
      const report = await validateBytes(artifact.bytes, {
        uri: artifact.artifactRef,
        format: 'glb',
        maxIssues: 0,
        writeTimestamp: false,
      });

      const errorCount = report.issues?.numErrors ?? 0;
      if (errorCount > 0) {
        const firstIssue = report.issues?.messages?.[0];
        issues.push(
          this.issue(
            'DCC_GLB_VALIDATOR_ERROR',
            'critical',
            'fail_build',
            'scene',
            this.describeValidatorFailure(errorCount, report.issues?.numWarnings ?? 0, firstIssue),
            errorCount,
            0,
          ),
        );
      }
    } catch (error) {
      issues.push(
        this.issue(
          'DCC_GLB_VALIDATOR_ERROR',
          'critical',
          'fail_build',
          'scene',
          `glTF validator rejected emitted GLB: ${this.describeError(error)}`,
        ),
      );
    }

    try {
      const io = new NodeIO();
      await io.init();
      const document = await io.readBinary(artifact.bytes);

      issues.push(...this.validateTransformFinite(document));
      issues.push(...this.validateBoundsSanity(document));
      issues.push(...this.validatePrimitivePolicy(document));
      issues.push(...this.validateAccessorMinMax(document));
      issues.push(...this.validateIndexBufferRanges(document));
    } catch (error) {
      issues.push(
        this.issue(
          'DCC_GLB_VALIDATOR_ERROR',
          'critical',
          'fail_build',
          'scene',
          `Failed to parse GLB document for DCC validation: ${this.describeError(error)}`,
        ),
      );
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
      left.failBuildCount === right.failBuildCount &&
      left.downgradeTierCount === right.downgradeTierCount &&
      left.stripDetailCount === right.stripDetailCount &&
      this.sameStringArray(left.topCodes, right.topCodes)
    );
  }

  private sameStringArray(left: string[], right: string[]): boolean {
    return left.length === right.length && left.every((value, index) => value === right[index]);
  }

  private hashJson(value: unknown): string {
    return `sha256:${createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;
  }

  private describeValidatorFailure(
    errorCount: number,
    warningCount: number,
    firstIssue: { code?: string; message?: string } | undefined,
  ): string {
    const suffix = firstIssue === undefined ? 'No validator issue details were returned.' : `${firstIssue.code ?? 'UNKNOWN'}: ${firstIssue.message ?? 'No message.'}`;
    return `glTF validator reported ${errorCount} error(s) and ${warningCount} warning(s). ${suffix}`;
  }

  private describeError(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
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
    metric?: number,
    threshold?: number,
  ): QaIssue {
    return {
      code,
      severity,
      scope,
      message,
      action,
      ...(metric !== undefined ? { metric } : {}),
      ...(threshold !== undefined ? { threshold } : {}),
    };
  }
}
