import { Controller, Get, Param, Query } from '@nestjs/common';
import { ERROR_CODES } from '../common/constants/error-codes';
import type { ResponsePayload } from '../common/http/api-response.interceptor';
import { parseOptionalEnum, validatePlaceId } from '../common/http/query-parsers';
import { PlacesService } from './places.service';
import type {
  PlaceDetail,
  PlacePackage,
  RegistryInfo,
  SceneSnapshot,
} from './place.types';
import {
  TIME_OF_DAY_VALUES,
  WEATHER_VALUES,
} from './place.types';

@Controller('places')
export class PlacesController {
  constructor(private readonly placesService: PlacesService) {}

  @Get()
  getPlaces(): ResponsePayload<RegistryInfo[]> {
    return {
      message: '장소 목록 조회에 성공했습니다.',
      data: this.placesService.getPlaces(),
    };
  }

  @Get(':placeId')
  getPlaceDetail(@Param('placeId') placeId: string): ResponsePayload<PlaceDetail> {
    const validatedPlaceId = validatePlaceId(placeId);

    return {
      message: '장소 상세 조회에 성공했습니다.',
      data: this.placesService.getPlaceDetail(validatedPlaceId),
    };
  }

  @Get(':placeId/package')
  getPlacePackage(@Param('placeId') placeId: string): ResponsePayload<PlacePackage> {
    const validatedPlaceId = validatePlaceId(placeId);

    return {
      message: 'Place package 조회에 성공했습니다.',
      data: this.placesService.getPlacePackage(validatedPlaceId),
    };
  }

  @Get(':placeId/snapshot')
  getSceneSnapshot(
    @Param('placeId') placeId: string,
    @Query('timeOfDay') rawTimeOfDay?: string,
    @Query('weather') rawWeather?: string,
  ): ResponsePayload<SceneSnapshot> {
    const validatedPlaceId = validatePlaceId(placeId);
    const timeOfDay = parseOptionalEnum(
      rawTimeOfDay,
      TIME_OF_DAY_VALUES,
      ERROR_CODES.INVALID_TIME_OF_DAY,
      'timeOfDay',
    );
    const weather = parseOptionalEnum(
      rawWeather,
      WEATHER_VALUES,
      ERROR_CODES.INVALID_WEATHER,
      'weather',
    );

    return {
      message: 'Scene snapshot 조회에 성공했습니다.',
      data: this.placesService.getSceneSnapshot(
        validatedPlaceId,
        timeOfDay ?? 'DAY',
        weather ?? 'CLEAR',
      ),
    };
  }
}
