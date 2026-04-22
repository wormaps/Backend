import { describe, expect, it } from 'bun:test';
import {
  hasAdvisoryHighCorrectionRatio,
  hasCriticalCollision,
} from '../src/scene/services/generation/quality-gate/scene-quality-gate-geometry';

describe('Phase 8 geometry correction quality gate', () => {
  it('fails on high severity overlap even when road collision is zero', () => {
    expect(
      hasCriticalCollision({
        geometryDiagnostics: [
          {
            objectId: '__geometry_correction__',
            collisionRiskCount: 0,
            buildingOverlapCount: 12,
            highSeverityOverlapCount: 1,
            groundedGapCount: 0,
            openShellCount: 0,
            roofWallGapCount: 0,
            invalidSetbackJoinCount: 0,
            terrainAnchoredRoadCount: 0,
            terrainAnchoredWalkwayCount: 0,
            transportTerrainCoverageRatio: 1,
          } as any,
        ],
        totalBuildingCount: 4004,
      }),
    ).toBe(true);
  });

  it('does not fail when only non-critical overlap remains', () => {
    expect(
      hasCriticalCollision({
        geometryDiagnostics: [
          {
            objectId: '__geometry_correction__',
            collisionRiskCount: 0,
            buildingOverlapCount: 12,
            highSeverityOverlapCount: 0,
            groundedGapCount: 0,
            openShellCount: 0,
            roofWallGapCount: 0,
            invalidSetbackJoinCount: 0,
            terrainAnchoredRoadCount: 0,
            terrainAnchoredWalkwayCount: 0,
            transportTerrainCoverageRatio: 1,
          } as any,
        ],
        totalBuildingCount: 4004,
      }),
    ).toBe(false);
  });
});

describe('Phase 3 Unit 4 correctedRatio advisory signal', () => {
  it('returns true when correctedRatio exceeds 0.5 advisory threshold', () => {
    expect(
      hasAdvisoryHighCorrectionRatio({
        geometryDiagnostics: [
          {
            objectId: '__geometry_correction__',
            correctedRatio: 0.932,
          } as any,
        ],
      }),
    ).toBe(true);
  });

  it('returns false when correctedRatio is below 0.5', () => {
    expect(
      hasAdvisoryHighCorrectionRatio({
        geometryDiagnostics: [
          {
            objectId: '__geometry_correction__',
            correctedRatio: 0.15,
          } as any,
        ],
      }),
    ).toBe(false);
  });

  it('returns false when correctedRatio is exactly at threshold (0.5)', () => {
    expect(
      hasAdvisoryHighCorrectionRatio({
        geometryDiagnostics: [
          {
            objectId: '__geometry_correction__',
            correctedRatio: 0.5,
          } as any,
        ],
      }),
    ).toBe(false);
  });

  it('returns false when geometryDiagnostics is undefined', () => {
    expect(
      hasAdvisoryHighCorrectionRatio({
        geometryDiagnostics: undefined,
      }),
    ).toBe(false);
  });

  it('returns false when geometryDiagnostics is empty', () => {
    expect(
      hasAdvisoryHighCorrectionRatio({
        geometryDiagnostics: [],
      }),
    ).toBe(false);
  });

  it('returns false when correctedRatio is missing', () => {
    expect(
      hasAdvisoryHighCorrectionRatio({
        geometryDiagnostics: [
          {
            objectId: '__geometry_correction__',
          } as any,
        ],
      }),
    ).toBe(false);
  });
});
