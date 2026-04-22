import { describe, expect, it } from 'bun:test';
import { resolveAdaptiveMeshWarnThresholds } from '../src/scene/services/generation/quality-gate/scene-quality-gate-thresholds';

describe('resolveAdaptiveMeshWarnThresholds', () => {
  it('preserves baseline thresholds for small scenes', () => {
    expect(
      resolveAdaptiveMeshWarnThresholds({
        thresholds: {
          maxSkippedMeshesWarn: 180,
          maxMissingSourceWarn: 48,
        },
        totalMeshNodeCount: 200,
      }),
    ).toEqual({
      maxSkippedMeshesWarn: 180,
      maxMissingSourceWarn: 48,
    });
  });

  it('scales warn thresholds for large scenes', () => {
    expect(
      resolveAdaptiveMeshWarnThresholds({
        thresholds: {
          maxSkippedMeshesWarn: 180,
          maxMissingSourceWarn: 48,
        },
        totalMeshNodeCount: 5190,
      }),
    ).toEqual({
      maxSkippedMeshesWarn: 623,
      maxMissingSourceWarn: 63,
    });
  });

  it('never lowers stricter phase thresholds below configured minima', () => {
    expect(
      resolveAdaptiveMeshWarnThresholds({
        thresholds: {
          maxSkippedMeshesWarn: 80,
          maxMissingSourceWarn: 20,
        },
        totalMeshNodeCount: 100,
      }),
    ).toEqual({
      maxSkippedMeshesWarn: 80,
      maxMissingSourceWarn: 20,
    });
  });
});
