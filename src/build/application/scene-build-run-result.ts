import type { EvidenceGraph } from '../../../packages/contracts/evidence-graph';
import type { SceneBuildManifest, SceneBuildState } from '../../../packages/contracts/manifest';
import type { MeshPlan } from '../../../packages/contracts/mesh-plan';
import type { NormalizedEntityBundle } from '../../../packages/contracts/normalized-entity';
import type { QaIssue } from '../../../packages/contracts/qa';
import type { RenderIntentSet } from '../../../packages/contracts/render-intent';
import type { RealityTier, TwinSceneGraph } from '../../../packages/contracts/twin-scene-graph';
import type { GlbArtifact } from '../../glb/application/glb-compiler.service';
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

export type SceneBuildRunResult =
  | SceneBuildFailureResult
  | SceneBuildQuarantinedResult
  | SceneBuildCompletedResult;
