import { HttpStatus, Injectable } from '@nestjs/common';
import { ERROR_CODES } from '../../common/constants/error-codes';
import { AppException } from '../../common/errors/app.exception';
import { fetchJsonWithEnvelope } from '../../common/http/fetch-json';
import type {
  FetchJsonEnvelope,
  FetchLike,
} from '../../common/http/fetch-json';
import { normalizeCoordinate } from '../utils/geo.utils';
import {
  ExternalPlaceDetail,
  ExternalPlaceSearchItem,
} from '../types/external-place.types';

interface GoogleTextSearchResponse {
  places?: GooglePlace[];
}

interface GooglePlace {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: {
    latitude?: number;
    longitude?: number;
  };
  primaryType?: string;
  types?: string[];
  googleMapsUri?: string;
  viewport?: {
    low?: { latitude?: number; longitude?: number };
    high?: { latitude?: number; longitude?: number };
  };
  utcOffsetMinutes?: number;
}

@Injectable()
export class GooglePlacesClient {
  private fetcher: FetchLike = fetch;

  withFetcher(fetcher: FetchLike): this {
    this.fetcher = fetcher;
    return this;
  }

  async searchText(
    query: string,
    limit: number,
  ): Promise<ExternalPlaceSearchItem[]> {
    const result = await this.searchTextWithEnvelope(query, limit);
    return result.items;
  }

  async searchTextWithEnvelope(
    query: string,
    limit: number,
  ): Promise<{
    items: ExternalPlaceSearchItem[];
    envelope: FetchJsonEnvelope;
  }> {
    const apiKey = this.getApiKey();
    const response = await fetchJsonWithEnvelope<GoogleTextSearchResponse>(
      {
        provider: 'Google Places Text Search',
        url: 'https://places.googleapis.com/v1/places:searchText',
        init: {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask':
              'places.id,places.displayName,places.formattedAddress,places.location,places.primaryType,places.types,places.googleMapsUri',
          },
          body: JSON.stringify({
            textQuery: query,
            pageSize: limit,
            languageCode: 'en',
          }),
        },
      },
      this.fetcher,
    );

    return {
      items: (response.data.places ?? [])
        .filter(
          (place) => place.id && place.displayName?.text && place.location,
        )
        .slice(0, limit)
        .map((place) => this.mapSearchItem(place)),
      envelope: response.envelope,
    };
  }

  async getPlaceDetail(googlePlaceId: string): Promise<ExternalPlaceDetail> {
    const result = await this.getPlaceDetailWithEnvelope(googlePlaceId);
    return result.place;
  }

  async getPlaceDetailWithEnvelope(googlePlaceId: string): Promise<{
    place: ExternalPlaceDetail;
    envelope: FetchJsonEnvelope;
  }> {
    const apiKey = this.getApiKey();
    const response = await fetchJsonWithEnvelope<GooglePlace>(
      {
        provider: 'Google Places Place Details',
        url: `https://places.googleapis.com/v1/places/${googlePlaceId}`,
        init: {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask':
              'id,displayName,formattedAddress,location,primaryType,types,googleMapsUri,viewport,utcOffsetMinutes',
          },
        },
      },
      this.fetcher,
    );

    const location = response.data.location
      ? normalizeCoordinate(response.data.location)
      : null;

    if (!response.data.id || !response.data.displayName?.text || !location) {
      throw new AppException({
        code: ERROR_CODES.GOOGLE_PLACE_NOT_FOUND,
        message: 'Google Places 상세 정보를 찾을 수 없습니다.',
        detail: {
          googlePlaceId,
        },
        status: HttpStatus.NOT_FOUND,
      });
    }

    return {
      place: {
        ...this.mapSearchItem(response.data),
        viewport: response.data.viewport
          ? {
              northEast: {
                lat:
                  response.data.viewport.high?.latitude ??
                  location.lat + 0.002,
                lng:
                  response.data.viewport.high?.longitude ??
                  location.lng + 0.002,
              },
              southWest: {
                lat:
                  response.data.viewport.low?.latitude ??
                  location.lat - 0.002,
                lng:
                  response.data.viewport.low?.longitude ??
                  location.lng - 0.002,
              },
            }
          : null,
        utcOffsetMinutes: response.data.utcOffsetMinutes ?? null,
      },
      envelope: response.envelope,
    };
  }

  private mapSearchItem(place: GooglePlace): ExternalPlaceSearchItem {
    const location = place.location
      ? normalizeCoordinate(place.location)
      : null;
    if (!location) {
      throw new AppException({
        code: ERROR_CODES.GOOGLE_PLACE_NOT_FOUND,
        message: 'Google Places 위치 정보를 해석할 수 없습니다.',
        detail: {
          googlePlaceId: place.id,
        },
        status: HttpStatus.NOT_FOUND,
      });
    }

    return {
      provider: 'GOOGLE_PLACES',
      placeId: place.id,
      displayName: place.displayName?.text ?? place.id,
      formattedAddress: place.formattedAddress ?? null,
      location,
      primaryType: place.primaryType ?? null,
      types: place.types ?? [],
      googleMapsUri: place.googleMapsUri ?? null,
    };
  }

  private getApiKey(): string {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      throw new AppException({
        code: ERROR_CODES.EXTERNAL_API_NOT_CONFIGURED,
        message: 'GOOGLE_API_KEY 환경 변수가 설정되지 않았습니다.',
        detail: {
          env: 'GOOGLE_API_KEY',
        },
        status: HttpStatus.INTERNAL_SERVER_ERROR,
      });
    }

    return apiKey;
  }
}
