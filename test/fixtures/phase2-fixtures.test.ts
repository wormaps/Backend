import { describe, expect, it } from 'bun:test';

import { baselineFixtures, adversarialFixtures } from '../../fixtures/phase2';
import { createWorMapMvpApp } from '../../src/main';
import type { QaIssue } from '../../packages/contracts/qa';

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

describe('phase 2 fixtures first', () => {
  it.each(baselineFixtures)('$id produces the expected baseline artifact chain', (fixture) => {
    const app = createWorMapMvpApp();
    const result = app.services.sceneBuildOrchestrator.run(fixture);

    expect(fixture.snapshots.every((snapshot) => snapshot.sceneId === fixture.sceneId)).toBe(true);
    expect(result.build.currentState()).toBe(fixture.expected.finalState);
    expect('evidenceGraph' in result).toBe(fixture.expected.artifacts.evidenceGraph);
    expect('twinSceneGraph' in result).toBe(fixture.expected.artifacts.twinSceneGraph);
    expect('renderIntentSet' in result).toBe(fixture.expected.artifacts.renderIntentSet);
    expect('meshPlan' in result).toBe(fixture.expected.artifacts.meshPlan);
    expect('qaResult' in result).toBe(fixture.expected.artifacts.qaReport);
    expect('manifest' in result).toBe(fixture.expected.artifacts.manifest);

    if (!('qaResult' in result) || result.qaResult === undefined) {
      throw new Error('Expected QA report artifact.');
    }

    expect(issueDistribution(result.qaResult.issues)).toEqual(
      expectedDistribution(fixture.expected.qaIssueDistribution),
    );
  });

  it.each(adversarialFixtures)('$id preserves expected failure state and manifest', (fixture) => {
    const app = createWorMapMvpApp();
    const result = app.services.sceneBuildOrchestrator.run(fixture);

    expect(fixture.snapshots.every((snapshot) => snapshot.sceneId === fixture.sceneId)).toBe(true);
    expect(result.build.currentState()).toBe(fixture.expected.finalState);
    expect('evidenceGraph' in result).toBe(fixture.expected.artifacts.evidenceGraph);
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

    if (!('qaResult' in result) || result.qaResult === undefined) {
      throw new Error('Expected QA report artifact.');
    }

    expect(issueDistribution(result.qaResult.issues)).toEqual(
      expectedDistribution(fixture.expected.qaIssueDistribution),
    );
  });
});
