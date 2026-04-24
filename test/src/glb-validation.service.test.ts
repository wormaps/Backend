import { describe, expect, it } from 'bun:test';

import { baselineFixtures } from '../../fixtures/phase2';
import { GlbValidationService } from '../../src/glb/application/glb-validation.service';
import { createWorMapMvpApp } from '../../src/main';

function buildCompletedBaseline() {
  const app = createWorMapMvpApp();
  const fixture = baselineFixtures[0];
  if (fixture === undefined) {
    throw new Error('Expected at least one baseline fixture.');
  }

  const result = app.services.sceneBuildOrchestrator.run(fixture);

  if (result.kind !== 'completed') {
    throw new Error('Expected the baseline fixture to complete successfully.');
  }

  return result;
}

describe('glb validation service', () => {
  it('accepts the current completed baseline build as internally consistent', () => {
    const result = buildCompletedBaseline();
    const validation = new GlbValidationService().validate({
      manifest: result.manifest,
      artifact: result.glbArtifact,
      meshPlan: result.meshPlan,
    });

    expect(validation.passed).toBe(true);
    expect(validation.issues).toEqual([]);
  });

  it('rejects manifest and artifact mismatches', () => {
    const result = buildCompletedBaseline();
    const validation = new GlbValidationService().validate({
      manifest: {
        ...result.manifest,
        artifactHashes: {
          ...result.manifest.artifactHashes,
          glb: 'sha256:wrong',
        },
      },
      artifact: result.glbArtifact,
      meshPlan: result.meshPlan,
    });

    expect(validation.passed).toBe(false);
    expect(validation.issues.map((issue) => issue.code)).toContain('REPLAY_MANIFEST_ARTIFACT_MISMATCH');
  });

  it('rejects broken DCC hierarchy and missing materials', () => {
    const result = buildCompletedBaseline();
    const validation = new GlbValidationService().validate({
      manifest: result.manifest,
      artifact: result.glbArtifact,
      meshPlan: {
        ...result.meshPlan,
        nodes: result.meshPlan.nodes.map((node, index) =>
          index === 0
            ? {
                ...node,
                parentId: 'missing-parent',
                materialId: 'material:missing',
                pivot: { x: Number.NaN, y: 0, z: 0 },
              }
            : node,
        ),
      },
    });

    expect(validation.passed).toBe(false);
    expect(validation.issues.map((issue) => issue.code)).toContain('DCC_GLB_ORPHAN_NODE');
    expect(validation.issues.map((issue) => issue.code)).toContain('DCC_GLB_INVALID_PIVOT');
    expect(validation.issues.map((issue) => issue.code)).toContain('DCC_MATERIAL_MISSING');
  });
});
