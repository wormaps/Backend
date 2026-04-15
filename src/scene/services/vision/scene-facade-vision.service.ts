import { Injectable } from '@nestjs/common';
import type { MapillaryClient } from '../../../places/clients/mapillary.client';
import type { ExternalPlaceDetail } from '../../../places/types/external-place.types';
import type { PlacePackage } from '../../../places/types/place.types';
import type {
  DistrictAtmosphereProfile,
  EvidenceStrength,
  InferenceReasonCode,
  MaterialClass,
  SceneDetail,
  SceneFacadeContextDiagnostics,
  SceneFacadeHint,
  SceneWideAtmosphereProfile,
} from '../../types/scene.types';
import { resolveSceneStaticAtmosphereProfile } from '../../utils/scene-static-atmosphere.utils';
import { BuildingStyleResolverService } from './building-style-resolver.service';
import {
  resolveDistrictAtmosphereProfile,
  resolveDistrictCluster,
  resolveSceneWideAtmosphereProfile,
} from './scene-atmosphere-district.utils';
import {
  averageCoordinate,
  buildFacadeContext,
  densityFromEvidence,
  distanceMeters,
  hasExplicitBuildingColor,
  inferBuildingPalette,
  resolveFacadeColorChannels,
  sortCounts,
  uniquePalette,
} from './scene-facade-vision.utils';

@Injectable()
export class SceneFacadeVisionService {
  constructor(
    private readonly buildingStyleResolverService: BuildingStyleResolverService = new BuildingStyleResolverService(),
  ) {}

