import type { MapillaryClient } from '../../../places/clients/mapillary.client';
import type { Coordinate, BuildingData } from '../../../places/types/place.types';
import type {
  EvidenceStrength,
  SceneFacadeHint,
} from '../../types/scene.types';
import { distanceMeters, uniquePalette } from './scene-facade-vision.utils';
import { getImageAverageColorHex } from './scene-facade-image-color.utils';

export function summarizeMapillarySignals(
  anchor: Coordinate,
  images: Awaited<ReturnType<MapillaryClient['getNearbyImages']>>,
  features: Awaited<ReturnType<MapillaryClient['getMapFeatures']>>,
): {
  signageDensityScore: number;
  roadMarkingComplexityScore: number;
  trafficLightDensityScore: number;
  treeDensityScore: number;
  nightlifeIntensityScore: number;
  commercialIntensityScore: number;
  glassLikelihoodScore: number;
} {
  const nearbyImages = images.filter(
    (image) => distanceMeters(anchor, image.location) <= 45,
  ).length;
  const nearbyFeatures = features.filter(
    (feature) => distanceMeters(anchor, feature.location) <= 35,
  );

  const signageFeatures = nearbyFeatures.filter((feature) => {
    const type = feature.type.toLowerCase();
    return (
      type.includes('sign') ||
      type.includes('billboard') ||
      type.includes('shop')
    );
  }).length;
  const roadMarkingFeatures = nearbyFeatures.filter((feature) => {
    const type = feature.type.toLowerCase();
    return (
      type.includes('lane') ||
      type.includes('crosswalk') ||
      type.includes('marking') ||
      type.includes('arrow')
    );
  }).length;
  const trafficLightFeatures = nearbyFeatures.filter((feature) => {
    const type = feature.type.toLowerCase();
    return type.includes('traffic_light') || type.includes('signal');
  }).length;
  const treeFeatures = nearbyFeatures.filter((feature) => {
    const type = feature.type.toLowerCase();
    return (
      type.includes('tree') ||
      type.includes('vegetation') ||
      type.includes('plant')
    );
  }).length;
  const nightlifeFeatures = nearbyFeatures.filter((feature) => {
    const type = feature.type.toLowerCase();
    return (
      type.includes('bar') ||
      type.includes('pub') ||
      type.includes('club') ||
      type.includes('neon')
    );
  }).length;
  const commercialFeatures = nearbyFeatures.filter((feature) => {
    const type = feature.type.toLowerCase();
    return (
      type.includes('shop') ||
      type.includes('retail') ||
      type.includes('restaurant') ||
      type.includes('commercial')
    );
  }).length;
  const glassFeatures = nearbyFeatures.filter((feature) => {
    const type = feature.type.toLowerCase();
    return (
      type.includes('glass') ||
      type.includes('window') ||
      type.includes('facade')
    );
  }).length;

  const denominator = Math.max(1, nearbyImages + nearbyFeatures.length * 0.25);

  return {
    signageDensityScore: clampScore(signageFeatures / denominator),
    roadMarkingComplexityScore: clampScore(roadMarkingFeatures / denominator),
    trafficLightDensityScore: clampScore(trafficLightFeatures / denominator),
    treeDensityScore: clampScore(treeFeatures / denominator),
    nightlifeIntensityScore: clampScore(nightlifeFeatures / denominator),
    commercialIntensityScore: clampScore(commercialFeatures / denominator),
    glassLikelihoodScore: clampScore(glassFeatures / denominator),
  };
}

export function extractDominantFacadeColor(
  anchor: Coordinate,
  images: Awaited<ReturnType<MapillaryClient['getNearbyImages']>>,
): Promise<string | null> {
  const nearest = images
    .map((image) => ({
      image,
      distance: distanceMeters(anchor, image.location),
    }))
    .sort((a, b) => a.distance - b.distance)
    .find((item) => item.distance <= 30);
  if (!nearest) {
    return Promise.resolve(null);
  }
  return Promise.resolve(getImageAverageColorHex(nearest.image));
}

