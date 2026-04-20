import type {
  BuildingFacadeSpec,
  BuildingPodiumSpec,
  BuildingRoofSpec,
  BuildingSignageSpec,
  SceneMeta,
} from '../../types/scene.types';
import type { LandmarkAnnotationManifest } from '../../types/scene.types';

export function buildHeroEnhancement(
  building: SceneMeta['buildings'][number],
  annotation: LandmarkAnnotationManifest['landmarks'][number],
): {
  baseMass: SceneMeta['buildings'][number]['baseMass'];
  podiumSpec?: BuildingPodiumSpec;
  signageSpec?: BuildingSignageSpec;
  roofSpec?: BuildingRoofSpec;
  facadeSpec?: BuildingFacadeSpec;
} {
  const dominantEdgeIndex = resolveLongestEdgeIndex(building.outerRing);
  const adjacentEdgeIndex =
    (dominantEdgeIndex + 1) % Math.max(1, building.outerRing.length);
  const heroPrimary = annotation.importance === 'primary';
  const visualRole =
    annotation.facadeHint?.visualRole ??
    (heroPrimary ? 'hero_landmark' : 'edge_landmark');
  const signBandLevels = heroPrimary
    ? Math.max(3, building.signBandLevels ?? 3)
    : (() => {
        const existing = building.signBandLevels ?? 2;
        return existing > 2 ? existing - 1 : existing;
      })();
  const podiumSpec: BuildingPodiumSpec | undefined =
    annotation.kind === 'BUILDING'
      ? {
          levels: 3,
          setbacks: heroPrimary ? 2 : 2,
          cornerChamfer: building.cornerChamfer ?? heroPrimary,
          canopyEdges:
            visualRole === 'hero_landmark' || visualRole === 'retail_edge'
              ? [dominantEdgeIndex, adjacentEdgeIndex]
              : [dominantEdgeIndex],
        }
      : undefined;
  const signageSpec: BuildingSignageSpec | undefined =
    annotation.kind === 'BUILDING'
      ? {
          billboardFaces: [dominantEdgeIndex],
          signBandLevels,
          screenFaces: [dominantEdgeIndex],
          emissiveZones: heroPrimary ? 4 : 2,
        }
      : undefined;
  const roofSpec: BuildingRoofSpec | undefined =
    annotation.kind === 'BUILDING'
      ? {
          roofUnits: heroPrimary ? 4 : 3,
          crownType: 'parapet_crown',
          parapet: true,
        }
      : undefined;
  const facadeSpec: BuildingFacadeSpec | undefined =
    annotation.kind === 'BUILDING'
      ? {
          atlasId: `${annotation.id}-facade`,
          uvMode: 'placeholder',
          emissiveMaskId: heroPrimary ? `${annotation.id}-emissive` : null,
          facadePattern:
            visualRole === 'station_edge'
              ? 'retail_screen'
              : visualRole === 'retail_edge'
                ? 'retail_screen'
                : 'midrise_grid',
          lowerBandType:
            visualRole === 'station_edge' ? 'screen_band' : 'retail_sign_band',
          midBandType:
            building.facadePreset === 'glass_grid'
              ? 'window_grid'
              : 'solid_panel',
          topBandType: 'window_grid',
          windowRepeatX: heroPrimary ? 8 : 7,
          windowRepeatY: heroPrimary ? 10 : 10,
        }
      : undefined;

  return {
    baseMass: heroPrimary
      ? 'corner_tower'
      : (building.baseMass ?? 'podium_tower'),
    podiumSpec,
    signageSpec,
    roofSpec,
    facadeSpec,
  };
}

function resolveLongestEdgeIndex(ring: { lat: number; lng: number }[]): number {
  if (ring.length < 2) {
    return 0;
  }
  let longestIndex = 0;
  let longestLength = 0;
  for (let index = 0; index < ring.length; index += 1) {
    const current = ring[index];
    const next = ring[(index + 1) % ring.length];
    const length = Math.hypot(next.lng - current.lng, next.lat - current.lat);
    if (length > longestLength) {
      longestLength = length;
      longestIndex = index;
    }
  }
  return longestIndex;
}
