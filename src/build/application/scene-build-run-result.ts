import type { EvidenceGraph } from '../../shared/contracts';
import type { SceneBuildManifest, SceneBuildState } from '../../shared/contracts';
import type { MeshPlan } from '../../shared/contracts';
import type { NormalizedEntityBundle } from '../../shared/contracts';
import type { QaIssue } from '../../shared/contracts';
import type { RenderIntentSet } from '../../shared/contracts';
import type { RealityTier, TwinSceneGraph } from '../../shared/contracts';
import type { GlbArtifact } from '../../pipeline/glb/application/glb-compiler.service';
import type { GlbValidationResult } from '../../pipeline/glb/application/glb-validation.service';
import type { Result } from '../../shared';
import type { SceneBuildAggregate } from '../domain/scene-build.aggregate';

export type SceneBuildQaResult = {
  passed: boolean;
  issues: QaIssue[];
  finalTier: RealityTier;
  finalTierReasonCodes: string[];
  intentAdjusted: boolean;
};

export type SceneBuildFailureResult = {
  kind: 'snapshot_failure';
  build: SceneBuildAggregate;
  state: Extract<SceneBuildState, 'SNAPSHOT_PARTIAL' | 'FAILED'>;
  collected: Result<unknown, 'SNAPSHOT_PARTIAL' | 'FAILED'>;
  qaResult: SceneBuildQaResult;
  manifest: SceneBuildManifest;
};

export type SceneBuildQuarantinedResult = {
  kind: 'quarantined';
  build: SceneBuildAggregate;
  state: 'QUARANTINED';
  normalizedEntityBundle: NormalizedEntityBundle;
  evidenceGraph: EvidenceGraph;
  twinSceneGraph: TwinSceneGraph;
  renderIntentSet: RenderIntentSet;
  meshPlan: MeshPlan;
  qaResult: SceneBuildQaResult;
  manifest: SceneBuildManifest;
};

export type SceneBuildCompletedResult = {
  kind: 'completed';
  build: SceneBuildAggregate;
  state: 'COMPLETED';
  normalizedEntityBundle: NormalizedEntityBundle;
  evidenceGraph: EvidenceGraph;
  twinSceneGraph: TwinSceneGraph;
  renderIntentSet: RenderIntentSet;
  meshPlan: MeshPlan;
  qaResult: SceneBuildQaResult;
  glbArtifact: GlbArtifact;
  manifest: SceneBuildManifest;
};

export type SceneBuildValidationFailureResult = {
  kind: 'glb_validation_failure';
  build: SceneBuildAggregate;
  state: 'FAILED';
  normalizedEntityBundle: NormalizedEntityBundle;
  evidenceGraph: EvidenceGraph;
  twinSceneGraph: TwinSceneGraph;
  renderIntentSet: RenderIntentSet;
  meshPlan: MeshPlan;
  qaResult: SceneBuildQaResult;
  glbArtifact: GlbArtifact;
  glbValidation: GlbValidationResult;
  manifest: SceneBuildManifest;
};

export type SceneBuildRunResult =
  | SceneBuildFailureResult
  | SceneBuildQuarantinedResult
  | SceneBuildValidationFailureResult
  | SceneBuildCompletedResult;