export function applyWeakEvidencePaletteDrift(input: {
  buildingId: string;
  weakEvidence: boolean;
  hasExplicitColor: boolean;
  districtProfile: string;
  palette: string[];
  shellPalette: string[];
  panelPalette: string[];
  explicitSignalBoost: {
    signageDensityBoost: number;
    emissiveBoost: number;
    evidenceBoost: number;
  };
}): {
  palette: string[];
  shellPalette: string[];
  panelPalette: string[];
  contextualUpgradeBoost: boolean;
} {
  if (!input.weakEvidence || input.hasExplicitColor) {
    return {
      palette: input.palette,
      shellPalette: input.shellPalette,
      panelPalette: input.panelPalette,
      contextualUpgradeBoost: false,
    };
  }

  const districtSeed = resolveWeakEvidenceDistrictPalette(
    input.districtProfile,
  );
  const variant =
    districtSeed[stableVariant(input.buildingId, districtSeed.length)];
  const shellBase = input.shellPalette[0] ?? input.palette[0] ?? variant[0];
  const shellSecondary =
    input.shellPalette[1] ?? input.palette[1] ?? variant[1];
  const shellPrimaryDrift = mixHex(shellBase, variant[0], 0.24);
  const shellSecondaryDrift = mixHex(shellSecondary, variant[1], 0.22);
  const saturationMix = clamp(
    0.18 + input.explicitSignalBoost.signageDensityBoost * 0.18,
    0.12,
    0.44,
  );
  const vividVariant = mixHex(variant[0], '#ffd166', saturationMix);
  const extraVariant = resolveAdditionalWeakEvidenceAccent(
    input.buildingId,
    input.districtProfile,
    variant,
  );
  const shadowVariant = mixHex(variant[1], '#2f3846', 0.18);
  const panelPalette = uniquePalette(
    [
      vividVariant,
      mixHex(variant[1], '#6bc2ff', saturationMix * 0.8),
      variant[2],
      extraVariant,
      shadowVariant,
      ...input.panelPalette,
    ],
    5,
  );
  const palette = uniquePalette(
    [
      shellPrimaryDrift,
      shellSecondaryDrift,
      mixHex(
        variant[2],
        '#f8f5ee',
        input.explicitSignalBoost.evidenceBoost * 0.2,
      ),
      mixHex(variant[0], '#c9d5e7', 0.22),
      ...input.palette,
    ],
    5,
  );
  const shellPalette = uniquePalette(
    [
      shellPrimaryDrift,
      shellSecondaryDrift,
      mixHex(variant[2], '#f1efe9', 0.18),
      mixHex(variant[1], '#8aa4bf', 0.2),
      ...input.shellPalette,
    ],
    5,
  );

  return {
    palette,
    shellPalette,
    panelPalette,
    contextualUpgradeBoost: true,
  };
}

export function resolveExplicitSignalBoost(
  building: BuildingData,
  mapillarySignalSummary: {
    signageDensityScore: number;
    roadMarkingComplexityScore: number;
    trafficLightDensityScore: number;
    treeDensityScore: number;
    nightlifeIntensityScore: number;
    commercialIntensityScore: number;
    glassLikelihoodScore: number;
  },
): {
  signageDensityBoost: number;
  emissiveBoost: number;
  evidenceBoost: number;
} {
  const commercial =
    building.usage === 'COMMERCIAL'
      ? 1
      : building.usage === 'MIXED'
        ? 0.7
        : 0.4;
  const signageDensityBoost = clamp(
    mapillarySignalSummary.signageDensityScore * 0.55 +
      mapillarySignalSummary.commercialIntensityScore * 0.35 +
      mapillarySignalSummary.nightlifeIntensityScore * 0.25,
    0,
    1,
  );
  const emissiveBoost = clamp(
    mapillarySignalSummary.nightlifeIntensityScore * 0.6 +
      mapillarySignalSummary.signageDensityScore * 0.3 +
      commercial * 0.2,
    0,
    1,
  );
  const evidenceBoost = clamp(
    mapillarySignalSummary.trafficLightDensityScore * 0.25 +
      mapillarySignalSummary.roadMarkingComplexityScore * 0.25 +
      mapillarySignalSummary.glassLikelihoodScore * 0.3 +
      commercial * 0.2,
    0,
    1,
  );
  return {
    signageDensityBoost,
    emissiveBoost,
    evidenceBoost,
  };
}

