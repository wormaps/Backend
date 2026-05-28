import { describe, expect, it } from 'bun:test';

import { BuildGatewayService } from '../../src/api/build.gateway.service';
import { JobStoreService } from '../../src/api/job-store.service';
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

/** Minimal JobStoreService stub that keeps bytes in memory and skips disk I/O. */
class MockJobStore extends JobStoreService {
  private readonly _jobs = new Map<string, { status: string; bytes?: Uint8Array }>();

  override create(jobId: string, sceneId: string) {
    this._jobs.set(jobId, { status: 'queued' });
    return super.create(jobId, sceneId);
  }
  override markBuilding(jobId: string) { super.markBuilding(jobId); }
  override markCompleted(jobId: string, artifact: Parameters<JobStoreService['markCompleted']>[1]) {
    super.markCompleted(jobId, artifact);
    this._jobs.set(jobId, { status: 'completed', bytes: artifact.bytes });
  }
  override readDiskCache(_sceneId: string): Promise<Uint8Array | null> { return Promise.resolve(null); }
}

describe('BuildGatewayService', () => {
  it('enqueues a build and eventually stores latest glb', async () => {
    const osm = new MockOsmSceneBuildService();
    const jobStore = new MockJobStore();
    const gateway = new BuildGatewayService(osm as never, jobStore);

    const jobId = gateway.enqueueBuild({ sceneId: 'scene-1', lat: 37.5, lng: 127.0, radius: 150 });

    expect(typeof jobId).toBe('string');
    expect(jobId).toContain('scene-1');

    // Wait for background job to complete (setImmediate fires after this tick).
    await new Promise<void>((resolve) => setTimeout(resolve, 50));

    expect(gateway.getLatestGlb()?.sceneId).toBe('scene-1');
  });
});
