import { defaultScope, snapshot } from './shared';
import type { Phase2Fixture } from './types';

const completedArtifacts = {
  evidenceGraph: true,
  twinSceneGraph: true,
  renderIntentSet: true,
  meshPlan: true,
  qaReport: true,
  manifest: true,
} as const;

export const baselineFixtures: Phase2Fixture[] = [
  {
    id: 'baseline-clean-core-block',
    kind: 'baseline',
    sceneId: 'baseline-clean-core-block',
    buildId: 'build-baseline-clean-core-block',
    snapshotBundleId: 'bundle-baseline-clean-core-block',
    scope: defaultScope,
    snapshots: [
      snapshot('baseline-clean-core-block', 'osm-clean-core', 'osm'),
      snapshot('baseline-clean-core-block', 'weather-clean-core', 'open_meteo'),
    ],
    expected: {
      finalState: 'COMPLETED',
      qaIssueDistribution: {},
      realityTier: 'PLACEHOLDER_SCENE',
      artifacts: completedArtifacts,
    },
  },
  {
    id: 'baseline-basic-road-scene',
    kind: 'baseline',
    sceneId: 'baseline-basic-road-scene',
    buildId: 'build-baseline-basic-road-scene',
    snapshotBundleId: 'bundle-baseline-basic-road-scene',
    scope: defaultScope,
    snapshots: [
      snapshot('baseline-basic-road-scene', 'osm-basic-road', 'osm'),
      snapshot('baseline-basic-road-scene', 'traffic-basic-road', 'tomtom'),
    ],
    expected: {
      finalState: 'COMPLETED',
      qaIssueDistribution: {},
      realityTier: 'PLACEHOLDER_SCENE',
      artifacts: completedArtifacts,
    },
  },
  {
    id: 'baseline-basic-terrain-scene',
    kind: 'baseline',
    sceneId: 'baseline-basic-terrain-scene',
    buildId: 'build-baseline-basic-terrain-scene',
    snapshotBundleId: 'bundle-baseline-basic-terrain-scene',
    scope: defaultScope,
    snapshots: [snapshot('baseline-basic-terrain-scene', 'osm-basic-terrain', 'osm')],
    expected: {
      finalState: 'COMPLETED',
      qaIssueDistribution: {},
      realityTier: 'PLACEHOLDER_SCENE',
      artifacts: completedArtifacts,
    },
  },
];
