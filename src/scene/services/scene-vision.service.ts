import { Injectable } from '@nestjs/common';
import { MapillaryClient } from '../../places/clients/mapillary.client';
import { midpoint } from '../../places/utils/geo.utils';
import { ExternalPlaceDetail } from '../../places/types/external-place.types';
import { Coordinate, GeoBounds, PlacePackage } from '../../places/types/place.types';
import {
  GeometryFallbackReason,
  GeometryStrategy,
  IntersectionProfile,
  RoadVisualClass,
  MaterialClass,
  SceneCrossingDetail,
  SceneDetail,
  SceneFacadeHint,
  SceneGeometryDiagnostic,
  SceneIntersectionProfile,
  SceneMeta,
  SceneRoadDecal,
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
    const intersectionProfiles = this.buildIntersectionProfiles(
      place,
      crossings,
      placePackage,
    );
    const roadDecals = this.buildRoadDecals(
      placePackage,
      crossings,
      roadMarkings,
      intersectionProfiles,
    );
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
    const geometryDiagnostics = this.buildGeometryDiagnostics(placePackage, facadeHints);
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
      intersectionProfiles,
      roadDecals,
      geometryDiagnostics,
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

  private buildIntersectionProfiles(
    place: ExternalPlaceDetail,
    crossings: SceneCrossingDetail[],
    placePackage: PlacePackage,
  ): SceneIntersectionProfile[] {
    return crossings.map((crossing) => {
      const nearRoadCount = placePackage.roads.filter(
        (road) => squaredDistance(midpoint(road.path) ?? place.location, crossing.center) <=
          28 ** 2,
      ).length;
      const profile: IntersectionProfile = crossing.principal
        ? 'scramble_major'
        : crossing.signalized || nearRoadCount >= 2
          ? 'signalized_standard'
          : 'minor_crossing';

      return {
        objectId: `${crossing.objectId}-intersection`,
        anchor: crossing.center,
        profile,
        crossingObjectIds: [crossing.objectId],
      };
    });
  }

  private buildRoadDecals(
    placePackage: PlacePackage,
    crossings: SceneCrossingDetail[],
    roadMarkings: SceneRoadMarkingDetail[],
    intersectionProfiles: SceneIntersectionProfile[],
  ): SceneRoadDecal[] {
    const decals: SceneRoadDecal[] = [];

    for (const marking of roadMarkings) {
      decals.push({
        objectId: `${marking.objectId}-decal`,
        type:
          marking.type === 'LANE_LINE'
            ? 'LANE_OVERLAY'
            : marking.type === 'STOP_LINE'
              ? 'STOP_LINE'
              : 'CROSSWALK_OVERLAY',
        color: marking.color,
        emphasis: marking.type === 'CROSSWALK' ? 'hero' : 'standard',
        path: marking.path,
      });
    }

    for (const crossing of crossings) {
      if (!crossing.principal) {
        continue;
      }
      decals.push({
        objectId: `${crossing.objectId}-scramble-polygon`,
        type: 'CROSSWALK_OVERLAY',
        color: '#f8f8f6',
        emphasis: 'hero',
        polygon: buildBufferedCrossingPolygon(crossing.path, 9.5),
      });
    }

    for (const profile of intersectionProfiles) {
      if (profile.profile !== 'scramble_major') {
        continue;
      }
      decals.push({
        objectId: `${profile.objectId}-junction`,
        type: 'JUNCTION_OVERLAY',
        color: '#f1df8a',
        emphasis: 'hero',
        polygon: buildDiamondPolygon(profile.anchor, 10),
      });
    }

    if (decals.length === 0 && placePackage.roads.length > 0) {
      const primaryRoad = placePackage.roads[0];
      decals.push({
        objectId: `${primaryRoad.id}-fallback-lane`,
        type: 'LANE_OVERLAY',
        color: '#f7f2a2',
        emphasis: 'standard',
        path: primaryRoad.path,
      });
    }

    return decals;
  }

  private buildGeometryDiagnostics(
    placePackage: PlacePackage,
    facadeHints: SceneFacadeHint[],
  ): SceneGeometryDiagnostic[] {
    const hintMap = new Map(facadeHints.map((hint) => [hint.objectId, hint]));

    return placePackage.buildings.map((building) => {
      const complexity = classifyPolygonComplexity(building.outerRing);
      const hint = hintMap.get(building.id);
      const strategy = hint?.geometryStrategy ?? (building.holes.length > 0
        ? 'courtyard_block'
        : complexity === 'complex'
          ? 'fallback_massing'
          : 'simple_extrude');
      const fallbackReason = determineFallbackReason(building.outerRing, building.holes);
      const fallbackApplied =
        strategy === 'fallback_massing' || fallbackReason !== 'NONE';

      return {
        objectId: building.id,
        strategy,
        fallbackApplied,
        fallbackReason,
        hasHoles: building.holes.length > 0,
        polygonComplexity: complexity,
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
    return squaredDistance(origin, point) <= radiusMeters ** 2;
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

function buildBufferedCrossingPolygon(
  path: Coordinate[],
  widthMeters: number,
): Coordinate[] | undefined {
  if (path.length < 2) {
    return undefined;
  }
  const start = path[0];
  const end = path[path.length - 1];
  const dx = end.lng - start.lng;
  const dy = end.lat - start.lat;
  const metersPerLng = 111_320 * Math.cos((((start.lat + end.lat) / 2) * Math.PI) / 180);
  const length = Math.hypot(dx * metersPerLng, dy * 111_320);
  if (length <= 1e-6) {
    return undefined;
  }
  const nx = (-(dy * 111_320) / length) * (widthMeters / metersPerLng);
  const ny = ((dx * metersPerLng) / length) * (widthMeters / 111_320);

  return [
    { lat: start.lat - ny, lng: start.lng - nx },
    { lat: end.lat - ny, lng: end.lng - nx },
    { lat: end.lat + ny, lng: end.lng + nx },
    { lat: start.lat + ny, lng: start.lng + nx },
  ];
}

function buildDiamondPolygon(center: Coordinate, radiusMeters: number): Coordinate[] {
  const latDelta = radiusMeters / 111_320;
  const lngDelta =
    radiusMeters / (111_320 * Math.cos((center.lat * Math.PI) / 180));

  return [
    { lat: center.lat + latDelta, lng: center.lng },
    { lat: center.lat, lng: center.lng + lngDelta },
    { lat: center.lat - latDelta, lng: center.lng },
    { lat: center.lat, lng: center.lng - lngDelta },
  ];
}

function classifyPolygonComplexity(
  ring: Coordinate[],
): SceneGeometryDiagnostic['polygonComplexity'] {
  if (ring.length >= 10) {
    return 'complex';
  }
  if (ring.length >= 7) {
    return 'concave';
  }
  return 'simple';
}

function determineFallbackReason(
  outerRing: Coordinate[],
  holes: Coordinate[][],
): GeometryFallbackReason {
  if (holes.length > 0) {
    return 'HAS_HOLES';
  }
  if (outerRing.length < 3) {
    return 'DEGENERATE_RING';
  }
  if (ringHasVeryThinEdge(outerRing)) {
    return 'VERY_THIN_POLYGON';
  }
  if (outerRing.length >= 10) {
    return 'SELF_INTERSECTION_RISK';
  }
  return 'NONE';
}

function ringHasVeryThinEdge(ring: Coordinate[]): boolean {
  for (let index = 0; index < ring.length; index += 1) {
    const current = ring[index];
    const next = ring[(index + 1) % ring.length];
    if (squaredDistance(current, next) <= 1.2 ** 2) {
      return true;
    }
  }

  return false;
}
