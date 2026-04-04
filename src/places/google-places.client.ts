import { HttpStatus, Injectable } from '@nestjs/common';
import { ERROR_CODES } from '../common/constants/error-codes';
import { AppException } from '../common/errors/app.exception';
import { fetchJson } from '../common/http/fetch-json';
import type { FetchLike } from '../common/http/fetch-json';
import { Coordinate } from './place.types';
import {
  ExternalPlaceDetail,
  ExternalPlaceSearchItem,
} from './external-place.types';

interface GoogleTextSearchResponse {
  places?: GooglePlace[];
}

interface GooglePlace {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: Coordinate;
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
    const apiKey = this.getApiKey();
    const response = await fetchJson<GoogleTextSearchResponse>(
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

    return (response.places ?? [])
      .filter((place) => place.id && place.displayName?.text && place.location)
      .slice(0, limit)
      .map((place) => this.mapSearchItem(place));
  }

  async getPlaceDetail(googlePlaceId: string): Promise<ExternalPlaceDetail> {
    const apiKey = this.getApiKey();
    const response = await fetchJson<GooglePlace>(
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

    if (!response.id || !response.displayName?.text || !response.location) {
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
      ...this.mapSearchItem(response),
      viewport: response.viewport
        ? {
            northEast: {
              lat:
                response.viewport.high?.latitude ??
                response.location.lat + 0.002,
              lng:
                response.viewport.high?.longitude ??
                response.location.lng + 0.002,
            },
            southWest: {
              lat:
                response.viewport.low?.latitude ??
                response.location.lat - 0.002,
              lng:
                response.viewport.low?.longitude ??
                response.location.lng - 0.002,
            },
          }
        : null,
      utcOffsetMinutes: response.utcOffsetMinutes ?? null,
    };
  }

  private mapSearchItem(place: GooglePlace): ExternalPlaceSearchItem {
    return {
      provider: 'GOOGLE_PLACES',
      placeId: place.id,
      displayName: place.displayName?.text ?? place.id,
      formattedAddress: place.formattedAddress ?? null,
      location: place.location as Coordinate,
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
