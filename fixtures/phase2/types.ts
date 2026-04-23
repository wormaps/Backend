import type { QaIssueCode } from '../../packages/contracts/qa';
import type { SourceSnapshot } from '../../packages/contracts/source-snapshot';
import type { SceneRelationship } from '../../packages/contracts/twin-scene-graph';
import type { SceneScope } from '../../packages/contracts/twin-scene-graph';

export type Phase2FixtureKind = 'baseline' | 'adversarial';

export type ExpectedQaDistribution = Partial<Record<QaIssueCode, number>>;
export type ExpectedRelationshipDistribution = Partial<Record<SceneRelationship['relation'], number>>;

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
    realityTier: 'PLACEHOLDER_SCENE';
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
