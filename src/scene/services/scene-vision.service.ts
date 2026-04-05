import { Injectable } from '@nestjs/common';
import { MapillaryClient } from '../../places/clients/mapillary.client';
import { midpoint } from '../../places/utils/geo.utils';
import { ExternalPlaceDetail } from '../../places/types/external-place.types';
import { Coordinate, GeoBounds, PlacePackage } from '../../places/types/place.types';
import {
  MaterialClass,
  SceneCrossingDetail,
  SceneDetail,
  SceneFacadeHint,
  SceneMeta,
  SceneRoadMarkingDetail,
  SceneSignageCluster,
  SceneStreetFurnitureDetail,
  SceneVegetationDetail,
} from '../types/scene.types';
import {
  estimateFacadeEdgeIndex,
  resolveBuildingStyle,
} from '../utils/scene-building-style.utils';

interface SceneVisionResult {
  detail: SceneDetail;
  metaPatch: Pick<
    SceneMeta,
    'detailStatus' | 'visualCoverage' | 'materialClasses' | 'landmarkAnchors'
  >;
}

@Injectable()
export class SceneVisionService {
  constructor(private readonly mapillaryClient: MapillaryClient) {}

  async buildSceneVision(
    sceneId: string,
    place: ExternalPlaceDetail,
    bounds: GeoBounds,
    placePackage: PlacePackage,
  ): Promise<SceneVisionResult> {
    let mapillaryImages = [] as Awaited<
      ReturnType<MapillaryClient['getNearbyImages']>
    >;
    let mapillaryFeatures = [] as Awaited<
      ReturnType<MapillaryClient['getMapFeatures']>
    >;
    let detailStatus: SceneDetail['detailStatus'] = 'OSM_ONLY';
    let mapillaryUsed = false;

    if (this.mapillaryClient.isConfigured()) {
      try {
        [mapillaryImages, mapillaryFeatures] = await Promise.all([
          this.mapillaryClient.getNearbyImages(bounds),
          this.mapillaryClient.getMapFeatures(bounds),
        ]);
        mapillaryUsed = true;
        detailStatus =
          mapillaryImages.length > 0 || mapillaryFeatures.length > 0
            ? 'FULL'
            : 'PARTIAL';
      } catch {
        detailStatus = 'PARTIAL';
      }
    }

    const crossings = placePackage.crossings.map<SceneCrossingDetail>((crossing) => ({
      objectId: crossing.id,
      name: crossing.name,
      type: crossing.type,
      crossing: crossing.crossing,
      crossingRef: crossing.crossingRef,
      signalized: crossing.signalized,
      path: crossing.path,
      center: crossing.center,
      principal: this.isNearPlaceCenter(place.location, crossing.center, 60),
      style: crossing.signalized
        ? 'signalized'
        : crossing.crossing === 'zebra' || crossing.crossingRef === 'zebra'
          ? 'zebra'
          : 'unknown',
    }));

    const roadMarkings = this.buildRoadMarkings(placePackage, crossings);
    const streetFurniture = placePackage.streetFurniture.map<SceneStreetFurnitureDetail>((item) => ({
      objectId: item.id,
      name: item.name,
      type: item.type,
      location: item.location,
      principal: this.isNearPlaceCenter(place.location, item.location, 90),
    }));
    const vegetation = placePackage.vegetation.map<SceneVegetationDetail>((item) => ({
      objectId: item.id,
      name: item.name,
      type: item.type,
      location: item.location,
      radiusMeters: item.radiusMeters,
    }));
    const facadeHints = this.buildFacadeHints(placePackage, mapillaryImages);
    const signageClusters = this.buildSignageClusters(
      place,
      placePackage,
      mapillaryFeatures,
      facadeHints,
    );

    const materialClasses = summarizeMaterialClasses(facadeHints);
    const landmarkAnchors = buildLandmarkAnchors(placePackage, crossings);
    const detail: SceneDetail = {
      sceneId,
      placeId: place.placeId,
      generatedAt: new Date().toISOString(),
      detailStatus,
      crossings,
      roadMarkings,
      streetFurniture,
      vegetation,
      landCovers: placePackage.landCovers,
      linearFeatures: placePackage.linearFeatures,
      facadeHints,
      signageClusters,
      heroOverridesApplied: [],
      provenance: {
        mapillaryUsed,
        mapillaryImageCount: mapillaryImages.length,
        mapillaryFeatureCount: mapillaryFeatures.length,
        osmTagCoverage: {
          coloredBuildings: placePackage.buildings.filter(
            (building) => building.facadeColor || building.roofColor,
          ).length,
          materialBuildings: placePackage.buildings.filter(
            (building) => building.facadeMaterial || building.roofMaterial,
          ).length,
          crossings: crossings.length,
          streetFurniture: streetFurniture.length,
          vegetation: vegetation.length,
        },
        overrideCount: 0,
      },
    };

    return {
      detail,
      metaPatch: {
        detailStatus,
        visualCoverage: {
          structure: 1,
          streetDetail: clampCoverage(
            0.2 +
              crossings.length * 0.01 +
              streetFurniture.length * 0.003 +
              roadMarkings.length * 0.002,
          ),
          landmark: clampCoverage(
            0.2 + landmarkAnchors.length * 0.12 + signageClusters.length * 0.04,
          ),
          signage: clampCoverage(
            0.1 +
              signageClusters.length * 0.06 +
              facadeHints.filter((hint) => hint.signageDensity !== 'low').length *
                0.02,
          ),
        },
        materialClasses,
        landmarkAnchors,
      },
    };
  }

