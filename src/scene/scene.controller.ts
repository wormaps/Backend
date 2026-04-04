import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { join } from 'node:path';
import {
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { ERROR_CODES } from '../common/constants/error-codes';
import type { ResponsePayload } from '../common/http/api-response.interceptor';
import {
  parseOptionalEnum,
  parseOptionalIsoDate,
  parseRequiredQuery,
  validatePlaceId,
} from '../common/http/query-parsers';
import { ApiErrorEnvelope, ApiSuccessEnvelope } from '../docs/swagger.decorators';
import {
  BootstrapResponseDto,
  CreateSceneRequestDto,
  SceneDetailDto,
  SceneEntityDto,
  SceneMetaDto,
  ScenePlacesResponseDto,
  SceneTrafficResponseDto,
  SceneWeatherResponseDto,
} from '../docs/swagger.dto';
import { TIME_OF_DAY_VALUES } from '../places/place.types';
import { SceneService } from './scene.service';
import { getSceneDataDir } from './scene-storage.utils';
import {
  BootstrapResponse,
  SceneDetail,
  SceneEntity,
  SceneMeta,
  ScenePlacesResponse,
  SCENE_SCALE_VALUES,
  SceneTrafficResponse,
  SceneWeatherResponse,
} from './scene.types';

@ApiTags('scenes')
@Controller('scenes')
export class SceneController {
  constructor(private readonly sceneService: SceneService) {}

  @Post()
  @HttpCode(202)
  @ApiOperation({ summary: 'Scene 생성' })
  @ApiBody({ type: CreateSceneRequestDto })
  @ApiSuccessEnvelope({ model: SceneEntityDto })
  @ApiErrorEnvelope(400, {
    code: 'INVALID_QUERY',
    message: 'query 값이 필요합니다.',
    detail: { field: 'query' },
  })
  async createScene(
    @Body('query') query?: string,
    @Body('scale') rawScale?: string,
  ): Promise<ResponsePayload<SceneEntity>> {
    const validatedQuery = parseRequiredQuery(query, 'query');
    const scale = parseOptionalEnum(
      rawScale,
      SCENE_SCALE_VALUES,
      ERROR_CODES.INVALID_SCENE_SCALE,
      'scale',
    );

    return {
      message: 'Scene 생성에 성공했습니다.',
      data: await this.sceneService.createScene(validatedQuery, scale ?? 'MEDIUM'),
    };
  }

  @Get(':sceneId')
  @ApiOperation({ summary: 'Scene 기본 정보 조회' })
  @ApiParam({ name: 'sceneId', example: 'scene-seoul-city-hall' })
  @ApiSuccessEnvelope({ model: SceneEntityDto })
  getScene(
    @Param('sceneId') sceneId: string,
  ): Promise<ResponsePayload<SceneEntity>> {
    const validatedSceneId = validatePlaceId(sceneId);

    return this.sceneService.getScene(validatedSceneId).then((data) => ({
      message: 'Scene 기본 정보 조회에 성공했습니다.',
      data,
    }));
  }

  @Get(':sceneId/status')
  @ApiOperation({ summary: 'Scene 상태 조회' })
  @ApiParam({ name: 'sceneId', example: 'scene-seoul-city-hall' })
  @ApiSuccessEnvelope({ model: SceneEntityDto })
  getSceneStatus(
    @Param('sceneId') sceneId: string,
  ): Promise<ResponsePayload<SceneEntity>> {
    return this.getScene(sceneId);
  }

  @Get(':sceneId/assets/base.glb')
  @ApiOperation({ summary: 'Scene base GLB 다운로드' })
  @ApiParam({ name: 'sceneId', example: 'scene-seoul-city-hall' })
  async getSceneAsset(
    @Param('sceneId') sceneId: string,
    @Res() response: Response,
  ): Promise<void> {
    const validatedSceneId = validatePlaceId(sceneId);
    await this.sceneService.getBootstrap(validatedSceneId);
    response.sendFile(
      join(getSceneDataDir(), `${validatedSceneId}.glb`),
    );
  }

  @Get(':sceneId/meta')
  @ApiOperation({ summary: 'Scene meta 조회' })
  @ApiParam({ name: 'sceneId', example: 'scene-seoul-city-hall' })
  @ApiSuccessEnvelope({ model: SceneMetaDto })
  getSceneMeta(
    @Param('sceneId') sceneId: string,
  ): Promise<ResponsePayload<SceneMeta>> {
    const validatedSceneId = validatePlaceId(sceneId);

    return this.sceneService.getSceneMeta(validatedSceneId).then((data) => ({
      message: 'Scene meta 조회에 성공했습니다.',
      data,
    }));
  }

  @Get(':sceneId/bootstrap')
  @ApiOperation({ summary: 'Scene bootstrap 조회' })
  @ApiParam({ name: 'sceneId', example: 'scene-seoul-city-hall' })
  @ApiSuccessEnvelope({ model: BootstrapResponseDto })
  getBootstrap(
    @Param('sceneId') sceneId: string,
  ): Promise<ResponsePayload<BootstrapResponse>> {
    const validatedSceneId = validatePlaceId(sceneId);

    return this.sceneService.getBootstrap(validatedSceneId).then((data) => ({
      message: 'Scene bootstrap 조회에 성공했습니다.',
      data,
    }));
  }

  @Get(':sceneId/detail')
  @ApiOperation({ summary: 'Scene detail 조회' })
  @ApiParam({ name: 'sceneId', example: 'scene-seoul-city-hall' })
  @ApiSuccessEnvelope({ model: SceneDetailDto })
  getDetail(
    @Param('sceneId') sceneId: string,
  ): Promise<ResponsePayload<SceneDetail>> {
    const validatedSceneId = validatePlaceId(sceneId);

    return this.sceneService.getSceneDetail(validatedSceneId).then((data) => ({
      message: 'Scene detail 조회에 성공했습니다.',
      data,
    }));
  }

  @Get(':sceneId/places')
  @ApiOperation({ summary: 'Scene places overlay 조회' })
  @ApiParam({ name: 'sceneId', example: 'scene-seoul-city-hall' })
  @ApiSuccessEnvelope({ model: ScenePlacesResponseDto })
  getPlaces(
    @Param('sceneId') sceneId: string,
  ): Promise<ResponsePayload<ScenePlacesResponse>> {
    const validatedSceneId = validatePlaceId(sceneId);

    return this.sceneService.getPlaces(validatedSceneId).then((data) => ({
      message: 'Scene places overlay 조회에 성공했습니다.',
      data,
    }));
  }

  @Get(':sceneId/weather')
  @ApiOperation({ summary: 'Scene weather 조회' })
  @ApiParam({ name: 'sceneId', example: 'scene-seoul-city-hall' })
  @ApiQuery({ name: 'date', required: false, type: String, example: '2026-04-04' })
  @ApiQuery({ name: 'timeOfDay', required: false, enum: TIME_OF_DAY_VALUES })
  @ApiSuccessEnvelope({ model: SceneWeatherResponseDto })
  async getWeather(
    @Param('sceneId') sceneId: string,
    @Query('date') rawDate?: string,
    @Query('timeOfDay') rawTimeOfDay?: string,
  ): Promise<ResponsePayload<SceneWeatherResponse>> {
    const validatedSceneId = validatePlaceId(sceneId);
    const timeOfDay = parseOptionalEnum(
      rawTimeOfDay,
      TIME_OF_DAY_VALUES,
      ERROR_CODES.INVALID_TIME_OF_DAY,
      'timeOfDay',
    );
    const date =
      parseOptionalIsoDate(rawDate) ?? new Date().toISOString().slice(0, 10);

    return {
      message: 'Scene weather 조회에 성공했습니다.',
      data: await this.sceneService.getWeather(validatedSceneId, {
        date,
        timeOfDay: timeOfDay ?? 'DAY',
      }),
    };
  }

  @Get(':sceneId/traffic')
  @ApiOperation({ summary: 'Scene traffic 조회' })
  @ApiParam({ name: 'sceneId', example: 'scene-seoul-city-hall' })
  @ApiSuccessEnvelope({ model: SceneTrafficResponseDto })
  async getTraffic(
    @Param('sceneId') sceneId: string,
  ): Promise<ResponsePayload<SceneTrafficResponse>> {
    const validatedSceneId = validatePlaceId(sceneId);

    return {
      message: 'Scene traffic 조회에 성공했습니다.',
      data: await this.sceneService.getTraffic(validatedSceneId),
    };
  }
}
