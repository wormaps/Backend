import type {
  Coordinate,
  PlacePackage,
} from '../../../places/types/place.types';
import type {
  BuildingFacadeProfile,
  DistrictAtmosphereProfile,
  DistrictCluster,
  EvidenceStrength,
  LightingAtmosphereProfile,
  RoadAtmosphereProfile,
  SceneWideAtmosphereProfile,
  StreetAtmosphereProfile,
  VegetationProfile,
  WeatherMoodOverlay,
} from '../../types/scene.types';
import type {
  BuildingAnchorContext,
  FacadeContext,
} from './scene-facade-vision.context.utils';
import type {
  PlaceCharacter,
  PlaceCharacterDistrictType,
} from '../../domain/place-character.value-object';

export interface DistrictSignalInput {
  building: PlacePackage['buildings'][number];
  anchor: Coordinate;
  placeCenter: Coordinate;
  context: FacadeContext;
  buildingAnchors: BuildingAnchorContext[];
  mapillarySignals: {
    nearbyImageCount: number;
    nearbyFeatureCount: number;
    signageDensityScore: number;
    roadMarkingComplexityScore: number;
    trafficLightDensityScore: number;
    treeDensityScore: number;
    nightlifeIntensityScore: number;
    commercialIntensityScore: number;
    glassLikelihoodScore: number;
  };
}

export function resolveDistrictCluster(input: DistrictSignalInput): {
  cluster: DistrictCluster;
  confidence: number;
  evidenceStrength: EvidenceStrength;
} {
  const { building, context, mapillarySignals } = input;
  const score: Record<DistrictCluster, number> = {
    core_commercial: 0,
    secondary_retail: 0,
    office_mixed: 0,
    luxury_residential: 0,
    old_residential: 0,
    industrial_lowrise: 0,
    nightlife_cluster: 0,
    station_district: 0,
    green_park_edge: 0,
    riverside_lowrise: 0,
    suburban_detached: 0,
    coastal_road: 0,
    mountain_slope_settlement: 0,
    temple_shrine_district: 0,
    university_district: 0,
    airport_logistics: 0,
    landmark_plaza: 0,
    stadium_zone: 0,
    tourist_shopping_street: 0,
  };

  if (context.districtProfile === 'NEON_CORE') {
    score.core_commercial += 2.2;
    score.nightlife_cluster += 1.4;
    score.tourist_shopping_street += 1.0;
  }
  if (context.districtProfile === 'COMMERCIAL_STRIP') {
    score.secondary_retail += 1.7;
    score.office_mixed += 1.1;
  }
  if (context.districtProfile === 'TRANSIT_HUB') {
    score.station_district += 2.4;
    score.airport_logistics += 1.0;
  }
  if (context.districtProfile === 'CIVIC_CLUSTER') {
    score.landmark_plaza += 1.7;
    score.university_district += 0.9;
  }
  if (context.districtProfile === 'RESIDENTIAL_EDGE') {
    score.old_residential += 1.1;
    score.suburban_detached += 1.2;
  }

  if (building.usage === 'COMMERCIAL') {
    score.core_commercial += 1.2;
    score.secondary_retail += 1.4;
    score.tourist_shopping_street += 1.1;
  }
  if (building.usage === 'TRANSIT') {
    score.station_district += 1.8;
    score.airport_logistics += 1.2;
  }
  if (building.usage === 'PUBLIC') {
    score.landmark_plaza += 1.0;
    score.university_district += 0.8;
    score.temple_shrine_district += 0.7;
    score.stadium_zone += 0.6;
  }

  if (building.heightMeters >= 45) {
    score.office_mixed += 1.2;
    score.core_commercial += 0.8;
    score.luxury_residential += 0.6;
  } else if (building.heightMeters <= 14) {
    score.old_residential += 0.8;
    score.suburban_detached += 1.0;
    score.industrial_lowrise += 0.7;
  }

  if (context.poiNeighborCount >= 4) {
    score.tourist_shopping_street += 1.2;
    score.landmark_plaza += 0.8;
  }
  if (context.landmarkNeighborCount >= 2) {
    score.landmark_plaza += 1.0;
    score.temple_shrine_district += 0.8;
  }
  if (context.arterialRoadCount >= 2) {
    score.station_district += 0.8;
    score.industrial_lowrise += 0.7;
    score.airport_logistics += 0.6;
  }

  score.nightlife_cluster += mapillarySignals.nightlifeIntensityScore * 1.5;
  score.tourist_shopping_street += mapillarySignals.signageDensityScore * 1.2;
  score.core_commercial += mapillarySignals.commercialIntensityScore * 1.0;
  score.office_mixed += mapillarySignals.glassLikelihoodScore * 0.9;
  score.green_park_edge += mapillarySignals.treeDensityScore * 1.2;
  score.riverside_lowrise += mapillarySignals.treeDensityScore * 0.6;
  score.secondary_retail += mapillarySignals.roadMarkingComplexityScore * 0.6;
  score.station_district += mapillarySignals.trafficLightDensityScore * 0.8;

  const entries = Object.entries(score) as Array<[DistrictCluster, number]>;
  entries.sort((a, b) => b[1] - a[1]);
  const firstEntry = entries[0];
  if (!firstEntry) {
    return { cluster: 'secondary_retail', confidence: 0.35, evidenceStrength: 'weak' };
  }
  const [bestCluster, bestScore] = firstEntry;
  const secondScore = entries[1]?.[1] ?? 0;

  const margin = Math.max(0, bestScore - secondScore);
  const confidence = clamp(0.35 + margin * 0.18 + bestScore * 0.03, 0, 1);

  const evidenceStrength = resolveEvidenceStrength(
    mapillarySignals.nearbyImageCount,
    mapillarySignals.nearbyFeatureCount,
    confidence,
  );

  return {
    cluster: bestCluster,
    confidence,
    evidenceStrength,
  };
}

