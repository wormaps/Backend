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

  const selectedBuildingTarget = sceneMeta.assetProfile.selected.buildingCount;
  const selectedBuildings = Math.max(
    1,
    selectedBuildingTarget > 0
      ? Math.min(selectedBuildingTarget, sceneMeta.buildings.length)
      : sceneMeta.buildings.length,
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
    selectedBuildings,
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
      Math.min(
        sceneMeta.assetProfile.selected.crossingCount,
        sceneDetail.crossings.length,
      ) / Math.max(1, sceneDetail.crossings.length)
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
  const paletteColors = new Set(
    facadeHints.flatMap((hint) => [
      ...(hint.palette ?? []),
      ...(hint.shellPalette ?? []),
      ...(hint.panelPalette ?? []),
    ]),
  );
  const roleColorCount = new Set(
    facadeHints.flatMap((hint) => [
      hint.mainColor,
      hint.accentColor,
      hint.trimColor,
      hint.roofColor,
    ]),
  ).size;
  const hueBuckets = new Set(
    [...paletteColors]
      .map((hex) => normalizeHex(hex))
      .filter((hex): hex is string => Boolean(hex))
      .map((hex) => resolveHueBucket(hex)),
  );
  const paletteSpread = Math.min(10, Math.floor(paletteColors.size / 2));
  return (
    materialClasses.size +
    Math.min(5, clusters.size) +
    Math.min(12, hueBuckets.size) +
    Math.min(10, roleColorCount) +
    paletteSpread
  );
}

function normalizeHex(hex: string): string | null {
  const value = hex.trim();
  const short = /^#[0-9a-fA-F]{3}$/;
  const full = /^#[0-9a-fA-F]{6}$/;
  if (full.test(value)) {
    return value.toLowerCase();
  }
  if (short.test(value)) {
    return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`.toLowerCase();
  }
  return null;
}

function resolveHueBucket(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  if (delta < 0.03) {
    return 0;
  }
  let hue = 0;
  if (max === r) {
    hue = ((g - b) / delta) % 6;
  } else if (max === g) {
    hue = (b - r) / delta + 2;
  } else {
    hue = (r - g) / delta + 4;
  }
  const degrees = (hue * 60 + 360) % 360;
  return Math.floor(degrees / 15) + 1;
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
