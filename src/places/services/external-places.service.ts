import { Injectable } from '@nestjs/common';
import type {
  ExternalPlaceDetail,
  ExternalPlacePackageResponse,
  ExternalPlaceSearchItem,
} from '../types/external-place.types';
import { GooglePlacesClient } from '../clients/google-places.client';
import { OverpassClient } from '../clients/overpass.client';

@Injectable()
export class ExternalPlacesService {
  constructor(
    private readonly googlePlacesClient: GooglePlacesClient,
    private readonly overpassClient: OverpassClient,
  ) {}

  searchExternalPlaces(
    query: string,
    limit: number,
  ): Promise<ExternalPlaceSearchItem[]> {
    return this.googlePlacesClient.searchText(query, limit);
  }

  getExternalPlaceDetail(googlePlaceId: string): Promise<ExternalPlaceDetail> {
    return this.googlePlacesClient.getPlaceDetail(googlePlaceId);
  }

  async getExternalPlacePackage(
    googlePlaceId: string,
  ): Promise<ExternalPlacePackageResponse> {
    const place = await this.googlePlacesClient.getPlaceDetail(googlePlaceId);
    const placePackage = await this.overpassClient.buildPlacePackage(place);

    return {
      place,
      package: placePackage,
    };
  }
}
