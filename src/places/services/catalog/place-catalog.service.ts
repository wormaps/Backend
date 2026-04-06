import { HttpStatus, Injectable } from '@nestjs/common';
import { ERROR_CODES } from '../../../common/constants/error-codes';
import { AppException } from '../../../common/errors/app.exception';
import {
  PLACE_DETAILS_FIXTURES,
  PLACE_PACKAGE_FIXTURES,
  PLACE_REGISTRY_FIXTURES,
} from '../../fixtures/place.fixtures';
import type {
  PlaceDetail,
  PlacePackage,
  RegistryInfo,
} from '../../types/place.types';

@Injectable()
export class PlaceCatalogService {
  getPlaces(): RegistryInfo[] {
    return PLACE_REGISTRY_FIXTURES;
  }

  getPlaceDetail(placeId: string): PlaceDetail {
    const placeDetail = PLACE_DETAILS_FIXTURES.find(
      (place) => place.registry.id === placeId,
    );
    if (!placeDetail) {
      throw this.placeNotFound(placeId);
    }

    return placeDetail;
  }

  getPlacePackage(placeId: string): PlacePackage {
    const placePackage = PLACE_PACKAGE_FIXTURES[placeId];
    if (!placePackage) {
      throw this.placeNotFound(placeId);
    }

    return placePackage;
  }

  getPlaceRegistry(placeId: string): RegistryInfo {
    const place = PLACE_REGISTRY_FIXTURES.find((entry) => entry.id === placeId);
    if (!place) {
      throw this.placeNotFound(placeId);
    }

    return place;
  }

  private placeNotFound(placeId: string): AppException {
    return new AppException({
      code: ERROR_CODES.PLACE_NOT_FOUND,
      message: '장소를 찾을 수 없습니다.',
      detail: {
        placeId,
      },
      status: HttpStatus.NOT_FOUND,
    });
  }
}
