import type { LandCoverData } from '../../../places/types/place.types';

export type GroundMaterialProfile = {
  baseColor: [number, number, number, number];
  metallic: number;
  roughness: number;
};

const GROUND_PROFILES: Record<string, GroundMaterialProfile> = {
  paved: {
    baseColor: [0.18, 0.18, 0.2, 1],
    metallic: 0,
    roughness: 0.9,
  },
  grass: {
    baseColor: [0.28, 0.52, 0.22, 1],
    metallic: 0,
    roughness: 1.0,
  },
  water: {
    baseColor: [0.22, 0.42, 0.62, 1],
    metallic: 0.1,
    roughness: 0.0,
  },
  sand: {
    baseColor: [0.76, 0.68, 0.5, 1],
    metallic: 0,
    roughness: 1.0,
  },
};

const DEFAULT_PROFILE: GroundMaterialProfile = GROUND_PROFILES['sand']!;

const LANDUSE_TO_GROUND: Record<string, string> = {
  grass: 'grass',
  meadow: 'grass',
  park: 'grass',
  garden: 'grass',
  recreation_ground: 'grass',
  village_green: 'grass',
  water: 'water',
  reservoir: 'water',
  basin: 'water',
  river: 'water',
  paved: 'paved',
  asphalt: 'paved',
  road: 'paved',
  pedestrian: 'paved',
  plaza: 'paved',
  square: 'paved',
  sand: 'sand',
  beach: 'sand',
  bare_rock: 'sand',
  scrub: 'grass',
  forest: 'grass',
  wood: 'grass',
};

export function resolveGroundMaterialProfile(
  landCovers: LandCoverData[],
): GroundMaterialProfile {
  if (landCovers.length === 0) {
    return DEFAULT_PROFILE;
  }

  const typeCounts: Record<string, number> = {};
  for (const lc of landCovers) {
    const groundType = mapLandCoverToGroundType(lc);
    typeCounts[groundType] = (typeCounts[groundType] ?? 0) + 1;
  }

  let dominantType = 'sand';
  let maxCount = 0;
  for (const [type, count] of Object.entries(typeCounts)) {
    if (count > maxCount) {
      maxCount = count;
      dominantType = type;
    }
  }

  return GROUND_PROFILES[dominantType] ?? DEFAULT_PROFILE;
}

function mapLandCoverToGroundType(landCover: LandCoverData): string {
  const lcType = landCover.type.toLowerCase();
  if (lcType === 'water') return 'water';
  if (lcType === 'park') return 'grass';
  if (lcType === 'plaza') return 'paved';
  return 'sand';
}