export function resolveEvidenceStrengthFromScore(score: number): EvidenceStrength {
  if (score >= 2.6) {
    return 'strong';
  }
  if (score >= 1.6) {
    return 'medium';
  }
  if (score >= 0.6) {
    return 'weak';
  }
  return 'none';
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(1, Number(value.toFixed(3))));
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function stableVariant(seed: string, modulo: number): number {
  if (modulo <= 0) {
    return 0;
  }
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return hash % modulo;
}

function resolveAdditionalWeakEvidenceAccent(
  buildingId: string,
  districtProfile: string,
  variant: [string, string, string],
): string {
  const candidatePool =
    districtProfile === 'NEON_CORE'
      ? ['#ff6b6b', '#5cc8ff', '#ffd166', '#8b5cf6']
      : districtProfile === 'COMMERCIAL_STRIP'
        ? ['#4cc9f0', '#f8961e', '#90be6d', '#577590']
        : districtProfile === 'TRANSIT_HUB'
          ? ['#8fa8bf', '#c6d0d8', '#7f8c99', '#b2c1cf']
          : ['#9db5c2', '#c7b8a9', '#a6b39f', '#b2a8bc'];
  const picked =
    candidatePool[
      stableVariant(`${buildingId}:weak-extra`, candidatePool.length)
    ] ?? candidatePool[0];
  return mixHex(variant[0], picked, 0.32);
}

function resolveWeakEvidenceDistrictPalette(
  districtProfile: string,
): [string, string, string][] {
  if (districtProfile === 'NEON_CORE') {
    return [
      ['#314f6e', '#94b4cd', '#f4f1df'],
      ['#4b4668', '#a6a2cd', '#f0ede3'],
      ['#5a4250', '#c39ab0', '#f4ece2'],
      ['#314f53', '#7fb9b8', '#f5f0e5'],
    ];
  }
  if (districtProfile === 'COMMERCIAL_STRIP') {
    return [
      ['#4a5e72', '#a3bdd1', '#f1eee7'],
      ['#6a594c', '#bda98d', '#f3eee6'],
      ['#5f4f69', '#b09cc1', '#efe9e1'],
      ['#3f5f57', '#97bfad', '#f0ede4'],
    ];
  }
  if (districtProfile === 'TRANSIT_HUB') {
    return [
      ['#5c6673', '#b7c0ca', '#ecebe7'],
      ['#6d645a', '#c2b6aa', '#f1ece4'],
      ['#536273', '#a8b9c9', '#eceae4'],
      ['#5f5a67', '#b3acbf', '#ece8e0'],
    ];
  }
  return [
    ['#6a6f78', '#bfc4cb', '#eceae3'],
    ['#746b61', '#c5baad', '#efeae1'],
    ['#5f6e6d', '#aec0be', '#ece8e1'],
    ['#6f6671', '#b9b0bd', '#ece8e0'],
  ];
}

function mixHex(source: string, target: string, ratio: number): string {
  const t = clamp(ratio, 0, 1);
  const [sr, sg, sb] = hexToRgb(source);
  const [tr, tg, tb] = hexToRgb(target);
  return toHex([
    Math.round(sr + (tr - sr) * t),
    Math.round(sg + (tg - sg) * t),
    Math.round(sb + (tb - sb) * t),
  ]);
}

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace('#', '');
  const full =
    normalized.length === 3
      ? normalized
          .split('')
          .map((char) => `${char}${char}`)
          .join('')
      : normalized;
  const value = Number.parseInt(full, 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function toHex(rgb: [number, number, number]): string {
  return `#${rgb
    .map((channel) => clamp(channel, 0, 255).toString(16).padStart(2, '0'))
    .join('')}`;
}
