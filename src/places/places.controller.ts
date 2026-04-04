import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ERROR_CODES } from '../common/constants/error-codes';
import type { ResponsePayload } from '../common/http/api-response.interceptor';
import {
  ApiErrorEnvelope,
  ApiSuccessEnvelope,
} from '../docs/swagger.decorators';
import {
  ExternalPlaceDetailDto,
  ExternalPlacePackageResponseDto,
  ExternalPlaceSearchItemDto,
  PlaceDetailDto,
  PlacePackageDto,
  RegistryInfoDto,
  SceneSnapshotDto,
  ExternalSceneSnapshotResponseDto,
} from '../docs/swagger.dto';
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
import { TIME_OF_DAY_VALUES, WEATHER_VALUES } from './place.types';

@ApiTags('places', 'external-places')
@Controller('places')
export class PlacesController {
  constructor(private readonly placesService: PlacesService) {}

  @Get('search')
  @ApiTags('external-places')
  @ApiOperation({ summary: '외부 장소 검색' })
  @ApiQuery({
    name: 'q',
    required: true,
    type: String,
    example: 'gangnam station',
  })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 5 })
  @ApiSuccessEnvelope({ model: ExternalPlaceSearchItemDto, isArray: true })
  @ApiErrorEnvelope(400, {
    code: 'INVALID_QUERY',
    message: 'q 값이 필요합니다.',
    detail: { field: 'q' },
  })
  async searchPlaces(
    @Query('q') query?: string,
    @Query('limit') limit?: string,
  ): Promise<ResponsePayload<ExternalPlaceSearchItem[]>> {
    const validatedQuery = parseRequiredQuery(query, 'q');
    const validatedLimit = parseOptionalLimit(limit);

    return {
      message: '외부 장소 검색에 성공했습니다.',
      data: await this.placesService.searchExternalPlaces(
        validatedQuery,
        validatedLimit,
      ),
    };
  }

  @Get()
  @ApiTags('places')
  @ApiOperation({ summary: '장소 목록 조회' })
  @ApiSuccessEnvelope({ model: RegistryInfoDto, isArray: true })
  getPlaces(): ResponsePayload<RegistryInfo[]> {
    return {
      message: '장소 목록 조회에 성공했습니다.',
      data: this.placesService.getPlaces(),
    };
  }

  @Get(':placeId')
  @ApiTags('places')
  @ApiOperation({ summary: '장소 상세 조회' })
  @ApiParam({ name: 'placeId', example: 'gangnam-station' })
  @ApiSuccessEnvelope({ model: PlaceDetailDto })
  @ApiErrorEnvelope(404, {
    code: 'PLACE_NOT_FOUND',
    message: '장소를 찾을 수 없습니다.',
    detail: { placeId: 'unknown-place' },
  })
  getPlaceDetail(
    @Param('placeId') placeId: string,
  ): ResponsePayload<PlaceDetail> {
    const validatedPlaceId = validatePlaceId(placeId);

    return {
      message: '장소 상세 조회에 성공했습니다.',
      data: this.placesService.getPlaceDetail(validatedPlaceId),
    };
  }

  @Get(':placeId/package')
  @ApiTags('places')
  @ApiOperation({ summary: 'Place package 조회' })
  @ApiParam({ name: 'placeId', example: 'gangnam-station' })
  @ApiSuccessEnvelope({ model: PlacePackageDto })
  getPlacePackage(
    @Param('placeId') placeId: string,
  ): ResponsePayload<PlacePackage> {
    const validatedPlaceId = validatePlaceId(placeId);

    return {
      message: 'Place package 조회에 성공했습니다.',
      data: this.placesService.getPlacePackage(validatedPlaceId),
    };
  }

  @Get(':placeId/snapshot')
  @ApiTags('places')
  @ApiOperation({ summary: 'Scene snapshot 조회' })
  @ApiParam({ name: 'placeId', example: 'gangnam-station' })
  @ApiQuery({ name: 'timeOfDay', required: false, enum: TIME_OF_DAY_VALUES })
  @ApiQuery({ name: 'weather', required: false, enum: WEATHER_VALUES })
  @ApiSuccessEnvelope({ model: SceneSnapshotDto })
  @ApiErrorEnvelope(400, {
    code: 'INVALID_TIME_OF_DAY',
    message: 'timeOfDay 값이 올바르지 않습니다.',
    detail: { field: 'timeOfDay', allowedValues: ['DAY', 'EVENING', 'NIGHT'] },
  })
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
  @ApiTags('external-places')
  @ApiOperation({ summary: '외부 장소 상세 조회' })
  @ApiParam({ name: 'googlePlaceId', example: 'ChIJ...' })
  @ApiSuccessEnvelope({ model: ExternalPlaceDetailDto })
  async getExternalPlaceDetail(
    @Param('googlePlaceId') googlePlaceId: string,
  ): Promise<ResponsePayload<ExternalPlaceDetail>> {
    const validatedGooglePlaceId = validateGooglePlaceId(googlePlaceId);

    return {
      message: '외부 장소 상세 조회에 성공했습니다.',
      data: await this.placesService.getExternalPlaceDetail(
        validatedGooglePlaceId,
      ),
    };
  }

  @Get('google/:googlePlaceId/package')
  @ApiTags('external-places')
  @ApiOperation({ summary: '외부 Place package 조회' })
  @ApiParam({ name: 'googlePlaceId', example: 'ChIJ...' })
  @ApiSuccessEnvelope({ model: ExternalPlacePackageResponseDto })
  async getExternalPlacePackage(
    @Param('googlePlaceId') googlePlaceId: string,
  ): Promise<ResponsePayload<ExternalPlacePackageResponse>> {
    const validatedGooglePlaceId = validateGooglePlaceId(googlePlaceId);

    return {
      message: '외부 Place package 조회에 성공했습니다.',
      data: await this.placesService.getExternalPlacePackage(
        validatedGooglePlaceId,
      ),
    };
  }

  @Get('google/:googlePlaceId/snapshot')
  @ApiTags('external-places')
  @ApiOperation({ summary: '외부 Scene snapshot 조회' })
  @ApiParam({ name: 'googlePlaceId', example: 'ChIJ...' })
  @ApiQuery({ name: 'timeOfDay', required: false, enum: TIME_OF_DAY_VALUES })
  @ApiQuery({ name: 'weather', required: false, enum: WEATHER_VALUES })
  @ApiQuery({
    name: 'date',
    required: false,
    type: String,
    example: '2026-04-04',
  })
  @ApiSuccessEnvelope({ model: ExternalSceneSnapshotResponseDto })
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
    const date =
      parseOptionalIsoDate(rawDate) ?? new Date().toISOString().slice(0, 10);

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