export function resolveSceneWideAtmosphereProfile(
  districtProfiles: DistrictAtmosphereProfile[],
): SceneWideAtmosphereProfile {
  if (districtProfiles.length === 0) {
    return {
      cityTone: 'balanced_mixed',
      evidenceStrength: 'none',
      baseFacadeProfile: fallbackFacadeProfile('none'),
      streetAtmosphere: 'residential_quiet',
      vegetationProfile: 'urban_minimal_green',
      roadProfile: 'wide_arterial',
      lightingProfile: 'bright_daylight',
      weatherOverlay: 'sunny_clear',
    };
  }

  const byCluster = new Map<DistrictCluster, number>();
  let totalDistrictWeight = 0;
  const atmosphereVotes = {
    street: new Map<StreetAtmosphereProfile, number>(),
    vegetation: new Map<VegetationProfile, number>(),
    road: new Map<RoadAtmosphereProfile, number>(),
    lighting: new Map<LightingAtmosphereProfile, number>(),
    weather: new Map<WeatherMoodOverlay, number>(),
  };
  const weightedFacadeFamilies = new Map<
    BuildingFacadeProfile['family'],
    number
  >();
  const weightedFacadeVariants = new Map<
    BuildingFacadeProfile['variant'],
    number
  >();
  const weightedFacadePatterns = new Map<
    BuildingFacadeProfile['pattern'],
    number
  >();
  const weightedRoofStyles = new Map<
    BuildingFacadeProfile['roofStyle'],
    number
  >();
  const weightedSignDensity = new Map<
    NonNullable<BuildingFacadeProfile['signDensity']>,
    number
  >();
  const weightedWindowDensity = new Map<
    NonNullable<BuildingFacadeProfile['windowDensity']>,
    number
  >();
  const weightedLightingStyle = new Map<
    NonNullable<BuildingFacadeProfile['lightingStyle']>,
    number
  >();
  let weightedEmissiveBoost = 0;
  let evidenceScore = 0;

  for (const profile of districtProfiles) {
    const districtWeight =
      Math.max(1, profile.buildingCount) * clamp(profile.confidence, 0.15, 1);
    totalDistrictWeight += districtWeight;

    byCluster.set(
      profile.districtCluster,
      (byCluster.get(profile.districtCluster) ?? 0) + districtWeight,
    );
    evidenceScore += evidenceRank(profile.evidenceStrength) * districtWeight;

    accumulateVote(
      atmosphereVotes.street,
      profile.streetAtmosphere,
      districtWeight,
    );
    accumulateVote(
      atmosphereVotes.vegetation,
      profile.vegetationProfile,
      districtWeight,
    );
    accumulateVote(atmosphereVotes.road, profile.roadProfile, districtWeight);
    accumulateVote(
      atmosphereVotes.lighting,
      profile.lightingProfile,
      districtWeight,
    );
    accumulateVote(
      atmosphereVotes.weather,
      profile.weatherOverlay,
      districtWeight,
    );

    accumulateVote(
      weightedFacadeFamilies,
      profile.facadeProfile.family,
      districtWeight,
    );
    accumulateVote(
      weightedFacadeVariants,
      profile.facadeProfile.variant,
      districtWeight,
    );
    accumulateVote(
      weightedFacadePatterns,
      profile.facadeProfile.pattern,
      districtWeight,
    );
    accumulateVote(
      weightedRoofStyles,
      profile.facadeProfile.roofStyle,
      districtWeight,
    );

    if (profile.facadeProfile.signDensity) {
      accumulateVote(
        weightedSignDensity,
        profile.facadeProfile.signDensity,
        districtWeight,
      );
    }
    if (profile.facadeProfile.windowDensity) {
      accumulateVote(
        weightedWindowDensity,
        profile.facadeProfile.windowDensity,
        districtWeight,
      );
    }
    if (profile.facadeProfile.lightingStyle) {
      accumulateVote(
        weightedLightingStyle,
        profile.facadeProfile.lightingStyle,
        districtWeight,
      );
    }

    weightedEmissiveBoost +=
      (profile.facadeProfile.emissiveBoost ?? 1) * districtWeight;
  }

  const dominantClusterEntry = [...byCluster.entries()].sort(
    (a, b) => b[1] - a[1],
  )[0];
  const dominantCluster = dominantClusterEntry?.[0];
  const meanEvidence = evidenceScore / Math.max(1, totalDistrictWeight);
  const sceneEvidence =
    meanEvidence >= 2.6
      ? 'strong'
      : meanEvidence >= 1.8
        ? 'medium'
        : meanEvidence >= 1
          ? 'weak'
          : 'none';

  const cityTone = mapClusterToCityTone(dominantCluster);
  const fallback = fallbackFacadeProfile(sceneEvidence);
  const baseFacadeProfile: BuildingFacadeProfile = {
    ...fallback,
    family: resolveDominantByWeight(weightedFacadeFamilies) ?? fallback.family,
    variant:
      resolveDominantByWeight(weightedFacadeVariants) ?? fallback.variant,
    pattern:
      resolveDominantByWeight(weightedFacadePatterns) ?? fallback.pattern,
    roofStyle:
      resolveDominantByWeight(weightedRoofStyles) ?? fallback.roofStyle,
    evidence: sceneEvidence,
    emissiveBoost: clamp(
      weightedEmissiveBoost / Math.max(1, totalDistrictWeight),
      0.7,
      1.4,
    ),
    signDensity:
      resolveDominantByWeight(weightedSignDensity) ?? fallback.signDensity,
    windowDensity:
      resolveDominantByWeight(weightedWindowDensity) ?? fallback.windowDensity,
    lightingStyle:
      resolveDominantByWeight(weightedLightingStyle) ?? fallback.lightingStyle,
  };

  return {
    cityTone,
    evidenceStrength: sceneEvidence,
    baseFacadeProfile,
    streetAtmosphere:
      resolveDominantByWeight(atmosphereVotes.street) ?? 'residential_quiet',
    vegetationProfile:
      resolveDominantByWeight(atmosphereVotes.vegetation) ??
      'urban_minimal_green',
    roadProfile:
      resolveDominantByWeight(atmosphereVotes.road) ?? 'wide_arterial',
    lightingProfile:
      resolveDominantByWeight(atmosphereVotes.lighting) ?? 'bright_daylight',
    weatherOverlay:
      resolveDominantByWeight(atmosphereVotes.weather) ?? 'sunny_clear',
  };
}

