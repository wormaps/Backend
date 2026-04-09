import { Injectable } from '@nestjs/common';
import { OverpassClient } from '../../../places/clients/overpass.client';
import type {
  GeoBounds,
  PlacePackage,
} from '../../../places/types/place.types';
import type { ExternalPlaceDetail } from '../../../places/types/external-place.types';

@Injectable()
export class ScenePlacePackageStep {
  constructor(private readonly overpassClient: OverpassClient) {}

  execute(
    sceneId: string,
    requestId: string | null,
    place: ExternalPlaceDetail,
    bounds: GeoBounds,
  ): Promise<PlacePackage> {
    return this.overpassClient.buildPlacePackage(place, {
      bounds,
      sceneId,
      requestId,
    });
  }
}
