import { defaultScope, snapshot } from './shared';
import type { Phase2Fixture } from './types';

const snapshotPartialArtifacts = {
  evidenceGraph: false,
  twinSceneGraph: false,
  renderIntentSet: false,
  meshPlan: false,
  qaReport: true,
  manifest: true,
} as const;

export const adversarialFixtures: Phase2Fixture[] = [
  {
    id: 'adversarial-partial-snapshot-failure',
    kind: 'adversarial',
    sceneId: 'adversarial-partial-snapshot-failure',
    buildId: 'build-adversarial-partial-snapshot-failure',
    snapshotBundleId: 'bundle-adversarial-partial-snapshot-failure',
    scope: defaultScope,
    snapshots: [
      snapshot('adversarial-partial-snapshot-failure', 'osm-partial-failure', 'osm'),
      snapshot('adversarial-partial-snapshot-failure', 'tomtom-failed', 'tomtom', 'failed'),
    ],
    expected: {
      finalState: 'SNAPSHOT_PARTIAL',
      qaIssueDistribution: {
        PROVIDER_SNAPSHOT_FAILED: 1,
      },
      realityTier: 'PLACEHOLDER_SCENE',
      artifacts: snapshotPartialArtifacts,
    },
  },
];
