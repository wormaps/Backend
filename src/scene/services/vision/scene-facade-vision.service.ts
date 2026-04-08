import { Injectable } from '@nestjs/common';
import type { MapillaryClient } from '../../../places/clients/mapillary.client';
import type { ExternalPlaceDetail } from '../../../places/types/external-place.types';
import type { PlacePackage } from '../../../places/types/place.types';
import type {
  DistrictAtmosphereProfile,
  EvidenceStrength,
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
      const palette = uniquePalette(
        hasExplicitBuildingColor(building)
          ? style.palette
          : inferredPalette.palette,
        4,
      );
      const shellPalette = uniquePalette(
        hasExplicitBuildingColor(building)
          ? style.shellPalette
          : inferredPalette.shellPalette,
        3,
      );
      const panelPalette = uniquePalette(
        hasExplicitBuildingColor(building)
          ? style.panelPalette
          : inferredPalette.panelPalette,
        3,
      );
      const channels = resolveFacadeColorChannels({
        palette,
        roofColor: building.roofColor,
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
        palette,
        shellPalette,
        panelPalette,
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
        weakEvidence: nearbyImageCount === 0 && nearbyFeatureCount === 0,
        contextProfile: context.districtProfile,
        districtCluster: districtResolution.cluster,
        districtConfidence: districtResolution.confidence,
        evidenceStrength: districtResolution.evidenceStrength,
        contextualMaterialUpgrade: inferredPalette.contextualUpgrade,
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

    return {
      weakEvidenceCount: facadeHints.filter((hint) => hint.weakEvidence).length,
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
