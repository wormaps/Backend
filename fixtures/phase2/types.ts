import type { QaIssueCode } from '../../packages/contracts/qa';
import type { RenderIntent } from '../../packages/contracts/render-intent';
import type { SourceSnapshot } from '../../packages/contracts/source-snapshot';
import type { MaterialPlan, MeshPlanNode } from '../../packages/contracts/mesh-plan';
import type { RealityTier, SceneRelationship, SceneScope } from '../../packages/contracts/twin-scene-graph';

export type Phase2FixtureKind = 'baseline' | 'adversarial';

export type ExpectedQaDistribution = Partial<Record<QaIssueCode, number>>;
export type ExpectedRelationshipDistribution = Partial<Record<SceneRelationship['relation'], number>>;
export type ExpectedVisualModeDistribution = Partial<Record<RenderIntent['visualMode'], number>>;
export type ExpectedMeshPrimitiveDistribution = Partial<Record<MeshPlanNode['primitive'], number>>;
export type ExpectedMaterialRoleDistribution = Partial<Record<MaterialPlan['role'], number>>;

export type Phase2Fixture = {
  id: string;
  kind: Phase2FixtureKind;
  sceneId: string;
  buildId: string;
  snapshotBundleId: string;
  scope: SceneScope;
  snapshots: SourceSnapshot[];
  expected: {
    finalState: 'COMPLETED' | 'SNAPSHOT_PARTIAL' | 'QUARANTINED' | 'FAILED';
    qaIssueDistribution: ExpectedQaDistribution;
    relationshipDistribution: ExpectedRelationshipDistribution;
    visualModeDistribution?: ExpectedVisualModeDistribution;
    meshPrimitiveDistribution?: ExpectedMeshPrimitiveDistribution;
    materialRoleDistribution?: ExpectedMaterialRoleDistribution;
    initialRealityTier?: RealityTier;
    provisionalRealityTier?: RealityTier;
    finalRealityTier?: RealityTier;
    artifacts: {
      evidenceGraph: boolean;
      twinSceneGraph: boolean;
      renderIntentSet: boolean;
      meshPlan: boolean;
      qaReport: boolean;
      manifest: boolean;
    };
  };
};
