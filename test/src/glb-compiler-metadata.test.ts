import { describe, expect, it } from 'bun:test';

import { GlbCompilerService } from '../../src/glb/application/glb-compiler.service';

describe('glb compiler metadata', () => {
  it('includes mesh and QA summaries in the artifact contract', async () => {
    const compiler = new GlbCompilerService();
    const artifact = await compiler.compile({
      buildId: 'build-glb',
      snapshotBundleId: 'bundle-glb',
      meshPlan: {
        sceneId: 'scene-glb',
        renderPolicyVersion: 'render-policy.v1',
        nodes: [
          {
            id: 'node:building-1',
            entityId: 'building-1',
            name: 'building:massing',
            primitive: 'building_massing',
            pivot: { x: 0, y: 0, z: 0 },
            materialId: 'material:building',
          },
          {
            id: 'node:poi-1',
            entityId: 'poi-1',
            name: 'poi:placeholder',
            primitive: 'poi_marker',
            pivot: { x: 1, y: 0, z: 1 },
            materialId: 'material:debug',
          },
        ],
        materials: [
          { id: 'material:building', name: 'building', role: 'building' },
          { id: 'material:debug', name: 'debug', role: 'debug' },
        ],
        budgets: {
          maxGlbBytes: 30_000_000,
          maxTriangleCount: 250_000,
          maxNodeCount: 1_500,
          maxMaterialCount: 32,
        },
      },
      finalTier: 'PROCEDURAL_MODEL',
      qaSummary: {
        issueCount: 1,
        criticalCount: 0,
        majorCount: 1,
        minorCount: 0,
        infoCount: 0,
        warnActionCount: 0,
        recordActionCount: 0,
        failBuildCount: 0,
        downgradeTierCount: 0,
        stripDetailCount: 0,
        topCodes: ['COMPLIANCE_PROVIDER_POLICY_RISK'],
      },
    });

    expect(artifact.sceneId).toBe('scene-glb');
    expect(artifact.finalTier).toBe('PROCEDURAL_MODEL');
    expect(artifact.qaSummary.issueCount).toBe(1);
    expect(artifact.artifactHash).toMatch(/^sha256:/);
    expect(artifact.gltfMetadata.extras.value.worMap.sceneId).toBe('scene-glb');
    expect(artifact.gltfMetadata.extras.value.worMap.artifactHash).toBe(artifact.artifactHash);
    expect(artifact.meshSummary).toEqual({
      nodeCount: 2,
      materialCount: 2,
      primitiveCounts: {
        building_massing: 1,
        poi_marker: 1,
      },
    });
    expect(artifact.byteLength).toBeGreaterThan(0);
  });
});
