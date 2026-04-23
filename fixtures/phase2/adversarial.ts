import { defaultScope, fixtureIssue, snapshot } from './shared';
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
  {
    id: 'adversarial-duplicated-footprints',
    kind: 'adversarial',
    sceneId: 'adversarial-duplicated-footprints',
    buildId: 'build-adversarial-duplicated-footprints',
    snapshotBundleId: 'bundle-adversarial-duplicated-footprints',
    scope: defaultScope,
    snapshots: [
      snapshot('adversarial-duplicated-footprints', 'osm-duplicated-footprints', 'osm', 'success', [
        fixtureIssue('SCENE_DUPLICATED_FOOTPRINT'),
      ]),
    ],
    expected: {
      finalState: 'COMPLETED',
      qaIssueDistribution: {
        SCENE_DUPLICATED_FOOTPRINT: 1,
      },
      realityTier: 'PLACEHOLDER_SCENE',
      artifacts: {
        evidenceGraph: true,
        twinSceneGraph: true,
        renderIntentSet: true,
        meshPlan: true,
        qaReport: true,
        manifest: true,
      },
    },
  },
  {
    id: 'adversarial-self-intersecting-polygon',
    kind: 'adversarial',
    sceneId: 'adversarial-self-intersecting-polygon',
    buildId: 'build-adversarial-self-intersecting-polygon',
    snapshotBundleId: 'bundle-adversarial-self-intersecting-polygon',
    scope: defaultScope,
    snapshots: [
      snapshot('adversarial-self-intersecting-polygon', 'osm-self-intersection', 'osm', 'success', [
        fixtureIssue('GEOMETRY_SELF_INTERSECTION', 'critical'),
      ]),
    ],
    expected: {
      finalState: 'QUARANTINED',
      qaIssueDistribution: {
        GEOMETRY_SELF_INTERSECTION: 1,
      },
      realityTier: 'PLACEHOLDER_SCENE',
      artifacts: {
        evidenceGraph: true,
        twinSceneGraph: true,
        renderIntentSet: true,
        meshPlan: true,
        qaReport: true,
        manifest: true,
      },
    },
  },
  {
    id: 'adversarial-road-building-overlap',
    kind: 'adversarial',
    sceneId: 'adversarial-road-building-overlap',
    buildId: 'build-adversarial-road-building-overlap',
    snapshotBundleId: 'bundle-adversarial-road-building-overlap',
    scope: defaultScope,
    snapshots: [
      snapshot('adversarial-road-building-overlap', 'osm-road-building-overlap', 'osm', 'success', [
        fixtureIssue('SCENE_ROAD_BUILDING_OVERLAP', 'critical'),
      ]),
    ],
    expected: {
      finalState: 'QUARANTINED',
      qaIssueDistribution: {
        SCENE_ROAD_BUILDING_OVERLAP: 1,
      },
      realityTier: 'PLACEHOLDER_SCENE',
      artifacts: {
        evidenceGraph: true,
        twinSceneGraph: true,
        renderIntentSet: true,
        meshPlan: true,
        qaReport: true,
        manifest: true,
      },
    },
  },
  {
    id: 'adversarial-coordinate-outlier',
    kind: 'adversarial',
    sceneId: 'adversarial-coordinate-outlier',
    buildId: 'build-adversarial-coordinate-outlier',
    snapshotBundleId: 'bundle-adversarial-coordinate-outlier',
    scope: defaultScope,
    snapshots: [
      snapshot('adversarial-coordinate-outlier', 'osm-coordinate-outlier', 'osm', 'success', [
        fixtureIssue('SPATIAL_COORDINATE_OUTLIER'),
      ]),
    ],
    expected: {
      finalState: 'COMPLETED',
      qaIssueDistribution: {
        SPATIAL_COORDINATE_OUTLIER: 1,
      },
      realityTier: 'PLACEHOLDER_SCENE',
      artifacts: {
        evidenceGraph: true,
        twinSceneGraph: true,
        renderIntentSet: true,
        meshPlan: true,
        qaReport: true,
        manifest: true,
      },
    },
  },
  {
    id: 'adversarial-extreme-terrain-slope',
    kind: 'adversarial',
    sceneId: 'adversarial-extreme-terrain-slope',
    buildId: 'build-adversarial-extreme-terrain-slope',
    snapshotBundleId: 'bundle-adversarial-extreme-terrain-slope',
    scope: defaultScope,
    snapshots: [
      snapshot('adversarial-extreme-terrain-slope', 'osm-extreme-terrain-slope', 'osm', 'success', [
        fixtureIssue('SPATIAL_EXTREME_TERRAIN_SLOPE'),
      ]),
    ],
    expected: {
      finalState: 'COMPLETED',
      qaIssueDistribution: {
        SPATIAL_EXTREME_TERRAIN_SLOPE: 1,
      },
      realityTier: 'PLACEHOLDER_SCENE',
      artifacts: {
        evidenceGraph: true,
        twinSceneGraph: true,
        renderIntentSet: true,
        meshPlan: true,
        qaReport: true,
        manifest: true,
      },
    },
  },
  {
    id: 'adversarial-provider-policy-violation',
    kind: 'adversarial',
    sceneId: 'adversarial-provider-policy-violation',
    buildId: 'build-adversarial-provider-policy-violation',
    snapshotBundleId: 'bundle-adversarial-provider-policy-violation',
    scope: defaultScope,
    snapshots: [
      snapshot('adversarial-provider-policy-violation', 'google-policy-risk', 'google_places', 'success', [
        fixtureIssue('COMPLIANCE_PROVIDER_POLICY_RISK'),
      ]),
    ],
    expected: {
      finalState: 'COMPLETED',
      qaIssueDistribution: {
        COMPLIANCE_PROVIDER_POLICY_RISK: 1,
      },
      realityTier: 'PLACEHOLDER_SCENE',
      artifacts: {
        evidenceGraph: true,
        twinSceneGraph: true,
        renderIntentSet: true,
        meshPlan: true,
        qaReport: true,
        manifest: true,
      },
    },
  },
];