  private buildRoadMarkings(
    placePackage: PlacePackage,
    crossings: SceneCrossingDetail[],
  ): SceneRoadMarkingDetail[] {
    const laneLines = placePackage.roads.flatMap((road) => {
      if (road.laneCount < 2) {
        return [];
      }

      return [
        {
          objectId: `${road.id}-lane-line`,
          type: 'LANE_LINE' as const,
          color: '#f7f2a2',
          path: road.path,
        },
      ];
    });

    const crosswalks = crossings.map<SceneRoadMarkingDetail>((crossing) => ({
      objectId: `${crossing.objectId}-marking`,
      type: 'CROSSWALK',
      color: '#f5f5f5',
      path: crossing.path,
    }));

    const stopLines = crossings.map<SceneRoadMarkingDetail>((crossing) => ({
      objectId: `${crossing.objectId}-stop-line`,
      type: 'STOP_LINE',
      color: '#ffffff',
      path: crossing.path.slice(0, 2),
    }));

    return [...laneLines, ...crosswalks, ...stopLines];
  }

  private buildFacadeHints(
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
      };
    });
  }

  private buildSignageClusters(
    place: ExternalPlaceDetail,
    placePackage: PlacePackage,
    mapillaryFeatures: Awaited<ReturnType<MapillaryClient['getMapFeatures']>>,
    facadeHints: SceneFacadeHint[],
  ): SceneSignageCluster[] {
    const signFeatures = mapillaryFeatures.filter((feature) =>
      feature.type.toLowerCase().includes('sign'),
    );
    const clusterSource = facadeHints
      .filter((hint) => hint.signageDensity !== 'low')
      .sort((left, right) => {
        const leftDist = squaredDistance(left.anchor, place.location);
        const rightDist = squaredDistance(right.anchor, place.location);
        return leftDist - rightDist;
      })
      .slice(0, 12);

    return clusterSource.map((hint, index) => ({
      objectId: `signage-cluster-${index + 1}`,
      anchor: hint.anchor,
      panelCount: Math.max(
        2,
        Math.min(8, signFeatures.length > 0 ? Math.ceil(signFeatures.length / 8) : 3),
      ),
      palette: hint.palette,
      emissiveStrength: Math.max(0.35, hint.emissiveStrength),
      widthMeters: 5 + index % 3,
      heightMeters: 2.4 + (index % 2) * 0.8,
    }));
  }

  private isNearPlaceCenter(
    origin: Coordinate,
    point: Coordinate,
    radiusMeters: number,
  ): boolean {
    return squaredDistance(origin, point) <= radiusMeters ** 2 / 111_320 ** 2;
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

function summarizeMaterialClasses(facadeHints: SceneFacadeHint[]) {
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

function buildLandmarkAnchors(
  placePackage: PlacePackage,
  crossings: SceneCrossingDetail[],
) {
  const crossingAnchors = crossings
    .filter((crossing) => crossing.principal)
    .slice(0, 4)
    .map((crossing) => ({
      objectId: crossing.objectId,
      name: crossing.name,
      location: crossing.center,
      kind: 'CROSSING' as const,
    }));

  const landmarkAnchors = placePackage.landmarks.slice(0, 6).map((poi) => ({
    objectId: poi.id,
    name: poi.name,
    location: poi.location,
    kind: 'BUILDING' as const,
  }));

  return [...crossingAnchors, ...landmarkAnchors];
}

function squaredDistance(a: Coordinate, b: Coordinate): number {
  const dx = (a.lng - b.lng) * 111_320;
  const dy = (a.lat - b.lat) * 111_320;
  return dx * dx + dy * dy;
}

function uniquePalette(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)).map((value) => normalizeColor(value)))]
    .slice(0, 3);
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

function clampCoverage(value: number): number {
  return Math.max(0, Math.min(1, Number(value.toFixed(2))));
}