  buildFacadeHints(
    place: ExternalPlaceDetail,
    placePackage: PlacePackage,
    mapillaryImages: Awaited<ReturnType<MapillaryClient['getNearbyImages']>>,
    mapillaryFeatures: Awaited<ReturnType<MapillaryClient['getMapFeatures']>>,
  ): SceneFacadeHint[] {
    const buildingAnchors = placePackage.buildings.map((building) => ({
      id: building.id,
      usage: building.usage,
      heightMeters: building.heightMeters,
      anchor: averageCoordinate(building.outerRing) ?? building.outerRing[0],
    }));

    return placePackage.buildings.map((building) => {
      const style =
        this.buildingStyleResolverService.resolveBuildingStyle(building);
      const anchor =
        averageCoordinate(building.outerRing) ?? building.outerRing[0];
      const explicitBuildingColor = hasExplicitBuildingColor(building);
      const nearbyImageCount = mapillaryImages.filter(
        (image) => distanceMeters(anchor, image.location) <= 45,
      ).length;
      const nearbyFeatureCount = mapillaryFeatures.filter(
        (feature) => distanceMeters(anchor, feature.location) <= 35,
      ).length;
      const proximityToCenter = distanceMeters(anchor, place.location);
      const context = buildFacadeContext(
        building,
        anchor,
        proximityToCenter,
        placePackage,
        buildingAnchors,
      );
      const mapillarySignalSummary = summarizeMapillarySignals(
        anchor,
        mapillaryImages,
        mapillaryFeatures,
      );
      const evidenceDensity = densityFromEvidence(
        nearbyImageCount,
        nearbyFeatureCount,
        building.usage,
        proximityToCenter,
      );
      const inferredPalette = inferBuildingPalette(
        building.id,
        building,
        style,
        context,
      );
      const explicitSignalBoost = resolveExplicitSignalBoost(
        building,
        mapillarySignalSummary,
      );
      const hasAnyEvidence = nearbyImageCount > 0 || nearbyFeatureCount > 0;
      const evidenceDensityScore =
        (nearbyImageCount > 0 ? 0.4 : 0) +
        (nearbyFeatureCount > 0 ? 0.3 : 0) +
        (explicitBuildingColor ? 0.2 : 0) +
        (building.facadeMaterial ? 0.1 : 0);
      const weakEvidence =
        evidenceDensityScore < 0.38 &&
        !explicitBuildingColor &&
        !building.facadeMaterial;
      const inferenceReasonCodes: InferenceReasonCode[] = [];
      if (nearbyImageCount === 0) {
        inferenceReasonCodes.push('MISSING_MAPILLARY_IMAGES');
      }
      if (nearbyFeatureCount === 0) {
        inferenceReasonCodes.push('MISSING_MAPILLARY_FEATURES');
      }
      if (!building.facadeColor) {
        inferenceReasonCodes.push('MISSING_FACADE_COLOR');
      }
      if (!building.facadeMaterial) {
        inferenceReasonCodes.push('MISSING_FACADE_MATERIAL');
      }
      if (!building.roofShape) {
        inferenceReasonCodes.push('MISSING_ROOF_SHAPE');
      }
      if (weakEvidence) {
        inferenceReasonCodes.push('WEAK_EVIDENCE_RATIO_HIGH');
        inferenceReasonCodes.push('DEFAULT_STYLE_RULE');
      }
      const palette = uniquePalette(
        explicitBuildingColor ? style.palette : inferredPalette.palette,
        4,
      );
      const shellPalette = uniquePalette(
        explicitBuildingColor
          ? style.shellPalette
          : inferredPalette.shellPalette,
        3,
      );
      const panelPalette = uniquePalette(
        explicitBuildingColor
          ? style.panelPalette
          : inferredPalette.panelPalette,
        3,
      );
      const antiUniformPalette = applyWeakEvidencePaletteDrift({
        buildingId: building.id,
        weakEvidence,
        hasExplicitColor: explicitBuildingColor,
        districtProfile: context.districtProfile,
        palette,
        shellPalette,
        panelPalette,
        explicitSignalBoost,
      });
      const shouldApplyContextualUpgrade =
        hasAnyEvidence || explicitBuildingColor || !weakEvidence;
      const channels = resolveFacadeColorChannels({
        palette: antiUniformPalette.palette,
        roofColor: building.roofColor,
        districtProfile: context.districtProfile,
      });
      const districtResolution = resolveDistrictCluster({
        building,
        anchor,
        placeCenter: place.location,
        context,
        buildingAnchors,
        mapillarySignals: {
          ...mapillarySignalSummary,
          nearbyImageCount,
          nearbyFeatureCount,
        },
      });
      return {
        objectId: building.id,
        anchor,
        facadeEdgeIndex:
          this.buildingStyleResolverService.estimateFacadeEdgeIndex(
            building.outerRing,
          ),
        windowBands: style.windowBands,
        billboardEligible: style.billboardEligible,
        palette: antiUniformPalette.palette,
        shellPalette: antiUniformPalette.shellPalette,
        panelPalette: antiUniformPalette.panelPalette,
        mainColor: channels.mainColor,
        accentColor: channels.accentColor,
        trimColor: channels.trimColor,
        roofColor: channels.roofColor,
        materialClass: inferredPalette.materialClass,
        signageDensity: evidenceDensity,
        emissiveStrength:
          building.usage === 'COMMERCIAL'
            ? evidenceDensity === 'high'
              ? 1
              : evidenceDensity === 'medium'
                ? Math.max(style.emissiveStrength, 0.55)
                : style.emissiveStrength
            : Math.min(style.emissiveStrength, 0.2),
        glazingRatio: style.glazingRatio,
        visualArchetype: style.visualArchetype,
        geometryStrategy: style.geometryStrategy,
        facadePreset: style.facadePreset,
        podiumLevels: style.podiumLevels,
        setbackLevels: style.setbackLevels,
        cornerChamfer: style.cornerChamfer,
        roofAccentType: style.roofAccentType,
        windowPatternDensity: style.windowPatternDensity,
        signBandLevels: style.signBandLevels,
        weakEvidence,
        inferenceReasonCodes,
        contextProfile: context.districtProfile,
        districtCluster: districtResolution.cluster,
        districtConfidence: districtResolution.confidence,
        evidenceStrength: districtResolution.evidenceStrength,
        contextualMaterialUpgrade:
          shouldApplyContextualUpgrade &&
          (inferredPalette.contextualUpgrade ||
            antiUniformPalette.contextualUpgradeBoost),
      };
    });
  }

  summarizeMaterialClasses(facadeHints: SceneFacadeHint[]) {
    const buckets = new Map<
      MaterialClass,
      { count: number; palette: string[] }
    >();

    for (const hint of facadeHints) {
      const current = buckets.get(hint.materialClass) ?? {
        count: 0,
        palette: [],
      };
      current.count += 1;
      current.palette = uniquePalette([...current.palette, ...hint.palette], 4);
      buckets.set(hint.materialClass, current);
    }

    return [...buckets.entries()].map(([className, value]) => ({
      className,
      palette: value.palette.slice(0, 3),
      buildingCount: value.count,
    }));
  }

