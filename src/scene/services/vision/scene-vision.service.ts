import { Injectable } from '@nestjs/common';
import { AppLoggerService } from '../../../common/logging/app-logger.service';
import { MapillaryClient } from '../../../places/clients/mapillary.client';
import { ExternalPlaceDetail } from '../../../places/types/external-place.types';
import { GeoBounds, PlacePackage } from '../../../places/types/place.types';
import {
  ProviderTrace,
  SceneDetail,
  SceneMeta,
  SceneStreetFurnitureDetail,
  SceneVegetationDetail,
} from '../../types/scene.types';
import { SceneFacadeVisionService } from './scene-facade-vision.service';
import { SceneFacadeAtmosphereService } from './scene-facade-atmosphere.service';
import { SceneGeometryDiagnosticsService } from './scene-geometry-diagnostics.service';
import { SceneRoadVisionService } from './scene-road-vision.service';
import { SceneSignageVisionService } from './scene-signage-vision.service';
import { buildSceneVisionResult } from './scene-vision-result.builder';

interface SceneVisionResult {
  detail: SceneDetail;
  metaPatch: Pick<
    SceneMeta,
    'detailStatus' | 'visualCoverage' | 'materialClasses' | 'landmarkAnchors'
  >;
  providerTrace: ProviderTrace | null;
}

@Injectable()
export class SceneVisionService {
  constructor(
    private readonly appLoggerService: AppLoggerService,
    private readonly mapillaryClient: MapillaryClient,
    private readonly sceneRoadVisionService: SceneRoadVisionService,
    private readonly sceneFacadeVisionService: SceneFacadeVisionService,
    private readonly sceneFacadeAtmosphereService: SceneFacadeAtmosphereService,
    private readonly sceneGeometryDiagnosticsService: SceneGeometryDiagnosticsService,
    private readonly sceneSignageVisionService: SceneSignageVisionService,
  ) {}

