import { Injectable } from '@nestjs/common';
import { MapillaryClient } from '../../places/clients/mapillary.client';
import { ExternalPlaceDetail } from '../../places/types/external-place.types';
import { GeoBounds, PlacePackage } from '../../places/types/place.types';
import {
  SceneDetail,
  SceneMeta,
  SceneStreetFurnitureDetail,
  SceneVegetationDetail,
} from '../types/scene.types';
import { SceneFacadeVisionService } from './scene-facade-vision.service';
import { SceneGeometryDiagnosticsService } from './scene-geometry-diagnostics.service';
import { SceneRoadVisionService } from './scene-road-vision.service';
import { SceneSignageVisionService } from './scene-signage-vision.service';

interface SceneVisionResult {
  detail: SceneDetail;
  metaPatch: Pick<
    SceneMeta,
    'detailStatus' | 'visualCoverage' | 'materialClasses' | 'landmarkAnchors'
  >;
}

@Injectable()
export class SceneVisionService {
  constructor(
    private readonly mapillaryClient: MapillaryClient,
    private readonly sceneRoadVisionService: SceneRoadVisionService = new SceneRoadVisionService(),
    private readonly sceneFacadeVisionService: SceneFacadeVisionService = new SceneFacadeVisionService(),
    private readonly sceneGeometryDiagnosticsService: SceneGeometryDiagnosticsService = new SceneGeometryDiagnosticsService(),
    private readonly sceneSignageVisionService: SceneSignageVisionService = new SceneSignageVisionService(),
  ) {}

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

    const crossings = this.sceneRoadVisionService.buildCrossings(place, placePackage);
    const roadMarkings = this.sceneRoadVisionService.buildRoadMarkings(
      placePackage,
      crossings,
    );
    const intersectionProfiles =
      this.sceneRoadVisionService.buildIntersectionProfiles(
        place,
        crossings,
        placePackage,
      );
    const roadDecals = this.sceneRoadVisionService.buildRoadDecals(
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
      principal: this.sceneRoadVisionService.isNearPlaceCenter(
        place.location,
        item.location,
        90,
      ),
    }));
    const vegetation = placePackage.vegetation.map<SceneVegetationDetail>((item) => ({
      objectId: item.id,
      name: item.name,
      type: item.type,
      location: item.location,
      radiusMeters: item.radiusMeters,
    }));
    const facadeHints = this.sceneFacadeVisionService.buildFacadeHints(
      placePackage,
      mapillaryImages,
    );
    const geometryDiagnostics =
      this.sceneGeometryDiagnosticsService.buildGeometryDiagnostics(
        placePackage,
        facadeHints,
      );
    const signageClusters = this.sceneSignageVisionService.buildSignageClusters(
      place,
      mapillaryFeatures,
      facadeHints,
    );

    const materialClasses =
      this.sceneFacadeVisionService.summarizeMaterialClasses(facadeHints);
    const landmarkAnchors = this.sceneSignageVisionService.buildLandmarkAnchors(
      placePackage,
      crossings,
    );
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
      placeReadabilityDiagnostics: {
        heroBuildingCount: 0,
        heroIntersectionCount: roadDecals.filter((decal) => decal.priority === 'hero').length,
        scrambleStripeCount: roadDecals.reduce(
          (total, decal) => total + (decal.stripeSet?.stripeCount ?? 0),
          0,
        ),
        billboardPlaneCount: 0,
        canopyCount: 0,
        roofUnitCount: 0,
        emissiveZoneCount: 0,
        streetFurnitureRowCount: 0,
      },
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
}

function clampCoverage(value: number): number {
  return Math.max(0, Math.min(1, Number(value.toFixed(2))));
}
