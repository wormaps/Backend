import type { SceneBuildManifest, MeshPlan } from '../../../../../shared/contracts';
import type { QaIssue } from '../../../../../shared/contracts';
import type { GlbArtifact } from '../../compiler/glb-compiler.service';
import { createQaIssue } from '../common/issue.factory';
import { hashJson, sameQaSummary } from '../common/validation-utils';

export function validateConsistency(
  manifest: SceneBuildManifest,
  artifact: GlbArtifact,
  meshPlan: MeshPlan,
): QaIssue[] {
  const issues: QaIssue[] = [];

  if (manifest.sceneId !== artifact.sceneId || manifest.sceneId !== meshPlan.sceneId) {
    issues.push(createQaIssue('REPLAY_MANIFEST_ARTIFACT_MISMATCH', 'critical', 'fail_build', 'scene', 'Scene identity differs between manifest, artifact, and mesh plan.'));
  }
  if (manifest.finalTier !== artifact.finalTier) {
    issues.push(createQaIssue('REPLAY_MANIFEST_ARTIFACT_MISMATCH', 'critical', 'fail_build', 'scene', 'Final tier differs between manifest and GLB artifact.'));
  }
  if (!sameQaSummary(manifest.qaSummary, artifact.qaSummary)) {
    issues.push(createQaIssue('REPLAY_MANIFEST_ARTIFACT_MISMATCH', 'critical', 'fail_build', 'scene', 'QA summary differs between manifest and GLB artifact.'));
  }

  const manifestArtifactHash = manifest.artifactHashes.glb;
  if (manifestArtifactHash !== artifact.artifactHash) {
    issues.push(createQaIssue('REPLAY_MANIFEST_ARTIFACT_MISMATCH', 'critical', 'fail_build', 'scene', 'Manifest GLB hash does not match the artifact metadata.'));
  }

  if (manifest.renderPolicyVersion !== meshPlan.renderPolicyVersion) {
    issues.push(createQaIssue('REPLAY_MANIFEST_ARTIFACT_MISMATCH', 'critical', 'fail_build', 'scene', 'Render policy version differs between manifest and mesh plan.'));
  }

  if (artifact.byteLength > meshPlan.budgets.maxGlbBytes) {
    issues.push(createQaIssue('DCC_GLB_BYTE_SIZE_EXCEEDED', 'critical', 'fail_build', 'mesh', `GLB byte size ${artifact.byteLength} exceeds budget ${meshPlan.budgets.maxGlbBytes}.`, artifact.byteLength, meshPlan.budgets.maxGlbBytes));
  }

  const worMap = artifact.gltfMetadata.extras.value.worMap;
  if (worMap.sceneId !== manifest.sceneId || worMap.buildId !== manifest.buildId) {
    issues.push(createQaIssue('REPLAY_MANIFEST_ARTIFACT_MISMATCH', 'critical', 'fail_build', 'scene', 'glTF extras identity does not match the manifest.'));
  }
  if (worMap.snapshotBundleId !== manifest.snapshotBundleId) {
    issues.push(createQaIssue('REPLAY_MANIFEST_ARTIFACT_MISMATCH', 'critical', 'fail_build', 'scene', 'glTF extras snapshot bundle does not match the manifest.'));
  }
  if (worMap.artifactHash !== artifact.artifactHash) {
    issues.push(createQaIssue('REPLAY_MANIFEST_ARTIFACT_MISMATCH', 'critical', 'fail_build', 'scene', 'glTF extras artifact hash does not match the GLB artifact hash.'));
  }
  if (worMap.validationStamp !== hashJson({ ...worMap, validationStamp: undefined })) {
    issues.push(createQaIssue('REPLAY_MANIFEST_ARTIFACT_MISMATCH', 'critical', 'fail_build', 'scene', 'glTF extras validation stamp is invalid.'));
  }

  if (artifact.gltfMetadata.extras.jsonHash !== hashJson(artifact.gltfMetadata.extras.value)) {
    issues.push(createQaIssue('REPLAY_MANIFEST_ARTIFACT_MISMATCH', 'critical', 'fail_build', 'scene', 'glTF extras round-trip hash is invalid.'));
  }

  if (artifact.gltfMetadata.sidecar !== undefined) {
    const sidecar = artifact.gltfMetadata.sidecar.value.worMap;
    if (sidecar.extrasValidationStamp !== worMap.validationStamp) {
      issues.push(createQaIssue('REPLAY_MANIFEST_ARTIFACT_MISMATCH', 'critical', 'fail_build', 'scene', 'Sidecar does not reference the extras validation stamp.'));
    }
    if (sidecar.validationStamp !== hashJson({ ...sidecar, validationStamp: undefined })) {
      issues.push(createQaIssue('REPLAY_MANIFEST_ARTIFACT_MISMATCH', 'critical', 'fail_build', 'scene', 'Sidecar validation stamp is invalid.'));
    }
  }

  return issues;
}
