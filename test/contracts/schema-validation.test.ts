import { describe, expect, it } from 'bun:test';

import {
  validateSourceSnapshot,
  validateEvidenceGraph,
  validateTwinSceneGraph,
  validateRenderIntentSet,
  validateMeshPlan,
  validateNormalizedEntityBundle,
  validateQaIssue,
  validateSceneBuildManifest,
  validateSchemaVersionSet,
  validateProviderBudgetPolicy,
} from '../../packages/contracts/validate';
import { SCHEMA_VERSION_SET_V1 } from '../../packages/core/schemas';
import { snapshot, defaultScope } from '../../fixtures/phase2/shared';

// ---------------------------------------------------------------------------
// Helpers: minimal valid fixtures for schemas without existing fixtures
// ---------------------------------------------------------------------------

function minimalQaIssue() {
  return {
    code: 'TEST_ISSUE',
    severity: 'info' as const,
    scope: 'scene' as const,
    message: 'Test issue',
    action: 'record_only' as const,
  };
}

function minimalEvidenceGraph() {
  return {
    id: 'eg-1',
    sceneId: 'scene-1',
    snapshotBundleId: 'bundle-1',
    nodes: [],
    edges: [],
    generatedAt: '2026-04-23T00:00:00.000Z',
    evidencePolicyVersion: '1.0.0',
  };
}

function minimalTwinSceneGraph() {
  return {
    sceneId: 'scene-1',
    scope: defaultScope,
    coordinateFrame: {
      origin: { lat: 37.4979, lng: 127.0276 },
      axes: 'ENU' as const,
      unit: 'meter' as const,
      elevationDatum: 'UNKNOWN' as const,
    },
    entities: [],
    relationships: [],
    evidenceGraphId: 'eg-1',
    stateLayers: [],
    metadata: {
      initialRealityTierCandidate: 'PLACEHOLDER_SCENE' as const,
      observedRatio: 0,
      inferredRatio: 0,
      defaultedRatio: 1,
      coreEntityCount: 0,
      contextEntityCount: 0,
      qualityIssues: [],
    },
  };
}

function minimalRenderIntentSet() {
  return {
    sceneId: 'scene-1',
    twinSceneGraphId: 'tsg-1',
    intents: [],
    policyVersion: '1.0.0',
    generatedAt: '2026-04-23T00:00:00.000Z',
    tier: {
      initialCandidate: 'PLACEHOLDER_SCENE' as const,
      provisional: 'PLACEHOLDER_SCENE' as const,
      reasonCodes: [],
    },
  };
}

function minimalMeshPlan() {
  return {
    sceneId: 'scene-1',
    renderPolicyVersion: '1.0.0',
    nodes: [],
    materials: [],
    budgets: {
      maxGlbBytes: 10_000_000,
      maxTriangleCount: 100_000,
      maxNodeCount: 1000,
      maxMaterialCount: 50,
    },
  };
}

function minimalNormalizedEntityBundle() {
  return {
    id: 'neb-1',
    sceneId: 'scene-1',
    snapshotBundleId: 'bundle-1',
    entities: [],
    issues: [],
    generatedAt: '2026-04-23T00:00:00.000Z',
    normalizationVersion: '1.0.0',
  };
}

