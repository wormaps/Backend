import { describe, expect, it } from 'bun:test';

import {
  QA_ISSUE_CODE_PREFIXES,
  QA_ISSUE_CODES,
} from '../../src/shared/contracts';
import { SCHEMA_VERSION_SET_V1 } from '../../src/shared/core';
import { SCENE_BUILD_STATES } from '../../src/shared/contracts';

describe('contract registries', () => {
  it('keeps QA issue code namespace prefixes', () => {
    expect(QA_ISSUE_CODE_PREFIXES.length).toBeGreaterThan(0);
    expect(QA_ISSUE_CODE_PREFIXES).toContain('SCENE_');
  });

  it('keeps QA codes explicitly registered', () => {
    expect(QA_ISSUE_CODES.length).toBeGreaterThan(10);
    expect(QA_ISSUE_CODES).toContain('SCENE_DUPLICATED_FOOTPRINT');
  });

  it('includes required build states', () => {
    expect(SCENE_BUILD_STATES).toContain('REQUESTED');
    expect(SCENE_BUILD_STATES).toContain('COMPLETED');
    expect(SCENE_BUILD_STATES).toContain('FAILED');
  });

  it('versions all public artifact schemas', () => {
    expect(SCHEMA_VERSION_SET_V1.sourceSnapshotSchema).toBeTruthy();
    expect(SCHEMA_VERSION_SET_V1.manifestSchema).toBeTruthy();
    expect(SCHEMA_VERSION_SET_V1.qaSchema).toBeTruthy();
  });
});
