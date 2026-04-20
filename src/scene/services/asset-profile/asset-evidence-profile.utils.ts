import type { SceneDetail, SceneEvidenceProfile } from '../../types/scene.types';

export function buildEvidenceProfile(sceneDetail: SceneDetail): SceneEvidenceProfile {
  const facadeHints = sceneDetail.facadeHints ?? [];
  const weakEvidenceRatio =
    facadeHints.length > 0
      ? facadeHints.filter((hint) => hint.weakEvidence).length /
        facadeHints.length
      : 0;

  const hasDistrictCluster = facadeHints.some((h) => h.districtCluster);
  const hasMapillary = sceneDetail.provenance?.mapillaryUsed ?? false;

  let evidenceSource: SceneEvidenceProfile['evidenceSource'] =
    'STATIC_DEFAULT';
  let confidence = 0.5;

  if (hasMapillary) {
    evidenceSource = 'MAPILLARY_DIRECT';
    confidence = 0.9;
  } else if (weakEvidenceRatio > 0.5) {
    evidenceSource = 'PLACE_CHARACTER_FALLBACK';
    confidence = 0.3;
  } else if (hasDistrictCluster) {
    evidenceSource = 'DISTRICT_TYPE_FALLBACK';
    confidence = 0.5;
  }

  return {
    weakEvidenceRatio: Number(weakEvidenceRatio.toFixed(3)),
    evidenceSource,
    confidence,
  };
}
