import { Injectable } from '@nestjs/common';
import { midpoint, isFiniteCoordinate } from '../../../places/utils/geo.utils';
import type {
  Coordinate,
  GeoBounds,
  PlacePackage,
} from '../../../places/types/place.types';
import type { ExternalPlaceDetail } from '../../../places/types/external-place.types';
import type {
  SceneDetail,
  SceneFidelityPlan,
  SceneMeta,
  SceneScale,
} from '../../types/scene.types';
import { computeSceneCamera } from '../../utils/scene-geometry.utils';
import { BuildingStyleResolverService } from '../../services/vision';

@Injectable()
export class SceneMetaBuilderStep {
  constructor(
    private readonly buildingStyleResolverService: BuildingStyleResolverService,
  ) {}

  buildBaseMeta(
    sceneId: string,
    scale: SceneScale,
    radiusM: number,
    placePackage: PlacePackage,
    place: ExternalPlaceDetail,
    bounds: GeoBounds,
    detail: SceneDetail,
    metaPatch: Pick<
      SceneMeta,
      'detailStatus' | 'visualCoverage' | 'materialClasses' | 'landmarkAnchors'
    >,
    fidelityPlan?: SceneFidelityPlan,
  ): SceneMeta {
    void detail;
    const buildings = placePackage.buildings.map((building) => ({
      ...this.buildingStyleResolverService.resolveBuildingStyle(building),
      objectId: building.id,
      osmWayId: this.normalizeOsmId(building.id),
      name: building.name,
      heightMeters: building.heightMeters,
      outerRing: building.outerRing,
      holes: building.holes,
      footprint: building.footprint,
      usage: building.usage,
      facadeColor: building.facadeColor ?? null,
      facadeMaterial: building.facadeMaterial ?? null,
      roofColor: building.roofColor ?? null,
      roofMaterial: building.roofMaterial ?? null,
      roofShape: building.roofShape ?? null,
      buildingPart: building.buildingPart ?? null,
      osmAttributes: building.osmAttributes,
      googlePlacesInfo: building.googlePlacesInfo,
    }));
    const roads = placePackage.roads.map((road) => ({
      objectId: road.id,
      osmWayId: this.normalizeOsmId(road.id),
      name: road.name,
      laneCount: road.laneCount,
      roadClass: road.roadClass,
      widthMeters: road.widthMeters,
      direction: road.direction,
      path: road.path,
      center: this.resolveCenter(road.path),
      surface: road.surface ?? null,
      bridge: road.bridge ?? false,
      roadVisualClass: this.resolveRoadVisualClass(road),
    }));
    const walkways = placePackage.walkways.map((walkway) => ({
      objectId: walkway.id,
      osmWayId: this.normalizeOsmId(walkway.id),
      name: walkway.name,
      path: walkway.path,
      widthMeters: walkway.widthMeters,
      walkwayType: walkway.walkwayType,
      surface: walkway.surface ?? null,
    }));
    const landmarkIds = new Set(
      placePackage.landmarks.map((landmark) => landmark.id),
    );
    const pois = placePackage.pois.map((poi) => ({
      objectId: poi.id,
      name: poi.name,
      type: poi.type,
      location: poi.location,
      category: poi.type.toLowerCase(),
      isLandmark: landmarkIds.has(poi.id),
    }));
    const camera = computeSceneCamera(place.location, bounds, {
      buildings,
      roads,
      walkways,
    });

    return {
      sceneId,
      placeId: place.placeId,
      name: place.displayName,
      generatedAt: placePackage.generatedAt,
      origin: place.location,
      camera,
      bounds: {
        radiusM,
        northEast: bounds.northEast,
        southWest: bounds.southWest,
      },
      stats: {
        buildingCount: buildings.length,
        roadCount: roads.length,
        walkwayCount: walkways.length,
        poiCount: pois.length,
      },
      diagnostics: placePackage.diagnostics ?? {
        droppedBuildings: 0,
        droppedRoads: 0,
        droppedWalkways: 0,
        droppedPois: 0,
        droppedCrossings: 0,
        droppedStreetFurniture: 0,
        droppedVegetation: 0,
        droppedLandCovers: 0,
        droppedLinearFeatures: 0,
      },
      detailStatus: metaPatch.detailStatus,
      visualCoverage: metaPatch.visualCoverage,
      materialClasses: metaPatch.materialClasses,
      landmarkAnchors: metaPatch.landmarkAnchors,
      assetProfile: {
        preset: scale,
        budget: {
          buildingCount: 0,
          roadCount: 0,
          walkwayCount: 0,
          poiCount: 0,
          crossingCount: 0,
          trafficLightCount: 0,
          streetLightCount: 0,
          signPoleCount: 0,
          treeClusterCount: 0,
          billboardPanelCount: 0,
        },
        selected: {
          buildingCount: 0,
          roadCount: 0,
          walkwayCount: 0,
          poiCount: 0,
          crossingCount: 0,
          trafficLightCount: 0,
          streetLightCount: 0,
          signPoleCount: 0,
          treeClusterCount: 0,
          billboardPanelCount: 0,
        },
      },
      structuralCoverage: {
        selectedBuildingCoverage: 0,
        coreAreaBuildingCoverage: 0,
        fallbackMassingRate: 0,
        footprintPreservationRate: 0,
        heroLandmarkCoverage: 0,
      },
      fidelityPlan,
      roads,
      buildings,
      walkways,
      pois,
    };
  }

  private normalizeOsmId(id: string): string {
    const [prefix, rawId] = id.split('-');
    if (!rawId) {
      return id;
    }
    return `${prefix}_${rawId}`;
  }

  private resolveCenter(path: Coordinate[]): Coordinate {
    const center = midpoint(path);
    if (!center || !isFiniteCoordinate(center)) {
      return { lat: 0, lng: 0 };
    }

    return center;
  }

  private resolveRoadVisualClass(
    road: PlacePackage['roads'][number],
  ): SceneMeta['roads'][number]['roadVisualClass'] {
    if (
      road.roadClass.includes('footway') ||
      road.roadClass.includes('pedestrian')
    ) {
      return 'pedestrian_edge';
    }
    if (
      road.roadClass.includes('primary') ||
      road.roadClass.includes('trunk') ||
      road.widthMeters >= 12
    ) {
      return road.laneCount >= 4 ? 'arterial_intersection' : 'arterial';
    }

    return 'local_street';
  }
}