export function resolveDistrictAtmosphereProfile(
  cluster: DistrictCluster,
  confidence: number,
  evidenceStrength: EvidenceStrength,
): DistrictAtmosphereProfile {
  const facadeProfile = resolveClusterFacadeProfile(cluster, evidenceStrength);
  return {
    districtCluster: cluster,
    confidence,
    evidenceStrength,
    buildingCount: 1,
    facadeProfile,
    streetAtmosphere: resolveStreetAtmosphere(cluster),
    vegetationProfile: resolveVegetationProfile(cluster),
    roadProfile: resolveRoadProfile(cluster),
    lightingProfile: resolveLightingProfile(cluster),
    weatherOverlay: resolveWeatherOverlay(cluster),
  };
}

function resolveClusterFacadeProfile(
  cluster: DistrictCluster,
  evidenceStrength: EvidenceStrength,
): BuildingFacadeProfile {
  const fallback = fallbackFacadeProfile(evidenceStrength);
  const profileMap: Record<DistrictCluster, BuildingFacadeProfile> = {
    core_commercial: {
      family: 'panel',
      variant: 'metal_station_silver',
      pattern: 'retail_screen',
      roofStyle: 'flat',
      evidence: evidenceStrength,
      emissiveBoost: 1.3,
      signDensity: 'high',
      windowDensity: 'dense',
      podiumStyle: 'retail',
      entranceEmphasis: 'high',
      roofEquipmentIntensity: 'medium',
      lightingStyle: 'neon_night',
    },
    secondary_retail: {
      family: 'mixed',
      variant: 'mixed_neutral_light',
      pattern: 'podium_retail',
      roofStyle: 'flat',
      evidence: evidenceStrength,
      emissiveBoost: 1.15,
      signDensity: 'medium',
      windowDensity: 'medium',
      podiumStyle: 'retail',
      canopyType: 'awning',
      lightingStyle: 'warm_evening',
    },
    office_mixed: {
      family: 'glass',
      variant: 'glass_reflective_blue',
      pattern: 'vertical_mullion',
      roofStyle: 'setback',
      evidence: evidenceStrength,
      emissiveBoost: 0.95,
      signDensity: 'low',
      windowDensity: 'dense',
      podiumStyle: 'compact',
      roofEquipmentIntensity: 'medium',
      lightingStyle: 'bright_daylight',
    },
    luxury_residential: {
      family: 'stone',
      variant: 'stone_luxury_beige',
      pattern: 'repetitive_windows',
      roofStyle: 'rooftop_garden',
      evidence: evidenceStrength,
      emissiveBoost: 0.82,
      signDensity: 'low',
      windowDensity: 'medium',
      balconyType: 'continuous',
      entranceEmphasis: 'high',
      lightingStyle: 'luxury_warm',
    },
    old_residential: {
      family: 'concrete',
      variant: 'concrete_old_gray',
      pattern: 'old_apartment_balcony',
      roofStyle: 'flat',
      evidence: evidenceStrength,
      emissiveBoost: 0.72,
      signDensity: 'low',
      windowDensity: 'sparse',
      balconyType: 'stacked',
      lightingStyle: 'overcast_soft',
    },
    industrial_lowrise: {
      family: 'metal',
      variant: 'metal_industrial_dark',
      pattern: 'industrial_panel',
      roofStyle: 'industrial_sawtooth',
      evidence: evidenceStrength,
      emissiveBoost: 0.65,
      signDensity: 'low',
      windowDensity: 'sparse',
      roofEquipmentIntensity: 'high',
      lightingStyle: 'industrial_cold',
    },
    nightlife_cluster: {
      family: 'mixed',
      variant: 'mixed_neutral_light',
      pattern: 'shopping_arcade',
      roofStyle: 'flat',
      evidence: evidenceStrength,
      emissiveBoost: 1.35,
      signDensity: 'high',
      windowDensity: 'medium',
      canopyType: 'arcade',
      lightingStyle: 'nightlife_emissive',
    },
    station_district: {
      family: 'metal',
      variant: 'metal_station_silver',
      pattern: 'vertical_mullion',
      roofStyle: 'mechanical_heavy',
      evidence: evidenceStrength,
      emissiveBoost: 1.05,
      signDensity: 'medium',
      windowDensity: 'medium',
      roofEquipmentIntensity: 'high',
      lightingStyle: 'industrial_cold',
    },
    green_park_edge: {
      family: 'plaster',
      variant: 'plaster_old_town_white',
      pattern: 'repetitive_windows',
      roofStyle: 'flat',
      evidence: evidenceStrength,
      emissiveBoost: 0.7,
      signDensity: 'low',
      windowDensity: 'sparse',
      balconyType: 'minimal',
      lightingStyle: 'park_dim',
    },
    riverside_lowrise: {
      family: 'brick',
      variant: 'brick_red_lowrise',
      pattern: 'balcony_stack',
      roofStyle: 'gable',
      evidence: evidenceStrength,
      emissiveBoost: 0.75,
      signDensity: 'low',
      windowDensity: 'sparse',
      balconyType: 'stacked',
      lightingStyle: 'warm_evening',
    },
    suburban_detached: {
      family: 'tile',
      variant: 'tile_pink_apartment',
      pattern: 'old_apartment_balcony',
      roofStyle: 'sloped_tile',
      evidence: evidenceStrength,
      emissiveBoost: 0.62,
      signDensity: 'low',
      windowDensity: 'sparse',
      canopyType: 'flat',
      lightingStyle: 'bright_daylight',
    },
    coastal_road: {
      family: 'plaster',
      variant: 'plaster_old_town_white',
      pattern: 'horizontal_band',
      roofStyle: 'flat',
      evidence: evidenceStrength,
      emissiveBoost: 0.8,
      signDensity: 'low',
      windowDensity: 'medium',
      lightingStyle: 'overcast_soft',
    },
    mountain_slope_settlement: {
      family: 'wood',
      variant: 'wood_natural',
      pattern: 'balcony_stack',
      roofStyle: 'gable',
      evidence: evidenceStrength,
      emissiveBoost: 0.66,
      signDensity: 'low',
      windowDensity: 'sparse',
      lightingStyle: 'park_dim',
    },
    temple_shrine_district: {
      family: 'wood',
      variant: 'wood_natural',
      pattern: 'temple_roof_layer',
      roofStyle: 'temple_roof',
      evidence: evidenceStrength,
      emissiveBoost: 0.7,
      signDensity: 'low',
      windowDensity: 'sparse',
      canopyType: 'arcade',
      lightingStyle: 'warm_evening',
    },
    university_district: {
      family: 'concrete',
      variant: 'concrete_warm_white',
      pattern: 'repetitive_windows',
      roofStyle: 'flat',
      evidence: evidenceStrength,
      emissiveBoost: 0.74,
      signDensity: 'low',
      windowDensity: 'medium',
      podiumStyle: 'compact',
      lightingStyle: 'bright_daylight',
    },
    airport_logistics: {
      family: 'metal',
      variant: 'metal_station_silver',
      pattern: 'warehouse_siding',
      roofStyle: 'warehouse_low_slope',
      evidence: evidenceStrength,
      emissiveBoost: 0.78,
      signDensity: 'medium',
      windowDensity: 'sparse',
      roofEquipmentIntensity: 'high',
      lightingStyle: 'industrial_cold',
    },
    landmark_plaza: {
      family: 'glass',
      variant: 'glass_cool_light',
      pattern: 'vertical_mullion',
      roofStyle: 'setback',
      evidence: evidenceStrength,
      emissiveBoost: 1.15,
      signDensity: 'medium',
      windowDensity: 'dense',
      entranceEmphasis: 'high',
      lightingStyle: 'luxury_warm',
    },
    stadium_zone: {
      family: 'metal',
      variant: 'metal_station_silver',
      pattern: 'industrial_panel',
      roofStyle: 'mechanical_heavy',
      evidence: evidenceStrength,
      emissiveBoost: 1.1,
      signDensity: 'high',
      windowDensity: 'medium',
      canopyType: 'arcade',
      lightingStyle: 'nightlife_emissive',
    },
    tourist_shopping_street: {
      family: 'tile',
      variant: 'tile_pink_apartment',
      pattern: 'shopping_arcade',
      roofStyle: 'flat',
      evidence: evidenceStrength,
      emissiveBoost: 1.2,
      signDensity: 'high',
      windowDensity: 'medium',
      canopyType: 'awning',
      lightingStyle: 'nightlife_emissive',
    },
  };

  return profileMap[cluster] ?? fallback;
}

