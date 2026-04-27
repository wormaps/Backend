import { describe, expect, it } from 'bun:test';

import { baselineFixtures, adversarialFixtures } from '../../fixtures/phase2';
import type { RenderIntent } from '../../packages/contracts/render-intent';
import type { MaterialPlan, MeshPlanNode } from '../../packages/contracts/mesh-plan';
import { createWorMapMvpApp } from '../../src/main';
import type { QaIssue } from '../../packages/contracts/qa';
import type { SceneRelationship } from '../../packages/contracts/twin-scene-graph';

function issueDistribution(issues: QaIssue[]) {
  return issues.reduce<Record<string, number>>((distribution, issue) => {
    distribution[issue.code] = (distribution[issue.code] ?? 0) + 1;
    return distribution;
  }, {});
}

function expectedDistribution(distribution: Record<string, number | undefined>) {
  return Object.fromEntries(
    Object.entries(distribution).filter((entry): entry is [string, number] => entry[1] !== undefined),
  );
}

function relationshipDistribution(relationships: SceneRelationship[]) {
  return relationships.reduce<Record<string, number>>((distribution, relationship) => {
    distribution[relationship.relation] = (distribution[relationship.relation] ?? 0) + 1;
    return distribution;
  }, {});
}

function visualModeDistribution(intents: RenderIntent[]) {
  return intents.reduce<Record<string, number>>((distribution, intent) => {
    distribution[intent.visualMode] = (distribution[intent.visualMode] ?? 0) + 1;
    return distribution;
  }, {});
}

function primitiveDistribution(nodes: MeshPlanNode[]) {
  return nodes.reduce<Record<string, number>>((distribution, node) => {
    distribution[node.primitive] = (distribution[node.primitive] ?? 0) + 1;
    return distribution;
  }, {});
}

function materialRoleDistribution(materials: MaterialPlan[]) {
  return materials.reduce<Record<string, number>>((distribution, material) => {
    distribution[material.role] = (distribution[material.role] ?? 0) + 1;
    return distribution;
  }, {});
}

