import { HttpStatus, Injectable } from '@nestjs/common';
import { GooglePlacesClient } from '../../../places/clients/google-places.client';
import { ERROR_CODES } from '../../../common/constants/error-codes';
import { AppException } from '../../../common/errors/app.exception';
import { resolveSceneBounds } from '../../utils/scene-geometry.utils';
import type { ProviderTrace, SceneScale } from '../../types/scene.types';
import type { ResolvedScenePlace } from '../scene-generation-pipeline.types';

@Injectable()
export class ScenePlaceResolutionStep {
  constructor(private readonly googlePlacesClient: GooglePlacesClient) {}

  async execute(
    query: string,
    scale: SceneScale,
    requestId?: string | null,
  ): Promise<ResolvedScenePlace> {
    const search = await this.googlePlacesClient.searchTextWithEnvelope(
      query,
      1,
      requestId,
    );
    const selected = search.items[0];
    if (!selected) {
      throw new AppException({
        code: ERROR_CODES.GOOGLE_PLACE_NOT_FOUND,
        message: '검색 결과에 해당하는 장소를 찾을 수 없습니다.',
        detail: { query },
        status: HttpStatus.NOT_FOUND,
      });
    }

    const detail = await this.googlePlacesClient.getPlaceDetailWithEnvelope(
      selected.placeId,
      requestId,
    );
    const place = detail.place;
    const radiusM = this.resolveRadius(scale);
    const bounds = resolveSceneBounds(place.location, radiusM);
    const providerTrace: ProviderTrace = {
      provider: 'GOOGLE_PLACES',
      observedAt: new Date().toISOString(),
      requests: [
        {
          method: 'POST',
          url: 'https://places.googleapis.com/v1/places:searchText',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-FieldMask':
              'places.id,places.displayName,places.formattedAddress,places.location,places.primaryType,places.types,places.googleMapsUri',
          },
          body: {
            textQuery: query,
            pageSize: 1,
            languageCode: 'en',
          },
          notes: '검색 질의 descriptor입니다. 인증값은 저장하지 않습니다.',
        },
        {
          method: 'GET',
          url: `https://places.googleapis.com/v1/places/${selected.placeId}`,
          headers: {
            'X-Goog-FieldMask':
              'id,displayName,formattedAddress,location,primaryType,types,googleMapsUri,viewport,utcOffsetMinutes',
          },
          notes: 'place detail descriptor입니다. 인증값은 저장하지 않습니다.',
        },
      ],
      responseSummary: {
        status: 'SUCCESS',
        itemCount: search.items.length,
        objectId: place.placeId,
        fields: [
          'displayName',
          'formattedAddress',
          'location',
          'primaryType',
          'viewport',
          'utcOffsetMinutes',
        ],
        diagnostics: {
          candidateCount: search.items.length,
          resolvedRadiusM: radiusM,
        },
      },
      upstreamEnvelopes: [search.envelope, detail.envelope],
    };

    return {
      place,
      bounds,
      radiusM,
      candidateCount: search.items.length,
      providerTrace,
    };
  }

  private resolveRadius(scale: SceneScale): number {
    if (scale === 'SMALL') {
      return 300;
    }
    if (scale === 'LARGE') {
      return 1000;
    }
    return 600;
  }
}
