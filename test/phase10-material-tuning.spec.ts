import { describe, expect, it } from 'bun:test';
import { resolveMaterialTuningFromScene } from '../src/assets/internal/glb-build/glb-build-material-tuning.utils';
import type { SceneFacadeHint } from '../src/scene/types/scene.types';
import type { PlaceCharacter } from '../src/scene/domain/place-character.value-object';

function makeHint(overrides: Partial<SceneFacadeHint> = {}): SceneFacadeHint {
  return {
    objectId: 'obj1',
    anchor: { lat: 35.7, lng: 139.7 },
    facadeEdgeIndex: 0,
    windowBands: 2,
    billboardEligible: true,
    palette: ['#ffffff'],
    materialClass: 'concrete',
    signageDensity: 'medium',
    emissiveStrength: 0.5,
    glazingRatio: 0.3,
    ...overrides,
  };
}

describe('MaterialTuning inferenceReason 로깅 강화', () => {
  it('PLACE_CHARACTER fallback source 기록 — weakEvidenceRatio > 0.5 + placeCharacter 있음', () => {
    const hints = [
      makeHint({ weakEvidence: true, inferenceReasonCodes: ['MISSING_MAPILLARY_IMAGES'] }),
      makeHint({ weakEvidence: true, inferenceReasonCodes: ['MISSING_FACADE_COLOR'] }),
      makeHint({ weakEvidence: false }),
    ];
    const character: PlaceCharacter = {
      districtType: 'ELECTRONICS_DISTRICT',
      signageDensity: 'DENSE',
      buildingEra: 'MIXED',
      facadeComplexity: 'HIGH',
    };
    const result = resolveMaterialTuningFromScene(hints, undefined, undefined, character);
    expect(result.resolvedFallbackSource).toBe('PLACE_CHARACTER');
  });

  it('DISTRICT_TYPE fallback source — districtCluster 있는 facadeHints', () => {
    const hints = [
      makeHint({ districtCluster: 'core_commercial', evidenceStrength: 'medium' }),
      makeHint({ districtCluster: 'nightlife_cluster', evidenceStrength: 'medium' }),
    ];
    const result = resolveMaterialTuningFromScene(hints);
    expect(result.resolvedFallbackSource).toBe('DISTRICT_TYPE');
  });

  it('STATIC_DEFAULT fallback source — districtCluster 없고 placeCharacter 없음', () => {
    const hints = [makeHint()];
    const result = resolveMaterialTuningFromScene(hints);
    expect(result.resolvedFallbackSource).toBe('STATIC_DEFAULT');
  });

  it('MISSING_MAPILLARY_IMAGES reason 코드 수집', () => {
    const hints = [
      makeHint({ inferenceReasonCodes: ['MISSING_MAPILLARY_IMAGES'] }),
      makeHint({ inferenceReasonCodes: ['MISSING_FACADE_COLOR'] }),
    ];
    const result = resolveMaterialTuningFromScene(hints);
    expect(result.inferenceReasonCodes).toContain('MISSING_MAPILLARY_IMAGES');
    expect(result.inferenceReasonCodes).toContain('MISSING_FACADE_COLOR');
  });

  it('WEAK_EVIDENCE_RATIO_HIGH 자동 추가 — weakEvidenceRatio >= 0.6', () => {
    const hints = [
      makeHint({ weakEvidence: true }),
      makeHint({ weakEvidence: true }),
      makeHint({ weakEvidence: true }),
      makeHint({ weakEvidence: false }),
    ];
    const result = resolveMaterialTuningFromScene(hints);
    expect(result.inferenceReasonCodes).toContain('WEAK_EVIDENCE_RATIO_HIGH');
  });

  it('ELECTRONICS_DISTRICT placeCharacter → emissiveBoost 증가', () => {
    const hints = [makeHint()];
    const character: PlaceCharacter = {
      districtType: 'ELECTRONICS_DISTRICT',
      signageDensity: 'DENSE',
      buildingEra: 'MIXED',
      facadeComplexity: 'HIGH',
    };
    const withCharacter = resolveMaterialTuningFromScene(hints, undefined, undefined, character);
    const withoutCharacter = resolveMaterialTuningFromScene(hints);
    expect(withCharacter.emissiveBoost ?? 0).toBeGreaterThanOrEqual(withoutCharacter.emissiveBoost ?? 0);
  });

  it('weakEvidenceRatio가 결과에 포함됨', () => {
    const hints = [
      makeHint({ weakEvidence: true }),
      makeHint({ weakEvidence: false }),
    ];
    const result = resolveMaterialTuningFromScene(hints);
    expect(result.weakEvidenceRatio).toBe(0.5);
  });
});