  async buildSceneVision(
    sceneId: string,
    place: ExternalPlaceDetail,
    bounds: GeoBounds,
    placePackage: PlacePackage,
    requestId?: string | null,
  ): Promise<SceneVisionResult> {
    let mapillaryImages = [] as Awaited<
      ReturnType<MapillaryClient['getNearbyImages']>
    >;
    let mapillaryFeatures = [] as Awaited<
      ReturnType<MapillaryClient['getMapFeatures']>
    >;
    let detailStatus: SceneDetail['detailStatus'] = 'OSM_ONLY';
    let mapillaryUsed = false;
    let mapillaryImageStrategy:
      | 'bbox'
      | 'bbox_expanded'
      | 'feature_radius'
      | 'none'
      | undefined;
    let mapillaryImageAttempts:
      | Array<{
          mode: 'bbox' | 'feature_radius';
          label: string;
          resultCount: number;
        }>
      | undefined;
    let providerTrace: ProviderTrace | null = null;

    if (this.mapillaryClient.isConfigured()) {
      const coverageCheck = await this.mapillaryClient.checkCoverage(bounds);
      this.appLoggerService.info('scene.vision.mapillary.coverage', {
        sceneId,
        hasCoverage: coverageCheck.hasCoverage,
        imageCount: coverageCheck.imageCount,
      });

      try {
        const featureResult =
          await this.mapillaryClient.getMapFeaturesWithEnvelope(
            bounds,
            100,
            requestId,
          );
        mapillaryFeatures = featureResult.features;
        const imageFetch =
          await this.mapillaryClient.getNearbyImagesWithDiagnostics(bounds, {
            featureAnchors: mapillaryFeatures.map(
              (feature) => feature.location,
            ),
            requestId,
          });
        mapillaryImages = imageFetch.images;
        mapillaryImageStrategy = imageFetch.diagnostics.strategy;
        mapillaryImageAttempts = imageFetch.diagnostics.attempts;
        mapillaryUsed =
          mapillaryImages.length > 0 || mapillaryFeatures.length > 0;
        detailStatus =
          mapillaryImages.length > 0 || mapillaryFeatures.length > 0
            ? 'FULL'
            : 'PARTIAL';
        providerTrace = {
          provider: 'MAPILLARY',
          observedAt: new Date().toISOString(),
          requests: [
            {
              method: 'GET',
              url: 'https://graph.mapillary.com/map_features',
              query: {
                southWestLat: bounds.southWest.lat,
                southWestLng: bounds.southWest.lng,
                northEastLat: bounds.northEast.lat,
                northEastLng: bounds.northEast.lng,
                limit: 100,
              },
              notes: 'Mapillary feature bbox descriptor입니다.',
            },
            {
              method: 'GET',
              url: 'https://graph.mapillary.com/images',
              query: {
                strategy: mapillaryImageStrategy ?? 'none',
                attemptCount: mapillaryImageAttempts?.length ?? 0,
              },
              notes:
                'Mapillary image fetch descriptor입니다. 실제 access token은 저장하지 않습니다.',
            },
          ],
          responseSummary: {
            status: 'SUCCESS',
            itemCount: mapillaryImages.length + mapillaryFeatures.length,
            diagnostics: {
              imageCount: mapillaryImages.length,
              featureCount: mapillaryFeatures.length,
              strategy: mapillaryImageStrategy ?? 'none',
              attemptCount: mapillaryImageAttempts?.length ?? 0,
            },
          },
          upstreamEnvelopes: [
            ...featureResult.upstreamEnvelopes,
            ...imageFetch.upstreamEnvelopes,
          ],
        };
      } catch (error) {
        this.appLoggerService.error('scene.vision.mapillary.failed', {
          sceneId,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          fallbackUsed: true,
        });

        const upstreamEnvelopes = extractUpstreamEnvelopes(error);
        detailStatus = 'PARTIAL';
        providerTrace = {
          provider: 'MAPILLARY',
          observedAt: new Date().toISOString(),
          requests: [
            {
              method: 'GET',
              url: 'https://graph.mapillary.com/map_features',
              notes: 'Mapillary configured but request failed.',
            },
          ],
          responseSummary: {
            status: 'DERIVED',
            diagnostics: {
              mapillaryUsed: false,
              detailStatus: 'PARTIAL',
            },
          },
          upstreamEnvelopes,
        };
      }
    }

    const crossings = this.sceneRoadVisionService.buildCrossings(
      place,
      placePackage,
    );
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
    const streetFurniture =
      placePackage.streetFurniture.map<SceneStreetFurnitureDetail>((item) => ({
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
    const vegetation = placePackage.vegetation.map<SceneVegetationDetail>(
      (item) => ({
        objectId: item.id,
        name: item.name,
        type: item.type,
        location: item.location,
        radiusMeters: item.radiusMeters,
      }),
    );
    const facadeHints = await this.sceneFacadeVisionService.buildFacadeHints(
      place,
      placePackage,
      mapillaryImages,
      mapillaryFeatures,
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
      this.sceneFacadeAtmosphereService.summarizeMaterialClasses(facadeHints);
    const facadeContextDiagnostics =
      this.sceneFacadeAtmosphereService.summarizeFacadeContextDiagnostics(
        facadeHints,
        placePackage,
      );
    const districtAtmosphereProfiles =
      this.sceneFacadeAtmosphereService.buildDistrictAtmosphereProfiles(
        facadeHints,
      );
    const sceneWideAtmosphereProfile =
      this.sceneFacadeAtmosphereService.resolveSceneWideAtmosphereProfile(
        districtAtmosphereProfiles,
      );
    const landmarkAnchors = this.sceneSignageVisionService.buildLandmarkAnchors(
      placePackage,
      crossings,
    );
    return buildSceneVisionResult({
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
    });
  }
}

function extractUpstreamEnvelopes(
  error: unknown,
): ProviderTrace['upstreamEnvelopes'] {
  if (
    typeof error === 'object' &&
    error !== null &&
    'detail' in error &&
    typeof (error as { detail?: unknown }).detail === 'object' &&
    (error as { detail?: unknown }).detail !== null &&
    'upstreamEnvelope' in
      ((error as { detail: Record<string, unknown> }).detail as Record<
        string,
        unknown
      >)
  ) {
    const envelope = (
      (error as { detail: Record<string, unknown> }).detail as Record<
        string,
        unknown
      >
    ).upstreamEnvelope;
    if (typeof envelope === 'object' && envelope !== null) {
      return [
        envelope as NonNullable<ProviderTrace['upstreamEnvelopes']>[number],
      ];
    }
  }
  return [];
}
