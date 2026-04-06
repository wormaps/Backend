import { Injectable } from '@nestjs/common';
import type { MapillaryClient } from '../../places/clients/mapillary.client';
import type { ExternalPlaceDetail } from '../../places/types/external-place.types';
import type { Coordinate, PlacePackage } from '../../places/types/place.types';
import type { MaterialClass, SceneFacadeHint } from '../types/scene.types';
import {
  BuildingStyleProfile,
  BuildingStyleResolverService,
} from './building-style-resolver.service';

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
      const inferredPalette = inferBuildingPalette(
        building.id,
        building,
        style,
        proximityToCenter,
      );
      const palette = uniquePalette(
        hasExplicitBuildingColor(building) ? style.palette : inferredPalette.palette,
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
        facadeEdgeIndex: this.buildingStyleResolverService.estimateFacadeEdgeIndex(
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

function hasExplicitBuildingColor(
  building: PlacePackage['buildings'][number],
): boolean {
  return Boolean(building.facadeColor || building.roofColor);
}

function inferBuildingPalette(
  buildingId: string,
  building: PlacePackage['buildings'][number],
  style: BuildingStyleProfile,
  proximityToCenter: number,
): {
  materialClass: MaterialClass;
  palette: string[];
  shellPalette: string[];
  panelPalette: string[];
} {
  const materialClass =
    style.materialClass === 'mixed'
      ? resolveFallbackMaterialClass(style, building)
      : style.materialClass;
  const variant = stableIndex(buildingId, 4);
  const centerBias = proximityToCenter <= 120 ? 'core' : 'edge';
  const family = resolvePaletteFamily(materialClass, style, building, centerBias);
  const palette = family[variant] ?? family[0];

  return {
    materialClass,
    palette,
    shellPalette: palette.slice(0, 2),
    panelPalette: resolvePanelPalette(materialClass, style, palette, variant),
  };
}

function resolveFallbackMaterialClass(
  style: BuildingStyleProfile,
  building: PlacePackage['buildings'][number],
): MaterialClass {
  if (style.preset === 'small_lowrise') {
    return 'brick';
  }
  if (style.preset === 'station_block') {
    return 'metal';
  }
  if (building.usage === 'PUBLIC' || building.usage === 'MIXED') {
    return 'concrete';
  }
  return 'concrete';
}

function resolvePaletteFamily(
  materialClass: MaterialClass,
  style: BuildingStyleProfile,
  building: PlacePackage['buildings'][number],
  centerBias: 'core' | 'edge',
): string[][] {
  if (materialClass === 'glass') {
    return centerBias === 'core'
      ? [
          ['#6e95ba', '#c7d9ea', '#eef5fb'],
          ['#4f7ca8', '#b9d0e4', '#edf6fd'],
          ['#5e8faf', '#d4e1ec', '#f4f8fb'],
          ['#7a8ea3', '#d6dee6', '#eef4f8'],
        ]
      : [
          ['#7c9ebb', '#d5e2ec', '#f2f7fb'],
          ['#7390a8', '#cad7e2', '#eef4f8'],
          ['#889cad', '#d9e1e8', '#f4f7fa'],
          ['#6886a1', '#c7d7e5', '#eef5fa'],
        ];
  }
  if (materialClass === 'brick') {
    return [
      ['#8d4d38', '#bf7b58', '#e2c4ad'],
      ['#9b5c46', '#c98663', '#e7ccb8'],
      ['#7b4635', '#b36c4d', '#ddbea9'],
      ['#945745', '#bf8568', '#e6d2c2'],
    ];
  }
  if (materialClass === 'metal') {
    return [
      ['#6f7983', '#b5c0c8', '#e2e7eb'],
      ['#7e8891', '#c1c9cf', '#edf1f4'],
      ['#66727d', '#aeb8c1', '#dde4ea'],
      ['#77848f', '#c7d0d7', '#eef3f7'],
    ];
  }
  if (style.preset === 'mall_block' || building.usage === 'COMMERCIAL') {
    return centerBias === 'core'
      ? [
          ['#b79f8a', '#ddd1c4', '#f4ede6'],
          ['#9b938c', '#d3cdc6', '#f0ece8'],
          ['#c6aa93', '#e4d4c3', '#f7efe7'],
          ['#a79b8d', '#d6cec5', '#f2ede8'],
        ]
      : [
          ['#a8a39b', '#d9d5ce', '#f2efea'],
          ['#b6a794', '#ded2c3', '#f5eee8'],
          ['#9d9a93', '#d0ccc6', '#ece8e3'],
          ['#beb2a6', '#e1d8cd', '#f6f1ea'],
        ];
  }
  return [
    ['#a39d94', '#d5d0c9', '#f0ece7'],
    ['#989b9f', '#d0d4d8', '#eceff1'],
    ['#b4a697', '#ddd2c6', '#f3eee8'],
    ['#8e939a', '#c9ced4', '#e7ebef'],
  ];
}

function resolvePanelPalette(
  materialClass: MaterialClass,
  style: BuildingStyleProfile,
  palette: string[],
  variant: number,
): string[] {
  if (style.facadePreset === 'glass_grid') {
    const variants = [
      [palette[0] ?? '#6e95ba', '#d7e6f2', '#f5f9fc'],
      [palette[0] ?? '#4f7ca8', '#d1e0ec', '#f1f6fb'],
      [palette[0] ?? '#5e8faf', '#dde8f1', '#f6f9fb'],
      [palette[0] ?? '#7a8ea3', '#d9e1e8', '#f3f7fa'],
    ];
    return variants[variant] ?? variants[0];
  }
  if (style.facadePreset === 'retail_sign_band' || style.facadePreset === 'mall_panel') {
    const variants = [
      ['#f44336', '#ffd166', '#fff8e7'],
      ['#ff6f61', '#3ec1d3', '#fefefe'],
      ['#ffb703', '#fb8500', '#fff3db'],
      ['#00bcd4', '#ff4d6d', '#fff7f0'],
    ];
    return variants[variant] ?? variants[0];
  }
  if (materialClass === 'brick') {
    return [palette[0] ?? '#8d4d38', '#d9c1ae', '#f0e6dd'];
  }
  return [palette[0] ?? '#8e939a', palette[1] ?? '#d0d4d8', '#eef2f5'];
}

function stableIndex(seed: string, modulo: number): number {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return modulo > 0 ? hash % modulo : 0;
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
