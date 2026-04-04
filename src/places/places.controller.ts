import { Controller, Get, Param, Query } from '@nestjs/common';
import { ERROR_CODES } from '../common/constants/error-codes';
import type { ResponsePayload } from '../common/http/api-response.interceptor';
import {
  parseOptionalEnum,
  parseOptionalIsoDate,
  parseOptionalLimit,
  parseRequiredQuery,
  validateGooglePlaceId,
  validatePlaceId,
} from '../common/http/query-parsers';
import type {
  ExternalPlaceDetail,
  ExternalPlacePackageResponse,
  ExternalPlaceSearchItem,
  ExternalSceneSnapshotResponse,
} from './external-place.types';
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

  @Get('search')
  async searchPlaces(
    @Query('q') query?: string,
    @Query('limit') limit?: string,
  ): Promise<ResponsePayload<ExternalPlaceSearchItem[]>> {
    const validatedQuery = parseRequiredQuery(query, 'q');
    const validatedLimit = parseOptionalLimit(limit);

    return {
      message: '외부 장소 검색에 성공했습니다.',
      data: await this.placesService.searchExternalPlaces(validatedQuery, validatedLimit),
    };
  }

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

  @Get('google/:googlePlaceId')
  async getExternalPlaceDetail(
    @Param('googlePlaceId') googlePlaceId: string,
  ): Promise<ResponsePayload<ExternalPlaceDetail>> {
    const validatedGooglePlaceId = validateGooglePlaceId(googlePlaceId);

    return {
      message: '외부 장소 상세 조회에 성공했습니다.',
      data: await this.placesService.getExternalPlaceDetail(validatedGooglePlaceId),
    };
  }

  @Get('google/:googlePlaceId/package')
  async getExternalPlacePackage(
    @Param('googlePlaceId') googlePlaceId: string,
  ): Promise<ResponsePayload<ExternalPlacePackageResponse>> {
    const validatedGooglePlaceId = validateGooglePlaceId(googlePlaceId);

    return {
      message: '외부 Place package 조회에 성공했습니다.',
      data: await this.placesService.getExternalPlacePackage(validatedGooglePlaceId),
    };
  }

  @Get('google/:googlePlaceId/snapshot')
  async getExternalSceneSnapshot(
    @Param('googlePlaceId') googlePlaceId: string,
    @Query('timeOfDay') rawTimeOfDay?: string,
    @Query('weather') rawWeather?: string,
    @Query('date') rawDate?: string,
  ): Promise<ResponsePayload<ExternalSceneSnapshotResponse>> {
    const validatedGooglePlaceId = validateGooglePlaceId(googlePlaceId);
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
    const date = parseOptionalIsoDate(rawDate) ?? new Date().toISOString().slice(0, 10);

    return {
      message: '외부 Scene snapshot 조회에 성공했습니다.',
      data: await this.placesService.getExternalSceneSnapshot(
        validatedGooglePlaceId,
        timeOfDay ?? 'DAY',
        weather,
        date,
      ),
    };
  }
}
