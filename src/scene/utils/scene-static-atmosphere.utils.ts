import {
  SceneDetail,
  SceneStaticAtmosphereProfile,
} from '../types/scene.types';

const HIGH_EMISSIVE_THRESHOLD = 0.7;

export function resolveSceneStaticAtmosphereProfile(
  detail: Pick<SceneDetail, 'signageClusters' | 'facadeHints'>,
): SceneStaticAtmosphereProfile {
  const prominentSignageCount = detail.signageClusters.filter(
    (cluster) => cluster.emissiveStrength >= HIGH_EMISSIVE_THRESHOLD,
  ).length;
  const luminousFacadeCount = detail.facadeHints.filter(
    (hint) => hint.emissiveStrength >= HIGH_EMISSIVE_THRESHOLD,
  ).length;
  const luminousSignal = prominentSignageCount + luminousFacadeCount;

  if (luminousSignal >= 8) {
    return {
      preset: 'NIGHT_NEON',
      emissiveBoost: 1.25,
      roadRoughnessScale: 0.9,
    };
  }

  if (luminousSignal >= 3) {
    return {
      preset: 'EVENING_BALANCED',
      emissiveBoost: 1.1,
      roadRoughnessScale: 0.95,
    };
  }

  return {
    preset: 'DAY_CLEAR',
    emissiveBoost: 1,
    roadRoughnessScale: 1,
  };
}
