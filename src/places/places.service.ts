import { HttpStatus, Injectable } from '@nestjs/common';
import { ERROR_CODES } from '../common/constants/error-codes';
import { AppException } from '../common/errors/app.exception';
import {
  PLACE_DETAILS_FIXTURES,
  PLACE_PACKAGE_FIXTURES,
  PLACE_REGISTRY_FIXTURES,
} from './place.fixtures';
import {
  PlaceDetail,
  PlacePackage,
  RegistryInfo,
  SceneSnapshot,
  TimeOfDay,
  WeatherType,
} from './place.types';
import { SnapshotBuilderService } from './snapshot-builder.service';

@Injectable()
export class PlacesService {
  constructor(private readonly snapshotBuilderService: SnapshotBuilderService) {}

  getPlaces(): RegistryInfo[] {
    return PLACE_REGISTRY_FIXTURES;
  }

  getPlaceDetail(placeId: string): PlaceDetail {
    const placeDetail = PLACE_DETAILS_FIXTURES.find((place) => place.registry.id === placeId);
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

  getSceneSnapshot(placeId: string, timeOfDay: TimeOfDay, weather: WeatherType): SceneSnapshot {
    const place = PLACE_REGISTRY_FIXTURES.find((entry) => entry.id === placeId);
    if (!place) {
      throw this.placeNotFound(placeId);
    }

    return this.snapshotBuilderService.build(place, timeOfDay, weather);
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