describe('phase 2 fixtures first', () => {
  it.each(baselineFixtures)('$id produces the expected baseline artifact chain', async (fixture) => {
    const app = createWorMapMvpApp();
    const result = await app.services.sceneBuildOrchestrator.run(fixture);

    expect(fixture.snapshots.every((snapshot) => snapshot.sceneId === fixture.sceneId)).toBe(true);
    expect(result.build.currentState()).toBe(fixture.expected.finalState);
    expect('evidenceGraph' in result).toBe(fixture.expected.artifacts.evidenceGraph);
    expect('normalizedEntityBundle' in result).toBe(true);
    expect('twinSceneGraph' in result).toBe(fixture.expected.artifacts.twinSceneGraph);
    expect('renderIntentSet' in result).toBe(fixture.expected.artifacts.renderIntentSet);
    expect('meshPlan' in result).toBe(fixture.expected.artifacts.meshPlan);
    expect('qaResult' in result).toBe(fixture.expected.artifacts.qaReport);
    expect('manifest' in result).toBe(fixture.expected.artifacts.manifest);

    if (!('qaResult' in result) || result.qaResult === undefined) {
      throw new Error('Expected QA report artifact.');
    }

    if (!('normalizedEntityBundle' in result) || result.normalizedEntityBundle === undefined) {
      throw new Error('Expected normalized entity bundle artifact.');
    }

    if (!('twinSceneGraph' in result) || result.twinSceneGraph === undefined) {
      throw new Error('Expected twin scene graph artifact.');
    }

    if (!('renderIntentSet' in result) || result.renderIntentSet === undefined) {
      throw new Error('Expected render intent set artifact.');
    }

    expect(result.normalizedEntityBundle.entities.length).toBe(fixture.snapshots.filter((snapshot) => snapshot.status !== 'failed').length);
    expect(result.twinSceneGraph.entities.length).toBe(result.normalizedEntityBundle.entities.length);
    expect(relationshipDistribution(result.twinSceneGraph.relationships)).toEqual(
      expectedDistribution(fixture.expected.relationshipDistribution),
    );
    expect(visualModeDistribution(result.renderIntentSet.intents)).toEqual(
      expectedDistribution(fixture.expected.visualModeDistribution ?? {}),
    );
    expect(primitiveDistribution(result.meshPlan.nodes)).toEqual(
      expectedDistribution(fixture.expected.meshPrimitiveDistribution ?? {}),
    );
    expect(materialRoleDistribution(result.meshPlan.materials)).toEqual(
      expectedDistribution(fixture.expected.materialRoleDistribution ?? {}),
    );
    if (fixture.expected.initialRealityTier !== undefined) {
      expect(result.twinSceneGraph.metadata.initialRealityTierCandidate).toBe(fixture.expected.initialRealityTier);
    }
    if (fixture.expected.provisionalRealityTier !== undefined) {
      expect(result.renderIntentSet.tier.provisional).toBe(fixture.expected.provisionalRealityTier);
    }
    if (fixture.expected.finalRealityTier !== undefined) {
      expect(result.qaResult.finalTier).toBe(fixture.expected.finalRealityTier);
      expect(result.manifest.finalTier).toBe(fixture.expected.finalRealityTier);
    }
    if ('glbArtifact' in result && result.glbArtifact !== undefined) {
      expect(result.manifest.artifactHashes.glb).toBe(result.glbArtifact.artifactHash);
    }
    expect(result.manifest.qaSummary.issueCount).toBe(result.qaResult.issues.length);

    expect(issueDistribution(result.qaResult.issues)).toEqual(
      expectedDistribution(fixture.expected.qaIssueDistribution),
    );
  });

  it.each(adversarialFixtures)('$id preserves expected failure state and manifest', async (fixture) => {
    const app = createWorMapMvpApp();
    const result = await app.services.sceneBuildOrchestrator.run(fixture);

    expect(fixture.snapshots.every((snapshot) => snapshot.sceneId === fixture.sceneId)).toBe(true);
    expect(result.build.currentState()).toBe(fixture.expected.finalState);
    expect('evidenceGraph' in result).toBe(fixture.expected.artifacts.evidenceGraph);
    expect('normalizedEntityBundle' in result).toBe(fixture.expected.artifacts.evidenceGraph);
    expect('twinSceneGraph' in result).toBe(fixture.expected.artifacts.twinSceneGraph);
    expect('renderIntentSet' in result).toBe(fixture.expected.artifacts.renderIntentSet);
    expect('meshPlan' in result).toBe(fixture.expected.artifacts.meshPlan);
    expect('qaResult' in result).toBe(fixture.expected.artifacts.qaReport);
    expect('manifest' in result).toBe(fixture.expected.artifacts.manifest);

    if (!('manifest' in result) || result.manifest === undefined) {
      throw new Error('Expected manifest artifact.');
    }

    expect(result.manifest.state).toBe(fixture.expected.finalState);
    expect(result.manifest.snapshotBundleId).toBe(fixture.snapshotBundleId);
    if (fixture.expected.finalRealityTier !== undefined) {
      expect(result.manifest.finalTier).toBe(fixture.expected.finalRealityTier);
    }
    expect(result.manifest.qaSummary.issueCount).toBe(result.qaResult.issues.length);

    if (!('qaResult' in result) || result.qaResult === undefined) {
      throw new Error('Expected QA report artifact.');
    }

    if (fixture.expected.artifacts.evidenceGraph && 'normalizedEntityBundle' in result && result.normalizedEntityBundle !== undefined) {
      expect(result.normalizedEntityBundle.issues.length).toBeGreaterThan(0);
    }

    if ('twinSceneGraph' in result && result.twinSceneGraph !== undefined) {
      expect(relationshipDistribution(result.twinSceneGraph.relationships)).toEqual(
        expectedDistribution(fixture.expected.relationshipDistribution),
      );
      if (fixture.expected.initialRealityTier !== undefined) {
        expect(result.twinSceneGraph.metadata.initialRealityTierCandidate).toBe(fixture.expected.initialRealityTier);
      }
    }

    if ('renderIntentSet' in result && result.renderIntentSet !== undefined) {
      expect(visualModeDistribution(result.renderIntentSet.intents)).toEqual(
        expectedDistribution(fixture.expected.visualModeDistribution ?? {}),
      );
      if (fixture.expected.provisionalRealityTier !== undefined) {
        expect(result.renderIntentSet.tier.provisional).toBe(fixture.expected.provisionalRealityTier);
      }
    }
    if ('meshPlan' in result && result.meshPlan !== undefined) {
      expect(primitiveDistribution(result.meshPlan.nodes)).toEqual(
        expectedDistribution(fixture.expected.meshPrimitiveDistribution ?? {}),
      );
      expect(materialRoleDistribution(result.meshPlan.materials)).toEqual(
        expectedDistribution(fixture.expected.materialRoleDistribution ?? {}),
      );
    }
    if (fixture.expected.finalRealityTier !== undefined) {
      expect(result.qaResult.finalTier).toBe(fixture.expected.finalRealityTier);
    }

    if ('glbArtifact' in result && result.glbArtifact !== undefined) {
      expect(result.manifest.artifactHashes.glb).toBe(result.glbArtifact.artifactHash);
    }

    expect(issueDistribution(result.qaResult.issues)).toEqual(
      expectedDistribution(fixture.expected.qaIssueDistribution),
    );
  });
});
