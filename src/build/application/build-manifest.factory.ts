import type { QaSummary, SceneBuildManifest, SceneBuildState } from '../../shared/contracts/manifest';
import type { MeshPlan } from '../../shared/contracts/mesh-plan';
import type { QaIssue } from '../../shared/contracts/qa';
import type { RenderIntentSet } from '../../shared/contracts/render-intent';
import type { SourceSnapshot } from '../../shared/contracts/source-snapshot';
import type { RealityTier } from '../../shared/contracts/twin-scene-graph';
import { SCHEMA_VERSION_SET_V1 } from '../../shared/core/schemas';
import type { GlbArtifact } from '../../glb/application/glb-compiler.service';

export type BuildManifestInput = {
  sceneId: string;
  buildId: string;
  state: SceneBuildState;
  scopeId: string;
  snapshotBundleId: string;
  snapshots: SourceSnapshot[];
  renderIntentSet?: RenderIntentSet;
  meshPlan?: MeshPlan;
  glbArtifact?: GlbArtifact;
  complianceIssues?: QaIssue[];
  finalTier: RealityTier;
  finalTierReasonCodes: string[];
  qaSummary: QaSummary;
  coordinateSystem?: SceneBuildManifest['coordinateSystem'];
};

export class BuildManifestFactory {
  create(input: BuildManifestInput): SceneBuildManifest {
    return {
      sceneId: input.sceneId,
      buildId: input.buildId,
      state: input.state,
      createdAt: new Date(0).toISOString(),
      scopeId: input.scopeId,
      snapshotBundleId: input.snapshotBundleId,
      schemaVersions: SCHEMA_VERSION_SET_V1,
      mapperVersion: 'mapper.v1',
      normalizationVersion: 'normalization.v1',
      identityVersion: 'identity.v1',
      renderPolicyVersion: input.renderIntentSet?.policyVersion ?? 'render-policy.v1',
      meshPolicyVersion: input.meshPlan?.renderPolicyVersion ?? 'mesh-policy.v1',
      qaVersion: 'qa.v1',
      glbCompilerVersion: 'glb-compiler.v1',
      packageVersions: {},
      inputHashes: Object.fromEntries(
        input.snapshots.map((snapshot) => [snapshot.id, snapshot.responseHash ?? snapshot.queryHash]),
      ),
      artifactHashes: input.glbArtifact
        ? {
            glb: input.glbArtifact.artifactHash,
          }
        : {},
      finalTier: input.finalTier,
      finalTierReasonCodes: input.finalTierReasonCodes,
      qaSummary: input.qaSummary,
      attribution: {
        required: input.snapshots.some((snapshot) => snapshot.compliance.attributionRequired),
        entries: input.snapshots
          .filter((snapshot) => snapshot.compliance.attributionRequired)
          .map((snapshot) => ({
            provider: snapshot.provider,
            label: snapshot.compliance.attributionText ?? snapshot.provider,
            url: snapshot.compliance.policyUrl,
          })),
      },
      complianceIssues: input.complianceIssues ?? [],
      coordinateSystem: input.coordinateSystem,
    };
  }
}
