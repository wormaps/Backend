import { describe, expect, it } from 'bun:test';

import type { QaIssue } from '../../packages/contracts/qa';
import type { RenderIntentSet } from '../../packages/contracts/render-intent';
import type { TwinSceneGraph } from '../../packages/contracts/twin-scene-graph';
import { QaGateService } from '../../src/qa/application/qa-gate.service';
import { RealityTierResolverService } from '../../src/reality/application/reality-tier-resolver.service';

function makeGraph(issues: QaIssue[]): TwinSceneGraph {
  return {
    sceneId: 'scene-test',
    scope: {
      center: { lat: 37.5, lng: 127.0 },
      boundaryType: 'radius',
      radiusMeters: 150,
      coreArea: { outer: [] },
      contextArea: { outer: [] },
    },
    coordinateFrame: {
      origin: { lat: 37.5, lng: 127.0 },
      axes: 'ENU',
      unit: 'meter',
      elevationDatum: 'UNKNOWN',
    },
    entities: [],
    relationships: [],
    evidenceGraphId: 'evidence:test',
    stateLayers: [],
    metadata: {
      initialRealityTierCandidate: 'STRUCTURAL_TWIN',
      observedRatio: 1,
      inferredRatio: 0,
      defaultedRatio: 0,
      coreEntityCount: 0,
      contextEntityCount: 0,
      qualityIssues: issues,
    },
  };
}

function makeIntentSet(provisional: RenderIntentSet['tier']['provisional']): RenderIntentSet {
  return {
    sceneId: 'scene-test',
    twinSceneGraphId: 'scene-test',
    intents: [
      {
        entityId: 'building-1',
        visualMode: 'structural_detail',
        allowedDetails: {
          windows: true,
          entrances: true,
          roofEquipment: true,
          facadeMaterial: true,
          signage: true,
        },
        lod: 'L1',
        reasonCodes: ['TEST_STRUCTURAL_DETAIL'],
        confidence: 0.9,
      },
    ],
    policyVersion: 'render-policy.v1',
    generatedAt: new Date(0).toISOString(),
    tier: {
      initialCandidate: 'STRUCTURAL_TWIN',
      provisional,
      reasonCodes: ['TEST'],
    },
  };
}

describe('qa gate control', () => {
  it('applies strip_detail action to structural intents', () => {
    const qaGate = new QaGateService(new RealityTierResolverService());
    const graph = makeGraph([
      {
        code: 'SCENE_DUPLICATED_FOOTPRINT',
        severity: 'major',
        scope: 'scene',
        message: 'duplicate',
        action: 'strip_detail',
      },
    ]);
    const result = qaGate.evaluate({
      graph,
      intentSet: makeIntentSet('PROCEDURAL_MODEL'),
      meshPlan: {
        sceneId: 'scene-test',
        renderPolicyVersion: 'render-policy.v1',
        nodes: [],
        materials: [],
        budgets: {
          maxGlbBytes: 1,
          maxTriangleCount: 1,
          maxNodeCount: 1,
          maxMaterialCount: 1,
        },
      },
    });

    expect(result.intentAdjusted).toBe(true);
    expect(result.effectiveIntentSet.intents[0]?.visualMode).toBe('massing');
    expect(result.finalTier).toBe('PROCEDURAL_MODEL');
  });

  it('downgrades final tier when downgrade_tier major issue exists', () => {
    const qaGate = new QaGateService(new RealityTierResolverService());
    const graph = makeGraph([
      {
        code: 'COMPLIANCE_PROVIDER_POLICY_RISK',
        severity: 'major',
        scope: 'provider',
        message: 'policy risk',
        action: 'downgrade_tier',
      },
    ]);
    const result = qaGate.evaluate({
      graph,
      intentSet: makeIntentSet('PROCEDURAL_MODEL'),
      meshPlan: {
        sceneId: 'scene-test',
        renderPolicyVersion: 'render-policy.v1',
        nodes: [],
        materials: [],
        budgets: {
          maxGlbBytes: 1,
          maxTriangleCount: 1,
          maxNodeCount: 1,
          maxMaterialCount: 1,
        },
      },
    });

    expect(result.intentAdjusted).toBe(false);
    expect(result.finalTier).toBe('PLACEHOLDER_SCENE');
    expect(result.finalTierReasonCodes).toEqual(['MAJOR_ISSUE_TIER_DOWNGRADE_APPLIED']);
  });
});
