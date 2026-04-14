import { resolveMaterialTuningFromScene } from './glb-build-material-tuning.utils';
import type { SceneFacadeHint } from '../../../scene/types/scene.types';

describe('glb-build-material-tuning.utils', () => {
  it('propagates facade inference reason codes and adds weak-evidence aggregate reason', () => {
    const hints = buildHints(5, {
      weakEvidenceCount: 4,
      reasonCodes: ['MISSING_FACADE_COLOR', 'DEFAULT_STYLE_RULE'],
    });

    const tuning = resolveMaterialTuningFromScene(hints);

    expect(tuning.inferenceReasonCodes).toContain('MISSING_FACADE_COLOR');
    expect(tuning.inferenceReasonCodes).toContain('DEFAULT_STYLE_RULE');
    expect(tuning.inferenceReasonCodes).toContain('WEAK_EVIDENCE_RATIO_HIGH');
  });

  it('does not add WEAK_EVIDENCE_RATIO_HIGH when weak evidence ratio is below threshold', () => {
    const hints = buildHints(5, {
      weakEvidenceCount: 2,
      reasonCodes: ['MISSING_MAPILLARY_IMAGES'],
    });

    const tuning = resolveMaterialTuningFromScene(hints);

    expect(tuning.inferenceReasonCodes).toContain('MISSING_MAPILLARY_IMAGES');
    expect(tuning.inferenceReasonCodes).not.toContain(
      'WEAK_EVIDENCE_RATIO_HIGH',
    );
  });
});

function buildHints(
  total: number,
  options: {
    weakEvidenceCount: number;
    reasonCodes: SceneFacadeHint['inferenceReasonCodes'];
  },
): SceneFacadeHint[] {
  return Array.from({ length: total }).map((_, index) => ({
    objectId: `building-${index}`,
    anchor: {
      lat: 37.56 + index * 0.0001,
      lng: 126.97 + index * 0.0001,
    },
    facadeEdgeIndex: 0,
    windowBands: 4,
    billboardEligible: false,
    palette: ['#445566', '#667788', '#8899aa'],
    materialClass: 'concrete',
    signageDensity: 'low',
    emissiveStrength: 0.3,
    glazingRatio: 0.4,
    weakEvidence: index < options.weakEvidenceCount,
    inferenceReasonCodes:
      index < options.weakEvidenceCount ? options.reasonCodes : [],
  }));
}
