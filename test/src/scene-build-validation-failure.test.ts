import { describe, expect, it } from 'bun:test';

import { baselineFixtures } from '../../fixtures/phase2';
import { BuildManifestFactory } from '../../src/build/application/build-manifest.factory';
import { SceneBuildOrchestratorService } from '../../src/build/application/scene-build-orchestrator.service';
import { glbModule } from '../../src/glb/glb.module';
import { GlbCompilerService } from '../../src/glb/application/glb-compiler.service';
import { GlbValidationService, type GlbValidationResult } from '../../src/glb/application/glb-validation.service';
import { normalizationModule } from '../../src/normalization/normalization.module';
import { providersModule } from '../../src/providers/providers.module';
import { qaModule } from '../../src/qa/qa.module';
import { realityModule } from '../../src/reality/reality.module';
import { renderModule } from '../../src/render/render.module';
import { twinModule } from '../../src/twin/twin.module';

class RejectingGlbValidationService extends GlbValidationService {
  override async validate(): Promise<GlbValidationResult> {
    return {
      passed: false,
      issues: [
        {
          code: 'REPLAY_MANIFEST_ARTIFACT_MISMATCH',
          severity: 'critical',
          scope: 'scene',
          message: 'forced validation failure',
          action: 'fail_build',
        },
      ],
    };
  }
}

describe('scene build validation failure', () => {
  it('fails the build when GLB validation rejects the artifact', async () => {
    const fixture = baselineFixtures[0];
    if (fixture === undefined) {
      throw new Error('Expected baseline fixtures to exist.');
    }

    const orchestrator = new SceneBuildOrchestratorService(
      providersModule.services.snapshotCollector,
      normalizationModule.services.normalizedEntityBuilder,
      twinModule.services.evidenceGraphBuilder,
      twinModule.services.twinGraphBuilder,
      renderModule.services.renderIntentResolver,
      renderModule.services.meshPlanBuilder,
      qaModule.services.qaGate,
      glbModule.services.glbCompiler,
      new RejectingGlbValidationService(),
      new BuildManifestFactory(),
    );

    const result = await orchestrator.run(fixture);

    expect(result.kind).toBe('glb_validation_failure');
    if (result.kind !== 'glb_validation_failure') {
      throw new Error('Expected GLB validation failure result.');
    }

    expect(result.state).toBe('FAILED');
    expect(result.glbValidation.passed).toBe(false);
    expect(result.glbValidation.issues[0]?.code).toBe('REPLAY_MANIFEST_ARTIFACT_MISMATCH');
  });
});
