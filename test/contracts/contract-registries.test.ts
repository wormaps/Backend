import { describe, expect, it } from 'bun:test';

import {
  isQaIssueCode,
  QA_ISSUE_CODE_PREFIXES,
} from '../../packages/contracts/qa';
import {
  isSceneBuildState,
  SCENE_BUILD_STATES,
} from '../../packages/contracts/manifest';
import { SCHEMA_VERSION_SET_V1 } from '../../packages/core/schemas';

describe('contract registries', () => {
  it('keeps QA issue codes namespace-based', () => {
    expect(QA_ISSUE_CODE_PREFIXES).toContain('PROVIDER_');
    expect(QA_ISSUE_CODE_PREFIXES).toContain('COMPLIANCE_');
    expect(isQaIssueCode('PROVIDER_SNAPSHOT_MISSING')).toBe(true);
    expect(isQaIssueCode('COMPLIANCE_PROVIDER_POLICY_RISK')).toBe(true);
    expect(isQaIssueCode('INVALID_POLYGON')).toBe(false);
  });

  it('includes operational build states needed for v2 clean slate', () => {
    expect(SCENE_BUILD_STATES).toContain('SNAPSHOT_PARTIAL');
    expect(SCENE_BUILD_STATES).toContain('QUARANTINED');
    expect(SCENE_BUILD_STATES).toContain('CANCELLED');
    expect(SCENE_BUILD_STATES).toContain('SUPERSEDED');
    expect(isSceneBuildState('COMPLETED')).toBe(true);
    expect(isSceneBuildState('RETRYING')).toBe(false);
  });

  it('versions every public artifact schema', () => {
    expect(SCHEMA_VERSION_SET_V1).toEqual({
      sourceSnapshotSchema: 'source-snapshot.v1',
      normalizedEntitySchema: 'normalized-entity.v1',
      evidenceGraphSchema: 'evidence-graph.v1',
      twinSceneGraphSchema: 'twin-scene-graph.v1',
      renderIntentSchema: 'render-intent.v1',
      meshPlanSchema: 'mesh-plan.v1',
      qaSchema: 'qa.v1',
      manifestSchema: 'manifest.v1',
    });
  });
});
