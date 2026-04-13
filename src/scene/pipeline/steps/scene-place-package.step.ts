import { Injectable } from '@nestjs/common';
import { OverpassClient } from '../../../places/clients/overpass.client';
import type {
  GeoBounds,
  PlacePackage,
} from '../../../places/types/place.types';
import type { ExternalPlaceDetail } from '../../../places/types/external-place.types';
import type { ProviderTrace } from '../../types/scene.types';

@Injectable()
export class ScenePlacePackageStep {
  constructor(private readonly overpassClient: OverpassClient) {}

  async execute(
    sceneId: string,
    requestId: string | null,
    place: ExternalPlaceDetail,
    bounds: GeoBounds,
  ): Promise<{ placePackage: PlacePackage; providerTrace: ProviderTrace }> {
    const traced = await this.overpassClient.buildPlacePackageWithTrace(place, {
      bounds,
      sceneId,
      requestId,
    });
    const placePackage = traced.placePackage;
    const providerTrace: ProviderTrace = {
      provider: 'OVERPASS',
      observedAt: placePackage.generatedAt,
      requests: [
        {
          method: 'POST',
          url: 'OVERPASS_MULTI_SCOPE',
          query: {
            northEastLat: bounds.northEast.lat,
            northEastLng: bounds.northEast.lng,
            southWestLat: bounds.southWest.lat,
            southWestLng: bounds.southWest.lng,
          },
          body: {
            scopes: ['core', 'street', 'environment'],
          },
          notes:
            'Overpass scope/bbox descriptor입니다. 실제 전송 query 문자열은 별도 보존하지 않습니다.',
        },
      ],
      responseSummary: {
        status: 'SUCCESS',
        itemCount:
          placePackage.buildings.length +
          placePackage.roads.length +
          placePackage.walkways.length +
          placePackage.pois.length +
          placePackage.crossings.length +
          placePackage.streetFurniture.length +
          placePackage.vegetation.length +
          placePackage.landCovers.length +
          placePackage.linearFeatures.length,
        objectId: placePackage.placeId,
        diagnostics: {
          buildingCount: placePackage.buildings.length,
          roadCount: placePackage.roads.length,
          walkwayCount: placePackage.walkways.length,
          poiCount: placePackage.pois.length,
          crossingCount: placePackage.crossings.length,
        },
      },
      upstreamEnvelopes: traced.upstreamEnvelopes,
    };

    return {
      placePackage,
      providerTrace,
    };
  }
}
