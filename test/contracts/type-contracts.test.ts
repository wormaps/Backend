import { describe, expect, it } from 'bun:test';

import type { SourceSnapshot } from '../../packages/contracts/source-snapshot';
import type { RenderIntentSet } from '../../packages/contracts/render-intent';
import type { SceneBuildManifest } from '../../packages/contracts/manifest';
import type { TwinSceneGraph } from '../../packages/contracts/twin-scene-graph';
import { SCHEMA_VERSION_SET_V1 } from '../../packages/core/schemas';

describe('public contract shapes', () => {
  it('allows a metadata-only SourceSnapshot without raw payload', () => {
    const snapshot: SourceSnapshot = {
      id: 'snap_1',
      provider: 'osm',
      sceneId: 'scene_1',
      requestedAt: '2026-04-23T00:00:00.000Z',
      queryHash: 'sha256:query',
      responseHash: 'sha256:response',
      storageMode: 'metadata_only',
      status: 'success',
      compliance: {
        provider: 'osm',
        attributionRequired: true,
        attributionText: 'OpenStreetMap contributors',
        retentionPolicy: 'cache_allowed',
        policyVersion: '1.0.0',
      },
    };

    expect(snapshot.payloadRef).toBeUndefined();
  });

  it('keeps graph, intent, and manifest contracts separate', () => {
    const graph = {
      sceneId: 'scene_1',
      scope: {
        center: { lat: 37.4979, lng: 127.0276 },
        boundaryType: 'radius',
        radiusMeters: 150,
        coreArea: { outer: [] },
        contextArea: { outer: [] },
      },
      coordinateFrame: {
        origin: { lat: 37.4979, lng: 127.0276 },
        axes: 'ENU',
        unit: 'meter',
        elevationDatum: 'UNKNOWN',
      },
      entities: [],
      relationships: [],
      evidenceGraphId: 'evidence_1',
      stateLayers: [],
      metadata: {
        initialRealityTierCandidate: 'PLACEHOLDER_SCENE',
        observedRatio: 0,
        inferredRatio: 0,
        defaultedRatio: 1,
        coreEntityCount: 0,
        contextEntityCount: 0,
        qualityIssues: [],
      },
    } satisfies TwinSceneGraph;

    const intent = {
      sceneId: graph.sceneId,
      twinSceneGraphId: 'graph_1',
      intents: [],
      policyVersion: '1.0.0',
      generatedAt: '2026-04-23T00:00:00.000Z',
      tier: {
        initialCandidate: 'PLACEHOLDER_SCENE',
        provisional: 'PLACEHOLDER_SCENE',
        reasonCodes: ['NO_ENTITIES'],
      },
    } satisfies RenderIntentSet;

    const manifest = {
      sceneId: graph.sceneId,
      buildId: 'build_1',
      state: 'COMPLETED',
      createdAt: '2026-04-23T00:00:00.000Z',
      scopeId: 'scope_1',
      snapshotBundleId: 'bundle_1',
      schemaVersions: SCHEMA_VERSION_SET_V1,
      mapperVersion: '1.0.0',
      normalizationVersion: '1.0.0',
      identityVersion: '1.0.0',
      renderPolicyVersion: intent.policyVersion,
      meshPolicyVersion: '1.0.0',
      qaVersion: '1.0.0',
      glbCompilerVersion: '1.0.0',
      packageVersions: {},
      inputHashes: {},
      artifactHashes: {},
      attribution: { required: false, entries: [] },
      complianceIssues: [],
    } satisfies SceneBuildManifest;

    expect(manifest.sceneId).toBe(intent.sceneId);
  });
});
