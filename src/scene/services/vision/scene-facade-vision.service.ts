import { Injectable } from '@nestjs/common';
import type { MapillaryClient } from '../../../places/clients/mapillary.client';
import type { ExternalPlaceDetail } from '../../../places/types/external-place.types';
import type { PlacePackage } from '../../../places/types/place.types';
import type {
  MaterialClass,
  SceneFacadeContextDiagnostics,
  SceneFacadeHint,
} from '../../types/scene.types';
import { BuildingStyleResolverService } from './building-style-resolver.service';
import {
  averageCoordinate,
  buildFacadeContext,
  densityFromEvidence,
  distanceMeters,
  hasExplicitBuildingColor,
  inferBuildingPalette,
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
      );
      const shellPalette = uniquePalette(
        hasExplicitBuildingColor(building)
          ? style.shellPalette
          : inferredPalette.shellPalette,
      );
      const panelPalette = uniquePalette(
        hasExplicitBuildingColor(building)
          ? style.panelPalette
          : inferredPalette.panelPalette,
      );
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
      current.palette = uniquePalette([...current.palette, ...hint.palette]);
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

    for (const hint of facadeHints) {
      const profile = hint.contextProfile ?? 'UNKNOWN';
      const material = hint.materialClass;
      profileCounts.set(profile, (profileCounts.get(profile) ?? 0) + 1);
      materialCounts.set(material, (materialCounts.get(material) ?? 0) + 1);
      profileMaterialCounts.set(
        `${profile}:${material}`,
        (profileMaterialCounts.get(`${profile}:${material}`) ?? 0) + 1,
      );
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
    };
  }
}
