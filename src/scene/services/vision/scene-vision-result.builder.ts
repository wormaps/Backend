import type { ExternalPlaceDetail } from '../../../places/types/external-place.types';
import type { MapillaryClient } from '../../../places/clients/mapillary.client';
import type { PlacePackage } from '../../../places/types/place.types';
import type {
  ProviderTrace,
  SceneDetail,
  SceneMeta,
  SceneStreetFurnitureDetail,
  SceneVegetationDetail,
} from '../../types/scene.types';

export interface BuildSceneVisionResultArgs {
  sceneId: string;
  place: ExternalPlaceDetail;
  placePackage: PlacePackage;
  detailStatus: SceneDetail['detailStatus'];
  mapillaryUsed: boolean;
  mapillaryImageStrategy: 'bbox' | 'bbox_expanded' | 'feature_radius' | 'none' | undefined;
  mapillaryImageAttempts:
    | Array<{
        mode: 'bbox' | 'feature_radius';
        label: string;
        resultCount: number;
      }>
    | undefined;
  mapillaryImages: Awaited<
    ReturnType<MapillaryClient['getNearbyImages']>
  >;
  mapillaryFeatures: Awaited<
    ReturnType<MapillaryClient['getMapFeatures']>
  >;
  crossings: SceneDetail['crossings'];
  roadMarkings: SceneDetail['roadMarkings'];
  roadDecals: SceneDetail['roadDecals'];
  intersectionProfiles: SceneDetail['intersectionProfiles'];
  streetFurniture: SceneStreetFurnitureDetail[];
  vegetation: SceneVegetationDetail[];
  facadeHints: SceneDetail['facadeHints'];
  geometryDiagnostics: SceneDetail['geometryDiagnostics'];
  signageClusters: SceneDetail['signageClusters'];
  materialClasses: SceneMeta['materialClasses'];
  facadeContextDiagnostics: SceneDetail['facadeContextDiagnostics'];
  districtAtmosphereProfiles: SceneDetail['districtAtmosphereProfiles'];
  sceneWideAtmosphereProfile: SceneDetail['sceneWideAtmosphereProfile'];
  landmarkAnchors: SceneMeta['landmarkAnchors'];
  providerTrace: ProviderTrace | null;
}

export function buildSceneVisionResult(args: BuildSceneVisionResultArgs): {
  detail: SceneDetail;
  metaPatch: Pick<
    SceneMeta,
    'detailStatus' | 'visualCoverage' | 'materialClasses' | 'landmarkAnchors'
  >;
  providerTrace: ProviderTrace | null;
} {
  const {
    sceneId,
    place,
    placePackage,
    detailStatus,
    mapillaryUsed,
    mapillaryImageStrategy,
    mapillaryImageAttempts,
    mapillaryImages,
    mapillaryFeatures,
    crossings,
    roadMarkings,
    roadDecals,
    intersectionProfiles,
    streetFurniture,
    vegetation,
    facadeHints,
    geometryDiagnostics,
    signageClusters,
    materialClasses,
    facadeContextDiagnostics,
    districtAtmosphereProfiles,
    sceneWideAtmosphereProfile,
    landmarkAnchors,
    providerTrace,
  } = args;
  const roadDecalList = roadDecals ?? [];

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
    facadeContextDiagnostics,
    districtAtmosphereProfiles,
    sceneWideAtmosphereProfile,
    placeReadabilityDiagnostics: {
      heroBuildingCount: 0,
      heroIntersectionCount: new Set(
        roadDecalList
          .filter((decal) => decal.priority === 'hero')
          .map((decal) => decal.intersectionId ?? decal.objectId),
      ).size,
      scrambleStripeCount: roadDecalList.reduce(
        (total, decal) => total + (decal.stripeSet?.stripeCount ?? 0),
        0,
      ),
      billboardPlaneCount: 0,
      canopyCount: 0,
      roofUnitCount: 0,
      emissiveZoneCount: 0,
      streetFurnitureRowCount: 0,
    },
    annotationsApplied: [],
    provenance: {
      mapillaryUsed,
      mapillaryImageCount: mapillaryImages.length,
      mapillaryFeatureCount: mapillaryFeatures.length,
      mapillaryImageStrategy,
      mapillaryImageAttempts,
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
    providerTrace,
  };
}

function clampCoverage(value: number): number {
  return Math.max(0, Math.min(1, Number(value.toFixed(2))));
}
