import type {
  SceneDetail,
  SceneMeta,
  SceneFidelityMode,
  SceneFacadeHint,
} from '../types/scene.types';

export interface SceneFidelityMetricsReport {
  sceneId: string;
  mode: {
    currentMode: SceneFidelityMode;
    targetMode: SceneFidelityMode;
  };
  counts: {
    buildings: number;
    roads: number;
    streetFurniture: number;
    vegetation: number;
    signageClusters: number;
  };
  quality: {
    emissiveAvg: number;
    roadRoughnessAvg: number;
    wetnessAvg: number;
    districtMaterialDiversity: number;
    heroOverrideRate: number;
    fallbackProceduralRate: number;
    weakEvidenceRatio: number;
    landmarkCoverage: number;
    crosswalkCompleteness: number;
    signageDensity: number;
  };
  score: {
    overall: number;
    breakdown: {
      structure: number;
      atmosphere: number;
      placeReadability: number;
    };
  };
}

export function buildSceneFidelityMetricsReport(
  sceneMeta: SceneMeta,
  sceneDetail: SceneDetail,
): SceneFidelityMetricsReport {
  const plan = sceneDetail.fidelityPlan ?? sceneMeta.fidelityPlan;
  const currentMode = plan?.currentMode ?? 'PROCEDURAL_ONLY';
  const targetMode = plan?.targetMode ?? currentMode;

  const selectedBuildings = Math.max(
    1,
    sceneMeta.assetProfile.selected.buildingCount,
  );
  const signageDensity = Number(
    (
      sceneDetail.signageClusters.length / Math.max(1, sceneMeta.roads.length)
    ).toFixed(3),
  );
  const heroOverrides = sceneMeta.buildings.filter(
    (building) => building.visualRole && building.visualRole !== 'generic',
  ).length;
  const autoHeroBoost = sceneDetail.annotationsApplied.some((annotation) =>
    annotation.includes(':auto-hero-promotion:'),
  )
    ? Math.min(
        0.06,
        0.008 + (heroOverrides / Math.max(1, selectedBuildings)) * 0.05,
      )
    : 0;
  const selectedHeroOverrides = Math.min(
    sceneMeta.buildings.filter((building) => {
      if (!building.visualRole || building.visualRole === 'generic') {
        return false;
      }
      const facadeHint = sceneDetail.facadeHints.find(
        (hint) => hint.objectId === building.objectId,
      );
      return !facadeHint?.weakEvidence;
    }).length,
    sceneMeta.assetProfile.selected.buildingCount,
  );
  const heroDensity = selectedHeroOverrides / selectedBuildings;
  const hasMeaningfulHeroCoverage = heroDensity >= 0.02;
  const hasHeroRoadContext = (sceneDetail.roadDecals ?? []).some(
    (decal) => decal.priority === 'hero' || decal.emphasis === 'hero',
  );
  const heroOverrideRate = Number(
    Math.min(
      1,
      heroDensity +
        (hasMeaningfulHeroCoverage && hasHeroRoadContext ? autoHeroBoost : 0),
    ).toFixed(3),
  );
  const fallbackProceduralRate = Number(
    (
      sceneMeta.buildings.filter(
        (building) => building.geometryStrategy === 'fallback_massing',
      ).length / Math.max(1, sceneMeta.buildings.length)
    ).toFixed(3),
  );
  const weakEvidenceRatio = Number(
    (
      sceneDetail.facadeHints.filter((hint) => hint.weakEvidence).length /
      Math.max(1, sceneDetail.facadeHints.length)
    ).toFixed(3),
  );
  const landmarkCoverage = sceneMeta.structuralCoverage.heroLandmarkCoverage;
  const crosswalkCompleteness = Number(
    (
      sceneMeta.assetProfile.selected.crossingCount /
      Math.max(1, sceneDetail.crossings.length)
    ).toFixed(3),
  );

  const materialDiversity = resolveDistrictMaterialDiversity(
    sceneDetail.facadeHints,
  );
  const emissiveAvg = Number(
    (
      sceneDetail.facadeHints.reduce(
        (sum, hint) => sum + hint.emissiveStrength,
        0,
      ) / Math.max(1, sceneDetail.facadeHints.length)
    ).toFixed(3),
  );

  const roadRoughnessAvg = Number(
    (
      sceneDetail.staticAtmosphere?.roadRoughnessScale ??
      resolveRoadRoughnessFromDistricts(sceneDetail)
    ).toFixed(3),
  );
  const wetnessAvg = Number(
    (
      sceneDetail.staticAtmosphere?.wetRoadBoost ??
      resolveWetnessFromDistricts(sceneDetail)
    ).toFixed(3),
  );

  const structureScore = Number(
    (
      sceneMeta.structuralCoverage.selectedBuildingCoverage * 0.45 +
      sceneMeta.structuralCoverage.coreAreaBuildingCoverage * 0.35 +
      (1 - fallbackProceduralRate) * 0.2
    ).toFixed(3),
  );
  const atmosphereScore = Number(
    (
      emissiveAvg * 0.34 +
      Math.min(1, wetnessAvg + 0.1) * 0.22 +
      Math.min(1, materialDiversity / 6) * 0.24 +
      Math.min(1, roadRoughnessAvg) * 0.2
    ).toFixed(3),
  );
  const placeReadabilityScore = Number(
    (
      landmarkCoverage * 0.34 +
      crosswalkCompleteness * 0.26 +
      Math.min(1, signageDensity * 4) * 0.22 +
      heroOverrideRate * 0.18
    ).toFixed(3),
  );
  const overallScore = Number(
    (
      structureScore * 0.4 +
      atmosphereScore * 0.3 +
      placeReadabilityScore * 0.3
    ).toFixed(3),
  );

  return {
    sceneId: sceneMeta.sceneId,
    mode: {
      currentMode,
      targetMode,
    },
    counts: {
      buildings: sceneMeta.assetProfile.selected.buildingCount,
      roads: sceneMeta.assetProfile.selected.roadCount,
      streetFurniture:
        sceneMeta.assetProfile.selected.trafficLightCount +
        sceneMeta.assetProfile.selected.streetLightCount +
        sceneMeta.assetProfile.selected.signPoleCount,
      vegetation: sceneMeta.assetProfile.selected.treeClusterCount,
      signageClusters: sceneDetail.signageClusters.length,
    },
    quality: {
      emissiveAvg,
      roadRoughnessAvg,
      wetnessAvg,
      districtMaterialDiversity: materialDiversity,
      heroOverrideRate,
      fallbackProceduralRate,
      weakEvidenceRatio,
      landmarkCoverage,
      crosswalkCompleteness,
      signageDensity,
    },
    score: {
      overall: overallScore,
      breakdown: {
        structure: structureScore,
        atmosphere: atmosphereScore,
        placeReadability: placeReadabilityScore,
      },
    },
  };
}