function fallbackFacadeProfile(
  evidence: EvidenceStrength,
): BuildingFacadeProfile {
  return {
    family: 'mixed',
    variant: 'mixed_neutral_light',
    pattern: 'repetitive_windows',
    roofStyle: 'flat',
    evidence,
    emissiveBoost: 0.9,
    signDensity: 'low',
    windowDensity: 'medium',
    balconyType: 'none',
    podiumStyle: 'none',
    canopyType: 'none',
    entranceEmphasis: 'medium',
    roofEquipmentIntensity: 'low',
    lightingStyle: 'bright_daylight',
  };
}

function resolveStreetAtmosphere(
  cluster: DistrictCluster,
): StreetAtmosphereProfile {
  if (cluster === 'core_commercial' || cluster === 'secondary_retail')
    return 'dense_signage';
  if (cluster === 'nightlife_cluster' || cluster === 'tourist_shopping_street')
    return 'nightlife_dense';
  if (cluster === 'industrial_lowrise' || cluster === 'airport_logistics')
    return 'industrial_sparse';
  if (cluster === 'station_district') return 'station_busy';
  if (cluster === 'green_park_edge') return 'park_green';
  if (cluster === 'riverside_lowrise') return 'riverside_open';
  if (cluster === 'coastal_road') return 'coastal_relaxed';
  if (cluster === 'mountain_slope_settlement') return 'mountain_compact';
  if (cluster === 'luxury_residential') return 'luxury_minimal';
  return 'residential_quiet';
}

