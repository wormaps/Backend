import {
  SceneDetail,
  SceneStaticAtmosphereProfile,
} from '../types/scene.types';
import type { PlaceCharacter } from '../domain/place-character.value-object';

const HIGH_EMISSIVE_THRESHOLD = 0.7;

const DISTRICT_ATMOSPHERE_TABLE: Record<
  PlaceCharacter['districtType'],
  SceneStaticAtmosphereProfile
> = {
  ELECTRONICS_DISTRICT: {
    preset: 'NIGHT_NEON',
    emissiveBoost: 1.8,
    roadRoughnessScale: 0.85,
    wetRoadBoost: 0.35,
  },
  SHOPPING_SCRAMBLE: {
    preset: 'NIGHT_NEON',
    emissiveBoost: 2.0,
    roadRoughnessScale: 0.88,
    wetRoadBoost: 0.4,
  },
  OFFICE_DISTRICT: {
    preset: 'DAY_CLEAR',
    emissiveBoost: 0.95,
    roadRoughnessScale: 1.0,
    wetRoadBoost: 0,
  },
  RESIDENTIAL: {
    preset: 'EVENING_BALANCED',
    emissiveBoost: 0.75,
    roadRoughnessScale: 1.05,
    wetRoadBoost: 0.1,
  },
  TRANSIT_HUB: {
    preset: 'EVENING_BALANCED',
    emissiveBoost: 1.2,
    roadRoughnessScale: 0.92,
    wetRoadBoost: 0.15,
  },
  GENERIC: {
    preset: 'DAY_CLEAR',
    emissiveBoost: 1,
    roadRoughnessScale: 1,
    wetRoadBoost: 0,
  },
};

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
      wetRoadBoost: 0.45,
    };
  }

  if (luminousSignal >= 3) {
    return {
      preset: 'EVENING_BALANCED',
      emissiveBoost: 1.1,
      roadRoughnessScale: 0.95,
      wetRoadBoost: 0.22,
    };
  }

  return {
    preset: 'DAY_CLEAR',
    emissiveBoost: 1,
    roadRoughnessScale: 1,
    wetRoadBoost: 0,
  };
}

export function resolveDistrictAtmosphereFromPlaceCharacter(
  character: PlaceCharacter,
): SceneStaticAtmosphereProfile {
  const base = DISTRICT_ATMOSPHERE_TABLE[character.districtType];

  const signageAdjustment =
    character.signageDensity === 'DENSE'
      ? 0.15
      : character.signageDensity === 'SPARSE'
        ? -0.1
        : 0;

  const eraAdjustment =
    character.buildingEra === 'SHOWA_1960_80'
      ? -0.1
      : character.buildingEra === 'MODERN_POST2000'
        ? 0.05
        : 0;

  return {
    ...base,
    emissiveBoost: clamp(base.emissiveBoost + signageAdjustment + eraAdjustment, 0.6, 2.2),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