function minimalSceneBuildManifest() {
  return {
    sceneId: 'scene-1',
    buildId: 'build-1',
    state: 'COMPLETED' as const,
    createdAt: '2026-04-23T00:00:00.000Z',
    scopeId: 'scope-1',
    snapshotBundleId: 'bundle-1',
    schemaVersions: SCHEMA_VERSION_SET_V1,
    mapperVersion: '1.0.0',
    normalizationVersion: '1.0.0',
    identityVersion: '1.0.0',
    renderPolicyVersion: '1.0.0',
    meshPolicyVersion: '1.0.0',
    qaVersion: '1.0.0',
    glbCompilerVersion: '1.0.0',
    packageVersions: {},
    inputHashes: {},
    artifactHashes: {},
    finalTier: 'PLACEHOLDER_SCENE' as const,
    finalTierReasonCodes: [],
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
}

function minimalProviderBudgetPolicy() {
  return {
    provider: 'osm' as const,
    maxRequestsPerBuild: 100,
    maxRetriesPerRequest: 3,
    timeoutMs: 5000,
    backoffPolicy: 'exponential' as const,
    fallbackAllowed: true,
  };
}

// ---------------------------------------------------------------------------
// 1. SourceSnapshot
// ---------------------------------------------------------------------------

describe('SourceSnapshot schema', () => {
  it('accepts valid snapshot from fixture', () => {
    const snap = snapshot('test-scene', 'snap-1', 'osm', 'success', 'fixture://test');
    const result = validateSourceSnapshot(snap);
    expect(result.success).toBe(true);
  });

  it('rejects invalid provider enum', () => {
    const snap = snapshot('test-scene', 'snap-1', 'osm', 'success', 'fixture://test');
    const result = validateSourceSnapshot({ ...snap, provider: 'invalid_provider' });
    expect(result.success).toBe(false);
  });

  it('rejects missing required id field', () => {
    const snap = snapshot('test-scene', 'snap-1', 'osm', 'success', 'fixture://test');
    const { id, ...withoutId } = snap;
    const result = validateSourceSnapshot(withoutId);
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2. EvidenceGraph
// ---------------------------------------------------------------------------

describe('EvidenceGraph schema', () => {
  it('accepts minimal valid evidence graph', () => {
    const result = validateEvidenceGraph(minimalEvidenceGraph());
    expect(result.success).toBe(true);
  });

  it('rejects invalid edge relation enum', () => {
    const graph = minimalEvidenceGraph();
    const result = validateEvidenceGraph({
      ...graph,
      edges: [{ from: 'n1', to: 'n2', relation: 'invalid_relation', reasonCodes: [] }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing sceneId', () => {
    const { sceneId, ...withoutSceneId } = minimalEvidenceGraph();
    const result = validateEvidenceGraph(withoutSceneId);
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 3. TwinSceneGraph
// ---------------------------------------------------------------------------

describe('TwinSceneGraph schema', () => {
  it('accepts minimal valid twin scene graph', () => {
    const result = validateTwinSceneGraph(minimalTwinSceneGraph());
    expect(result.success).toBe(true);
  });

  it('rejects invalid reality tier in metadata', () => {
    const graph = minimalTwinSceneGraph();
    const result = validateTwinSceneGraph({
      ...graph,
      metadata: { ...graph.metadata, initialRealityTierCandidate: 'INVALID_TIER' },
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid coordinateFrame axes', () => {
    const graph = minimalTwinSceneGraph();
    const result = validateTwinSceneGraph({
      ...graph,
      coordinateFrame: { ...graph.coordinateFrame, axes: 'NED' },
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 4. RenderIntentSet
// ---------------------------------------------------------------------------

describe('RenderIntentSet schema', () => {
  it('accepts minimal valid render intent set', () => {
    const result = validateRenderIntentSet(minimalRenderIntentSet());
    expect(result.success).toBe(true);
  });

  it('rejects invalid visualMode in intent', () => {
    const intentSet = minimalRenderIntentSet();
    const result = validateRenderIntentSet({
      ...intentSet,
      intents: [{
        entityId: 'e1',
        visualMode: 'invalid_mode',
        allowedDetails: {
          windows: false,
          entrances: false,
          roofEquipment: false,
          facadeMaterial: false,
          signage: false,
        },
        lod: 'L0',
        reasonCodes: [],
        confidence: 0.5,
      }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing tier object', () => {
    const { tier, ...withoutTier } = minimalRenderIntentSet();
    const result = validateRenderIntentSet(withoutTier);
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 5. MeshPlan
// ---------------------------------------------------------------------------

describe('MeshPlan schema', () => {
  it('accepts minimal valid mesh plan', () => {
    const result = validateMeshPlan(minimalMeshPlan());
    expect(result.success).toBe(true);
  });

  it('rejects invalid primitive enum in node', () => {
    const plan = minimalMeshPlan();
    const result = validateMeshPlan({
      ...plan,
      nodes: [{
        id: 'node-1',
        entityId: 'e1',
        name: 'Test Node',
        primitive: 'invalid_primitive',
        pivot: { x: 0, y: 0, z: 0 },
        materialId: 'mat-1',
      }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing budgets', () => {
    const { budgets, ...withoutBudgets } = minimalMeshPlan();
    const result = validateMeshPlan(withoutBudgets);
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 6. NormalizedEntityBundle
// ---------------------------------------------------------------------------

describe('NormalizedEntityBundle schema', () => {
  it('accepts minimal valid entity bundle', () => {
    const result = validateNormalizedEntityBundle(minimalNormalizedEntityBundle());
    expect(result.success).toBe(true);
  });

  it('rejects missing normalizationVersion', () => {
    const { normalizationVersion, ...withoutVersion } = minimalNormalizedEntityBundle();
    const result = validateNormalizedEntityBundle(withoutVersion);
    expect(result.success).toBe(false);
  });

  it('rejects invalid entity type in entities array', () => {
    const bundle = minimalNormalizedEntityBundle();
    const result = validateNormalizedEntityBundle({
      ...bundle,
      entities: [{
        id: 'e1',
        stableId: 's1',
        type: 'invalid_type',
        sourceEntityRefs: [],
        tags: [],
        issues: [],
      }],
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 7. QaIssue
// ---------------------------------------------------------------------------

describe('QaIssue schema', () => {
  it('accepts valid QA issue', () => {
    const result = validateQaIssue(minimalQaIssue());
    expect(result.success).toBe(true);
  });

  it('rejects invalid severity enum', () => {
    const result = validateQaIssue({
      ...minimalQaIssue(),
      severity: 'catastrophic',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid action enum', () => {
    const result = validateQaIssue({
      ...minimalQaIssue(),
      action: 'explode',
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 8. SceneBuildManifest
// ---------------------------------------------------------------------------

describe('SceneBuildManifest schema', () => {
  it('accepts minimal valid manifest', () => {
    const result = validateSceneBuildManifest(minimalSceneBuildManifest());
    expect(result.success).toBe(true);
  });

  it('rejects invalid build state enum', () => {
    const manifest = minimalSceneBuildManifest();
    const result = validateSceneBuildManifest({ ...manifest, state: 'UNKNOWN_STATE' });
    expect(result.success).toBe(false);
  });

  it('rejects missing qaSummary', () => {
    const { qaSummary, ...withoutQaSummary } = minimalSceneBuildManifest();
    const result = validateSceneBuildManifest(withoutQaSummary);
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 9. SchemaVersionSet
// ---------------------------------------------------------------------------

describe('SchemaVersionSet schema', () => {
  it('accepts SCHEMA_VERSION_SET_V1 constant', () => {
    const result = validateSchemaVersionSet(SCHEMA_VERSION_SET_V1);
    expect(result.success).toBe(true);
  });

  it('rejects missing manifestSchema version', () => {
    const { manifestSchema, ...withoutManifest } = SCHEMA_VERSION_SET_V1;
    const result = validateSchemaVersionSet(withoutManifest);
    expect(result.success).toBe(false);
  });

  it('rejects non-string version value', () => {
    const result = validateSchemaVersionSet({
      ...SCHEMA_VERSION_SET_V1,
      qaSchema: 42,
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 10. ProviderBudgetPolicy
// ---------------------------------------------------------------------------

describe('ProviderBudgetPolicy schema', () => {
  it('accepts minimal valid budget policy', () => {
    const result = validateProviderBudgetPolicy(minimalProviderBudgetPolicy());
    expect(result.success).toBe(true);
  });

  it('rejects invalid backoffPolicy enum', () => {
    const result = validateProviderBudgetPolicy({
      ...minimalProviderBudgetPolicy(),
      backoffPolicy: 'fibonacci',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing maxRequestsPerBuild', () => {
    const { maxRequestsPerBuild, ...withoutMax } = minimalProviderBudgetPolicy();
    const result = validateProviderBudgetPolicy(withoutMax);
    expect(result.success).toBe(false);
  });
});