function resolveVegetationProfile(cluster: DistrictCluster): VegetationProfile {
  if (cluster === 'green_park_edge') return 'dense_tree_line';
  if (cluster === 'riverside_lowrise') return 'roadside_planters';
  if (cluster === 'coastal_road') return 'coastal_palm';
  if (cluster === 'mountain_slope_settlement') return 'mountain_shrub';
  if (cluster === 'suburban_detached') return 'residential_small_tree';
  if (cluster === 'temple_shrine_district') return 'forest_edge';
  if (cluster === 'core_commercial') return 'urban_minimal_green';
  return 'sparse_tree_line';
}

function resolveRoadProfile(cluster: DistrictCluster): RoadAtmosphereProfile {
  if (cluster === 'core_commercial') return 'dense_crosswalk';
  if (cluster === 'station_district') return 'bus_lane_heavy';
  if (cluster === 'nightlife_cluster') return 'nightlife_street';
  if (cluster === 'tourist_shopping_street') return 'shopping_street';
  if (cluster === 'industrial_lowrise' || cluster === 'airport_logistics')
    return 'industrial_truck_route';
  if (cluster === 'green_park_edge') return 'pedestrian_street';
  if (cluster === 'riverside_lowrise') return 'riverside_road';
  if (cluster === 'coastal_road') return 'coastal_drive';
  if (cluster === 'mountain_slope_settlement') return 'mountain_curve_road';
  if (cluster === 'old_residential' || cluster === 'suburban_detached')
    return 'narrow_alley';
  return 'wide_arterial';
}

