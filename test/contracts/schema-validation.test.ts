import { describe, expect, it } from 'bun:test';

import {
  validateEvidenceGraph,
  validateMeshPlan,
  validateNormalizedEntityBundle,
  validateProviderBudgetPolicy,
  validateQaIssue,
  validateRenderIntentSet,
  validateSceneBuildManifest,
  validateSchemaVersionSet,
  validateSourceSnapshot,
  validateTwinSceneGraph,
} from '../../src/shared/contracts';
import { SCHEMA_VERSION_SET_V1 } from '../../src/shared/core';
import { snapshot, defaultScope } from '../fixtures/shared';

describe('contracts schema validation', () => {
  it('SourceSnapshot schema accepts valid fixture snapshot', () => {
    const s = snapshot('scene-a', 'snap-1', 'osm', 'success', '[{"id":"1"}]');
    const result = validateSourceSnapshot(s);
    expect(result.success).toBe(true);
  });

  it('SourceSnapshot schema rejects invalid provider', () => {
    const s = { ...snapshot('scene-a', 'snap-1', 'osm'), provider: 'invalid-provider' };
    const result = validateSourceSnapshot(s);
    expect(result.success).toBe(false);
  });

  it('TwinSceneGraph schema accepts minimal valid graph', () => {
    const graph = {
      sceneId: 'scene-a',
      scope: defaultScope,
      coordinateFrame: {
        origin: defaultScope.center,
        axes: 'ENU',
        unit: 'meter',
        elevationDatum: 'UNKNOWN',
      },
      entities: [],
      relationships: [],
      evidenceGraphId: 'evidence:scene-a:bundle-a',
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
    };

    const result = validateTwinSceneGraph(graph);
    expect(result.success).toBe(true);
  });

  it('SceneBuildManifest schema accepts minimal valid manifest', () => {
    const manifest = {
      sceneId: 'scene-a',
      buildId: 'build-a',
      state: 'COMPLETED',
      createdAt: new Date(0).toISOString(),
      scopeId: 'scope-a',
      snapshotBundleId: 'bundle-a',
      schemaVersions: SCHEMA_VERSION_SET_V1,
      mapperVersion: 'mapper.v1',
      normalizationVersion: 'normalization.v1',
      identityVersion: 'identity.v1',
      renderPolicyVersion: 'render-policy.v1',
      meshPolicyVersion: 'mesh-policy.v1',
      qaVersion: 'qa.v1',
      glbCompilerVersion: 'glb-compiler.v1',
      packageVersions: {},
      inputHashes: {},
      artifactHashes: {},
      finalTier: 'PLACEHOLDER_SCENE',
      finalTierReasonCodes: ['TEST'],
      qaSummary: {
        issueCount: 0,
        criticalCount: 0,
        majorCount: 0,
        minorCount: 0,
        infoCount: 0,
        warnActionCount: 0,
        recordActionCount: 0,
        failBuildCount: 0,
        downgradeTierCount: 0,
        stripDetailCount: 0,
        topCodes: [],
      },
      attribution: {
        required: false,
        entries: [],
      },
      complianceIssues: [],
    };

    const result = validateSceneBuildManifest(manifest);
    expect(result.success).toBe(true);
  });

  it('schema validator functions return failure on invalid shapes', () => {
    expect(validateEvidenceGraph({}).success).toBe(false);
    expect(validateRenderIntentSet({}).success).toBe(false);
    expect(validateMeshPlan({}).success).toBe(false);
    expect(validateNormalizedEntityBundle({}).success).toBe(false);
    expect(validateQaIssue({}).success).toBe(false);
    expect(validateProviderBudgetPolicy({}).success).toBe(false);
    expect(validateSchemaVersionSet({}).success).toBe(false);
  });
});
