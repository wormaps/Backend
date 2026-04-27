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
      snapshot('baseline-clean-core-block', 'osm-clean-core', 'osm', 'success', 'fixture://clean-core-block'),
      snapshot('baseline-clean-core-block', 'weather-clean-core', 'open_meteo', 'success', 'fixture://weather-baseline'),
    ],
    expected: {
      finalState: 'COMPLETED',
      qaIssueDistribution: {},
      relationshipDistribution: {},
      visualModeDistribution: {
        placeholder: 1,
        massing: 1,
      },
      meshPrimitiveDistribution: {
        poi_marker: 1,
        terrain: 1,
      },
      materialRoleDistribution: {
        debug: 1,
        terrain: 1,
      },
      initialRealityTier: 'STRUCTURAL_TWIN',
      provisionalRealityTier: 'PROCEDURAL_MODEL',
      finalRealityTier: 'PROCEDURAL_MODEL',
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
      snapshot('baseline-basic-road-scene', 'osm-basic-road', 'osm', 'success', 'fixture://basic-road-scene'),
      snapshot('baseline-basic-road-scene', 'traffic-basic-road', 'tomtom', 'success', 'fixture://basic-traffic-scene'),
    ],
    expected: {
      finalState: 'COMPLETED',
      qaIssueDistribution: {},
      relationshipDistribution: {
        matches_traffic_fragment: 1,
      },
      visualModeDistribution: {
        massing: 1,
        traffic_overlay: 1,
      },
      meshPrimitiveDistribution: {
        road: 2,
      },
      materialRoleDistribution: {
        road: 1,
        debug: 1,
      },
      initialRealityTier: 'STRUCTURAL_TWIN',
      provisionalRealityTier: 'PROCEDURAL_MODEL',
      finalRealityTier: 'PROCEDURAL_MODEL',
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
    snapshots: [
      snapshot(
        'baseline-basic-terrain-scene',
        'osm-basic-terrain',
        'osm',
        'success',
        'fixture://basic-terrain-scene',
      ),
    ],
    expected: {
      finalState: 'COMPLETED',
      qaIssueDistribution: {},
      relationshipDistribution: {},
      visualModeDistribution: {
        massing: 1,
      },
      meshPrimitiveDistribution: {
        terrain: 1,
      },
      materialRoleDistribution: {
        terrain: 1,
      },
      initialRealityTier: 'STRUCTURAL_TWIN',
      provisionalRealityTier: 'PROCEDURAL_MODEL',
      finalRealityTier: 'PROCEDURAL_MODEL',
      artifacts: completedArtifacts,
    },
  },
];