function resolveLightingProfile(
  cluster: DistrictCluster,
): LightingAtmosphereProfile {
  if (cluster === 'nightlife_cluster') return 'nightlife_emissive';
  if (cluster === 'core_commercial' || cluster === 'tourist_shopping_street')
    return 'neon_night';
  if (cluster === 'luxury_residential' || cluster === 'landmark_plaza')
    return 'luxury_warm';
  if (cluster === 'industrial_lowrise' || cluster === 'airport_logistics')
    return 'industrial_cold';
  if (cluster === 'green_park_edge') return 'park_dim';
  return 'warm_evening';
}

function resolveWeatherOverlay(cluster: DistrictCluster): WeatherMoodOverlay {
  if (cluster === 'coastal_road') return 'foggy';
  if (cluster === 'mountain_slope_settlement') return 'cold_winter';
  if (cluster === 'riverside_lowrise') return 'wet_road';
  if (cluster === 'nightlife_cluster') return 'night';
  return 'sunny_clear';
}

function resolveEvidenceStrength(
  nearbyImageCount: number,
  nearbyFeatureCount: number,
  confidence: number,
): EvidenceStrength {
  if (nearbyImageCount <= 0 && nearbyFeatureCount <= 0) {
    return 'weak';
  }
  if (nearbyImageCount >= 8 && nearbyFeatureCount >= 16 && confidence >= 0.68) {
    return 'strong';
  }
  if (nearbyImageCount >= 3 && nearbyFeatureCount >= 6 && confidence >= 0.5) {
    return 'medium';
  }
  return 'weak';
}

function mapClusterToCityTone(
  cluster: DistrictCluster | undefined,
): SceneWideAtmosphereProfile['cityTone'] {
  if (!cluster) {
    return 'balanced_mixed';
  }
  if (cluster === 'core_commercial' || cluster === 'nightlife_cluster') {
    return 'dense_commercial';
  }
  if (cluster === 'secondary_retail' || cluster === 'office_mixed') {
    return 'mixed_commercial';
  }
  if (cluster === 'suburban_detached' || cluster === 'old_residential') {
    return 'suburban_residential';
  }
  if (cluster === 'industrial_lowrise' || cluster === 'airport_logistics') {
    return 'industrial_fringe';
  }
  if (cluster === 'coastal_road' || cluster === 'tourist_shopping_street') {
    return 'coastal_tourist_town';
  }
  if (
    cluster === 'mountain_slope_settlement' ||
    cluster === 'temple_shrine_district'
  ) {
    return 'mountain_village';
  }
  return 'balanced_mixed';
}

