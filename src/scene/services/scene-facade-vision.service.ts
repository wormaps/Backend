import { Injectable } from '@nestjs/common';
import type { MapillaryClient } from '../../places/clients/mapillary.client';
import type { Coordinate, PlacePackage } from '../../places/types/place.types';
import type { MaterialClass, SceneFacadeHint } from '../types/scene.types';
import {
  estimateFacadeEdgeIndex,
  resolveBuildingStyle,
} from '../utils/scene-building-style.utils';

@Injectable()
export class SceneFacadeVisionService {
  buildFacadeHints(
    placePackage: PlacePackage,
    mapillaryImages: Awaited<ReturnType<MapillaryClient['getNearbyImages']>>,
  ): SceneFacadeHint[] {
    const imageDensity = densityFromCount(mapillaryImages.length, 12, 40);

    return placePackage.buildings.map((building) => {
      const style = resolveBuildingStyle(building);
      const anchor = averageCoordinate(building.outerRing) ?? building.outerRing[0];
      return {
        objectId: building.id,
        anchor,
        facadeEdgeIndex: estimateFacadeEdgeIndex(building.outerRing),
        windowBands: style.windowBands,
        billboardEligible: style.billboardEligible,
        palette: uniquePalette(style.palette),
        shellPalette: uniquePalette(style.shellPalette),
        panelPalette: uniquePalette(style.panelPalette),
        materialClass: style.materialClass,
        signageDensity:
          building.usage === 'COMMERCIAL' ? imageDensity : 'low',
        emissiveStrength:
          building.usage === 'COMMERCIAL'
            ? imageDensity === 'high'
              ? 1
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
        weakEvidence: mapillaryImages.length === 0,
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
  if (value.startsWith('#')) {
    return value.toLowerCase();
  }

  const paletteMap: Record<string, string> = {
    gray: '#9ea4aa',
    grey: '#9ea4aa',
    white: '#f2f2f2',
    black: '#1f1f1f',
    blue: '#4d79c7',
    red: '#cc5a4f',
    brown: '#8d5a44',
    beige: '#d6c0a7',
    green: '#5c8b61',
    silver: '#b9c0c7',
  };

  return paletteMap[value.toLowerCase()] ?? '#9ea4aa';
}

function densityFromCount(
  count: number,
  mediumThreshold: number,
  highThreshold: number,
): 'low' | 'medium' | 'high' {
  if (count >= highThreshold) {
    return 'high';
  }
  if (count >= mediumThreshold) {
    return 'medium';
  }

  return 'low';
}