function resolveDistrictMaterialDiversity(
  facadeHints: SceneFacadeHint[],
): number {
  const materialClasses = new Set(
    facadeHints.map((hint) => hint.materialClass),
  );
  const clusters = new Set(
    facadeHints
      .map((hint) => hint.districtCluster)
      .filter(
        (cluster): cluster is NonNullable<SceneFacadeHint['districtCluster']> =>
          Boolean(cluster),
      ),
  );
  return materialClasses.size + Math.min(3, clusters.size);
}

function resolveRoadRoughnessFromDistricts(sceneDetail: SceneDetail): number {
  const districtProfiles = sceneDetail.districtAtmosphereProfiles ?? [];
  if (!districtProfiles.length) {
    return 1;
  }
  const wetLikeCount = districtProfiles.filter(
    (profile) =>
      profile.weatherOverlay === 'wet_road' ||
      profile.weatherOverlay === 'foggy',
  ).length;
  return Number(
    (1 - (wetLikeCount / districtProfiles.length) * 0.18).toFixed(3),
  );
}

function resolveWetnessFromDistricts(sceneDetail: SceneDetail): number {
  const districtProfiles = sceneDetail.districtAtmosphereProfiles ?? [];
  if (!districtProfiles.length) {
    return 0;
  }
  const wetLikeCount = districtProfiles.filter(
    (profile) =>
      profile.weatherOverlay === 'wet_road' ||
      profile.weatherOverlay === 'foggy',
  ).length;
  return Number(
    Math.min(0.7, (wetLikeCount / districtProfiles.length) * 0.55).toFixed(3),
  );
}