function evidenceRank(value: EvidenceStrength): number {
  if (value === 'strong') return 3;
  if (value === 'medium') return 2;
  if (value === 'weak') return 1;
  return 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function accumulateVote<T extends string>(
  target: Map<T, number>,
  key: T,
  weight: number,
): void {
  target.set(key, (target.get(key) ?? 0) + weight);
}

function resolveDominantByWeight<T extends string>(
  weights: Map<T, number>,
): T | undefined {
  let topKey: T | undefined;
  let topWeight = -1;
  for (const [key, weight] of weights.entries()) {
    if (weight > topWeight) {
      topKey = key;
      topWeight = weight;
    }
  }
  return topKey;
}

const PLACE_CHARACTER_TO_CLUSTER_MAP: Record<
  PlaceCharacterDistrictType,
  DistrictCluster
> = {
  ELECTRONICS_DISTRICT: 'core_commercial',
  SHOPPING_SCRAMBLE: 'tourist_shopping_street',
  OFFICE_DISTRICT: 'office_mixed',
  RESIDENTIAL: 'old_residential',
  TRANSIT_HUB: 'station_district',
  GENERIC: 'secondary_retail',
};

export function resolveFacadeProfileForWeakEvidence(
  character: PlaceCharacter,
  osmTags?: Record<string, string>,
): BuildingFacadeProfile {
  const cluster = PLACE_CHARACTER_TO_CLUSTER_MAP[character.districtType];
  const baseProfile = resolveClusterFacadeProfile(cluster, 'weak');

  if (!osmTags) {
    return baseProfile;
  }

  const shopTag = osmTags['shop'];
  const amenityTag = osmTags['amenity'];
  const buildingTag = osmTags['building'];

  if (shopTag === 'electronics' || shopTag === 'computer') {
    return {
      ...baseProfile,
      family: 'metal',
      variant: 'metal_station_silver',
      pattern: 'retail_screen',
      emissiveBoost: clamp((baseProfile.emissiveBoost ?? 1) * 1.3, 0.7, 1.8),
      signDensity: 'high',
      lightingStyle: 'neon_night',
    };
  }

  if (buildingTag === 'retail' || shopTag === 'convenience') {
    return {
      ...baseProfile,
      family: 'mixed',
      variant: 'mixed_neutral_light',
      pattern: 'podium_retail',
      emissiveBoost: clamp((baseProfile.emissiveBoost ?? 1) * 1.15, 0.7, 1.6),
      signDensity: 'medium',
      lightingStyle: 'warm_evening',
    };
  }

  if (amenityTag === 'restaurant' || shopTag === 'restaurant') {
    return {
      ...baseProfile,
      family: 'plaster',
      variant: 'plaster_old_town_white',
      pattern: 'shopping_arcade',
      emissiveBoost: clamp((baseProfile.emissiveBoost ?? 1) * 1.1, 0.7, 1.5),
      signDensity: 'medium',
      lightingStyle: 'warm_evening',
    };
  }

  return baseProfile;
}

export function resolveSceneWideAtmosphereWithPlaceCharacter(
  districtProfiles: DistrictAtmosphereProfile[],
  placeCharacter: PlaceCharacter,
  weakEvidenceRatio: number,
): SceneWideAtmosphereProfile {
  if (weakEvidenceRatio > 0.8) {
    const cluster = PLACE_CHARACTER_TO_CLUSTER_MAP[placeCharacter.districtType];
    const characterProfile = resolveDistrictAtmosphereProfile(
      cluster,
      0.5,
      'weak',
    );

    return {
      cityTone: mapClusterToCityTone(cluster),
      evidenceStrength: 'weak',
      baseFacadeProfile: characterProfile.facadeProfile,
      streetAtmosphere: characterProfile.streetAtmosphere,
      vegetationProfile: characterProfile.vegetationProfile,
      roadProfile: characterProfile.roadProfile,
      lightingProfile: characterProfile.lightingProfile,
      weatherOverlay: characterProfile.weatherOverlay,
    };
  }

  return resolveSceneWideAtmosphereProfile(districtProfiles);
}