  summarizeFacadeContextDiagnostics(
    facadeHints: SceneFacadeHint[],
    placePackage: PlacePackage,
  ): SceneFacadeContextDiagnostics {
    const profileCounts = new Map<string, number>();
    const materialCounts = new Map<string, number>();
    const profileMaterialCounts = new Map<string, number>();
    const districtClusterCounts = new Map<string, number>();
    const evidenceStrengthCounts = new Map<string, number>();

    for (const hint of facadeHints) {
      const profile = hint.contextProfile ?? 'UNKNOWN';
      const material = hint.materialClass;
      profileCounts.set(profile, (profileCounts.get(profile) ?? 0) + 1);
      materialCounts.set(material, (materialCounts.get(material) ?? 0) + 1);
      profileMaterialCounts.set(
        `${profile}:${material}`,
        (profileMaterialCounts.get(`${profile}:${material}`) ?? 0) + 1,
      );
      if (hint.districtCluster) {
        districtClusterCounts.set(
          hint.districtCluster,
          (districtClusterCounts.get(hint.districtCluster) ?? 0) + 1,
        );
      }
      if (hint.evidenceStrength) {
        evidenceStrengthCounts.set(
          hint.evidenceStrength,
          (evidenceStrengthCounts.get(hint.evidenceStrength) ?? 0) + 1,
        );
      }
    }

    const explicitColorBuildingCount = placePackage.buildings.filter(
      (building) => hasExplicitBuildingColor(building),
    ).length;
    const weakEvidenceCount = facadeHints.filter(
      (hint) => hint.weakEvidence,
    ).length;
    const weakEvidenceRatio =
      facadeHints.length > 0
        ? Number((weakEvidenceCount / facadeHints.length).toFixed(3))
        : 0;

    return {
      weakEvidenceCount,
      weakEvidenceRatio,
      contextualUpgradeCount: facadeHints.filter(
        (hint) => hint.contextualMaterialUpgrade,
      ).length,
      explicitColorBuildingCount,
      profileCounts: sortCounts(profileCounts),
      materialCounts: sortCounts(materialCounts),
      profileMaterialCounts: sortCounts(profileMaterialCounts).slice(0, 12),
      districtClusterCounts: sortCounts(districtClusterCounts),
      evidenceStrengthCounts: sortCounts(evidenceStrengthCounts),
    };
  }

  buildDistrictAtmosphereProfiles(
    facadeHints: SceneFacadeHint[],
  ): DistrictAtmosphereProfile[] {
    const grouped = new Map<
      NonNullable<SceneFacadeHint['districtCluster']>,
      {
        confidenceAccumulator: number;
        evidenceScore: number;
        count: number;
      }
    >();

    for (const hint of facadeHints) {
      if (!hint.districtCluster) {
        continue;
      }
      const current = grouped.get(hint.districtCluster) ?? {
        confidenceAccumulator: 0,
        evidenceScore: 0,
        count: 0,
      };
      current.count += 1;
      current.confidenceAccumulator +=
        typeof hint.districtConfidence === 'number'
          ? clamp(hint.districtConfidence, 0, 1)
          : hint.weakEvidence
            ? 0.42
            : 0.74;
      current.evidenceScore += rankEvidence(hint.evidenceStrength);
      grouped.set(hint.districtCluster, current);
    }

    return [...grouped.entries()]
      .map(([cluster, stats]) => {
        const confidence =
          stats.confidenceAccumulator / Math.max(1, stats.count);
        const evidenceStrength = resolveEvidenceStrengthFromScore(
          stats.evidenceScore / Math.max(1, stats.count),
        );
        return {
          ...resolveDistrictAtmosphereProfile(
            cluster,
            confidence,
            evidenceStrength,
          ),
          buildingCount: stats.count,
        };
      })
      .sort((a, b) => b.buildingCount - a.buildingCount);
  }

  resolveSceneWideAtmosphereProfile(
    districtProfiles: DistrictAtmosphereProfile[],
  ): SceneWideAtmosphereProfile {
    return resolveSceneWideAtmosphereProfile(districtProfiles);
  }

  refreshAtmosphereProfiles(
    detail: SceneDetail,
  ): Pick<
    SceneDetail,
    | 'districtAtmosphereProfiles'
    | 'sceneWideAtmosphereProfile'
    | 'staticAtmosphere'
  > {
    const districtAtmosphereProfiles = this.buildDistrictAtmosphereProfiles(
      detail.facadeHints,
    );
    const sceneWideAtmosphereProfile = this.resolveSceneWideAtmosphereProfile(
      districtAtmosphereProfiles,
    );
    const staticAtmosphere = resolveSceneStaticAtmosphereProfile(detail);

    return {
      districtAtmosphereProfiles,
      sceneWideAtmosphereProfile,
      staticAtmosphere,
    };
  }
}

function summarizeMapillarySignals(
  anchor: import('../../../places/types/place.types').Coordinate,
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

function clampScore(value: number): number {
  return Math.max(0, Math.min(1, Number(value.toFixed(3))));
}

function rankEvidence(value: SceneFacadeHint['evidenceStrength']): number {
  if (value === 'strong') {
    return 3;
  }
  if (value === 'medium') {
    return 2;
  }
  if (value === 'weak') {
    return 1;
  }
  return 0;
}

function resolveEvidenceStrengthFromScore(score: number): EvidenceStrength {
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

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function applyWeakEvidencePaletteDrift(input: {
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

function resolveExplicitSignalBoost(
  building: import('../../../places/types/place.types').BuildingData,
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
