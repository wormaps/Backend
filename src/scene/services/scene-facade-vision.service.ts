import { Injectable } from '@nestjs/common';
import type { MapillaryClient } from '../../places/clients/mapillary.client';
import type { ExternalPlaceDetail } from '../../places/types/external-place.types';
import type { Coordinate, PlacePackage } from '../../places/types/place.types';
import type { MaterialClass, SceneFacadeHint } from '../types/scene.types';
import { BuildingStyleResolverService } from './building-style-resolver.service';

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
    return placePackage.buildings.map((building) => {
      const style = this.buildingStyleResolverService.resolveBuildingStyle(building);
      const anchor = averageCoordinate(building.outerRing) ?? building.outerRing[0];
      const nearbyImageCount = mapillaryImages.filter((image) =>
        distanceMeters(anchor, image.location) <= 45,
      ).length;
      const nearbyFeatureCount = mapillaryFeatures.filter((feature) =>
        distanceMeters(anchor, feature.location) <= 35,
      ).length;
      const proximityToCenter = distanceMeters(anchor, place.location);
      const evidenceDensity = densityFromEvidence(
        nearbyImageCount,
        nearbyFeatureCount,
        building.usage,
        proximityToCenter,
      );
      return {
        objectId: building.id,
        anchor,
        facadeEdgeIndex: this.buildingStyleResolverService.estimateFacadeEdgeIndex(
          building.outerRing,
        ),
        windowBands: style.windowBands,
        billboardEligible: style.billboardEligible,
        palette: uniquePalette(style.palette),
        shellPalette: uniquePalette(style.shellPalette),
        panelPalette: uniquePalette(style.panelPalette),
        materialClass: style.materialClass,
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
      };
    });
  }

  summarizeMaterialClasses(facadeHints: SceneFacadeHint[]) {
    const buckets = new Map<MaterialClass, { count: number; palette: string[] }>();

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
}

function averageCoordinate(points: Coordinate[]): Coordinate | null {
  if (points.length === 0) {
    return null;
  }

  const total = points.reduce(
    (acc, point) => ({
      lat: acc.lat + point.lat,
      lng: acc.lng + point.lng,
    }),
    { lat: 0, lng: 0 },
  );

  return {
    lat: total.lat / points.length,
    lng: total.lng / points.length,
  };
}

function uniquePalette(values: Array<string | null | undefined>): string[] {
  return [
    ...new Set(
      values
        .filter((value): value is string => Boolean(value))
        .map((value) => normalizeColor(value)),
    ),
  ].slice(0, 3);
}

function normalizeColor(value: string): string {
  return new BuildingStyleResolverService().normalizeColor(value);
}

function densityFromEvidence(
  imageCount: number,
  featureCount: number,
  usage: PlacePackage['buildings'][number]['usage'],
  proximityToCenter: number,
): 'low' | 'medium' | 'high' {
  const weighted = imageCount * 1.4 + featureCount * 1.8;
  if (usage === 'COMMERCIAL' && (weighted >= 9 || proximityToCenter <= 80)) {
    return 'high';
  }
  if (
    weighted >= 4 ||
    (usage === 'COMMERCIAL' && proximityToCenter <= 160)
  ) {
    return 'medium';
  }

  return 'low';
}

function distanceMeters(
  a: Coordinate,
  b: Coordinate,
): number {
  const dx = (a.lng - b.lng) * 111_320 * Math.cos((((a.lat + b.lat) / 2) * Math.PI) / 180);
  const dy = (a.lat - b.lat) * 111_320;
  return Math.hypot(dx, dy);
}
