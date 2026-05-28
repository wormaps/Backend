import { describe, expect, it } from 'bun:test';

import { BuildGatewayService } from '../../src/api/build.gateway.service';
import type { SceneBuildRunResult } from '../../src/build/application/scene-build-run-result';

class MockOsmSceneBuildService {
  async run(): Promise<SceneBuildRunResult> {
    return {
      kind: 'completed',
      state: 'COMPLETED',
      build: { currentState: () => 'COMPLETED' } as never,
      normalizedEntityBundle: {} as never,
      evidenceGraph: {} as never,
      twinSceneGraph: {} as never,
      renderIntentSet: {} as never,
      meshPlan: {} as never,
      qaResult: {
        passed: true,
        issues: [],
        finalTier: 'PROCEDURAL_MODEL',
        finalTierReasonCodes: ['TEST'],
        intentAdjusted: false,
      },
      glbArtifact: {
        sceneId: 'scene-1',
        artifactRef: 'memory://scene-1.glb',
        byteLength: 10,
        artifactHash: 'sha256:test',
        bytes: new Uint8Array([1, 2, 3]),
        finalTier: 'PROCEDURAL_MODEL',
        qaSummary: {
          issueCount: 0,
          criticalCount: 0,
          majorCount: 0,
          minorCount: 0,
          infoCount: 0,
          warnActionCount: 0,
          recordActionCount: 0,
          failBuildCount: 0,
          downgradeTierCount: 0,
          stripDetailCount: 0,
          topCodes: [],
        },
        meshSummary: { nodeCount: 0, materialCount: 0, primitiveCounts: {} },
        gltfMetadata: {} as never,
      },
      manifest: {} as never,
    };
  }

}

describe('BuildGatewayService', () => {
  it('stores latest completed glb', async () => {
    const osm = new MockOsmSceneBuildService();
    const gateway = new BuildGatewayService(osm as never);

    const result = await gateway.build({
      sceneId: 'scene-1',
      lat: 37.5,
      lng: 127.0,
      radius: 150,
    });

    expect(result.kind).toBe('completed');
    expect(gateway.getLatestGlb()?.sceneId).toBe('scene-1');
  });
});
