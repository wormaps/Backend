import { NodeIO } from '@gltf-transform/core';
import { validateBytes } from 'gltf-validator';

import type { MeshPlan } from '../../../../../shared/contracts';
import type { QaIssue } from '../../../../../shared/contracts';
import type { GlbArtifact } from '../../compiler/glb-compiler.service';
import { computeCanonicalGlbArtifactHash } from '../../artifact/glb-artifact-hash';
import { createQaIssue } from '../common/issue.factory';
import { describeError, describeValidatorFailure } from '../common/validation-utils';
import { validateDocumentStructure, validateTriangleBudget } from './document-structure.validator';

export async function validateArtifactBytes(artifact: GlbArtifact, meshPlan: MeshPlan): Promise<QaIssue[]> {
  const issues: QaIssue[] = [];

  try {
    const canonicalHash = await computeCanonicalGlbArtifactHash(artifact.bytes);
    if (canonicalHash !== artifact.artifactHash) {
      issues.push(createQaIssue('DCC_GLB_BINARY_HASH_MISMATCH', 'critical', 'fail_build', 'scene', `Canonical GLB hash ${canonicalHash} does not match the recorded artifact hash ${artifact.artifactHash}.`));
    }
  } catch (error) {
    issues.push(createQaIssue('DCC_GLB_VALIDATOR_ERROR', 'critical', 'fail_build', 'scene', `Failed to canonicalize emitted GLB bytes: ${describeError(error)}`));
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
      issues.push(createQaIssue('DCC_GLB_VALIDATOR_ERROR', 'critical', 'fail_build', 'scene', describeValidatorFailure(errorCount, report.issues?.numWarnings ?? 0, firstIssue), errorCount, 0));
    }
  } catch (error) {
    issues.push(createQaIssue('DCC_GLB_VALIDATOR_ERROR', 'critical', 'fail_build', 'scene', `glTF validator rejected emitted GLB: ${describeError(error)}`));
  }

  try {
    const io = new NodeIO();
    await io.init();
    const document = await io.readBinary(artifact.bytes);
    issues.push(...validateDocumentStructure(document));
    issues.push(...validateTriangleBudget(document, meshPlan));
  } catch (error) {
    issues.push(createQaIssue('DCC_GLB_VALIDATOR_ERROR', 'critical', 'fail_build', 'scene', `Failed to parse GLB document for DCC validation: ${describeError(error)}`));
  }

  return issues;
}
