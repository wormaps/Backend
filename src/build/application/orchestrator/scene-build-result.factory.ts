import type { GlbArtifact, GlbValidationResult } from '../../../pipeline/glb/application';
import type {
  EvidenceGraph,
  MeshPlan,
  NormalizedEntityBundle,
  RenderIntentSet,
  SceneBuildManifest,
  SceneBuildState,
  TwinSceneGraph,
} from '../../../shared/contracts';
import type { Result } from '../../../shared';
import type { SceneBuildAggregate } from '../../domain';
import type {
  SceneBuildCompletedResult,
  SceneBuildFailureResult,
  SceneBuildQaResult,
  SceneBuildQuarantinedResult,
  SceneBuildValidationFailureResult,
} from '../scene-build-run-result';

export function toSceneBuildQaResult(qaResult: {
  passed: boolean;
  issues: SceneBuildQaResult['issues'];
  finalTier: SceneBuildQaResult['finalTier'];
  finalTierReasonCodes: string[];
  intentAdjusted: boolean;
}): SceneBuildQaResult {
  return {
    passed: qaResult.passed,
    issues: qaResult.issues,
    finalTier: qaResult.finalTier,
    finalTierReasonCodes: qaResult.finalTierReasonCodes,
    intentAdjusted: qaResult.intentAdjusted,
  };
}

export function createSnapshotFailureResult(input: {
  build: SceneBuildAggregate;
  state: Extract<SceneBuildState, 'SNAPSHOT_PARTIAL' | 'FAILED'>;
  collected: Result<unknown, 'SNAPSHOT_PARTIAL' | 'FAILED'>;
  qaResult: SceneBuildQaResult;
  manifest: SceneBuildManifest;
}): SceneBuildFailureResult {
  return {
    kind: 'snapshot_failure',
    build: input.build,
    state: input.state,
    collected: input.collected,
    qaResult: input.qaResult,
    manifest: input.manifest,
  };
}

export function createQuarantinedResult(input: {
  build: SceneBuildAggregate;
  normalizedEntityBundle: NormalizedEntityBundle;
  evidenceGraph: EvidenceGraph;
  twinSceneGraph: TwinSceneGraph;
  renderIntentSet: RenderIntentSet;
  meshPlan: MeshPlan;
  qaResult: SceneBuildQaResult;
  manifest: SceneBuildManifest;
}): SceneBuildQuarantinedResult {
  return {
    kind: 'quarantined',
    build: input.build,
    state: 'QUARANTINED',
    normalizedEntityBundle: input.normalizedEntityBundle,
    evidenceGraph: input.evidenceGraph,
    twinSceneGraph: input.twinSceneGraph,
    renderIntentSet: input.renderIntentSet,
    meshPlan: input.meshPlan,
    qaResult: input.qaResult,
    manifest: input.manifest,
  };
}

export function createGlbValidationFailureResult(input: {
  build: SceneBuildAggregate;
  normalizedEntityBundle: NormalizedEntityBundle;
  evidenceGraph: EvidenceGraph;
  twinSceneGraph: TwinSceneGraph;
  renderIntentSet: RenderIntentSet;
  meshPlan: MeshPlan;
  qaResult: SceneBuildQaResult;
  glbArtifact: GlbArtifact;
  glbValidation: GlbValidationResult;
  manifest: SceneBuildManifest;
}): SceneBuildValidationFailureResult {
  return {
    kind: 'glb_validation_failure',
    build: input.build,
    state: 'FAILED',
    normalizedEntityBundle: input.normalizedEntityBundle,
    evidenceGraph: input.evidenceGraph,
    twinSceneGraph: input.twinSceneGraph,
    renderIntentSet: input.renderIntentSet,
    meshPlan: input.meshPlan,
    qaResult: input.qaResult,
    glbArtifact: input.glbArtifact,
    glbValidation: input.glbValidation,
    manifest: input.manifest,
  };
}

export function createCompletedResult(input: {
  build: SceneBuildAggregate;
  normalizedEntityBundle: NormalizedEntityBundle;
  evidenceGraph: EvidenceGraph;
  twinSceneGraph: TwinSceneGraph;
  renderIntentSet: RenderIntentSet;
  meshPlan: MeshPlan;
  qaResult: SceneBuildQaResult;
  glbArtifact: GlbArtifact;
  manifest: SceneBuildManifest;
}): SceneBuildCompletedResult {
  return {
    kind: 'completed',
    build: input.build,
    state: 'COMPLETED',
    normalizedEntityBundle: input.normalizedEntityBundle,
    evidenceGraph: input.evidenceGraph,
    twinSceneGraph: input.twinSceneGraph,
    renderIntentSet: input.renderIntentSet,
    meshPlan: input.meshPlan,
    qaResult: input.qaResult,
    glbArtifact: input.glbArtifact,
    manifest: input.manifest,
  };
}
