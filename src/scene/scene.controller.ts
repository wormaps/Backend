import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
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
import { ensureRequestContext } from '../common/http/request-context.util';
import {
  parseOptionalEnum,
  parseOptionalIsoDate,
  parseRequiredQuery,
  validatePlaceId,
} from '../common/http/query-parsers';
import { ApiErrorEnvelope, ApiSuccessEnvelope } from '../docs/decorators';
import {
  BootstrapResponseDto,
  CreateSceneRequestDto,
  MidQaReportDto,
  SceneDetailDto,
  SceneEvidenceDto,
  SceneEntityStateResponseDto,
  SceneEntityDto,
  SceneMetaDto,
  ScenePlacesResponseDto,
  SceneStateResponseDto,
  SceneTrafficResponseDto,
  SceneTwinGraphDto,
  ValidationReportDto,
  SceneWeatherResponseDto,
} from '../docs/scene';
import type { StoredSceneCuratedAssetPayload } from './types/scene.types';
import {
  TIME_OF_DAY_VALUES,
  WEATHER_VALUES,
} from '../places/types/place.types';
import { SceneService } from './scene.service';
import { getSceneDataDir } from './storage/scene-storage.utils';
import {
  BootstrapResponse,
  MidQaReport,
  SceneDetail,
  SceneEntity,
  SceneEntityStateResponse,
  SceneMeta,
  ScenePlacesResponse,
  SCENE_SCALE_VALUES,
  SceneStateResponse,
  SceneTrafficResponse,
  TWIN_ENTITY_KIND_VALUES,
  TwinEvidence,
  SceneTwinGraph,
  ValidationReport,
  SceneWeatherResponse,
} from './types/scene.types';

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
    @Req() request: Request,
    @Body('query') query?: string,
    @Body('scale') rawScale?: string,
    @Body('forceRegenerate') rawForceRegenerate?: boolean | string,
    @Body('curatedAssetPayload')
    curatedAssetPayload?: StoredSceneCuratedAssetPayload,
  ): Promise<ResponsePayload<SceneEntity>> {
    const validatedQuery = parseRequiredQuery(query, 'query');
    const scale = parseOptionalEnum(
      rawScale,
      SCENE_SCALE_VALUES,
      ERROR_CODES.INVALID_SCENE_SCALE,
      'scale',
    );
    const requestContext = ensureRequestContext(request);
    const forceRegenerate =
      rawForceRegenerate === true || rawForceRegenerate === 'true';

    return {
      message: 'Scene 생성에 성공했습니다.',
      data: await this.sceneService.createScene(
        validatedQuery,
        scale ?? 'MEDIUM',
        {
          forceRegenerate,
          requestId: requestContext.requestId,
          source: 'api',
          curatedAssetPayload,
        },
      ),
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
    response.sendFile(join(getSceneDataDir(), `${validatedSceneId}.glb`));
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

  @Get(':sceneId/twin')
  @ApiOperation({ summary: 'Scene twin graph 조회' })
  @ApiParam({ name: 'sceneId', example: 'scene-seoul-city-hall' })
  @ApiSuccessEnvelope({ model: SceneTwinGraphDto })
  getTwin(
    @Param('sceneId') sceneId: string,
  ): Promise<ResponsePayload<SceneTwinGraph>> {
    const validatedSceneId = validatePlaceId(sceneId);

    return this.sceneService.getSceneTwin(validatedSceneId).then((data) => ({
      message: 'Scene twin graph 조회에 성공했습니다.',
      data,
    }));
  }

  @Get(':sceneId/validation')
  @ApiOperation({ summary: 'Scene validation report 조회' })
  @ApiParam({ name: 'sceneId', example: 'scene-seoul-city-hall' })
  @ApiSuccessEnvelope({ model: ValidationReportDto })
  getValidation(
    @Param('sceneId') sceneId: string,
  ): Promise<ResponsePayload<ValidationReport>> {
    const validatedSceneId = validatePlaceId(sceneId);

    return this.sceneService
      .getValidationReport(validatedSceneId)
      .then((data) => ({
        message: 'Scene validation report 조회에 성공했습니다.',
        data,
      }));
  }

  @Get(':sceneId/evidence')
  @ApiOperation({ summary: 'Scene evidence 조회' })
  @ApiParam({ name: 'sceneId', example: 'scene-seoul-city-hall' })
  @ApiSuccessEnvelope({ model: SceneEvidenceDto, isArray: true })
  getEvidence(
    @Param('sceneId') sceneId: string,
  ): Promise<ResponsePayload<TwinEvidence[]>> {
    const validatedSceneId = validatePlaceId(sceneId);

    return this.sceneService
      .getSceneEvidence(validatedSceneId)
      .then((data) => ({
        message: 'Scene evidence 조회에 성공했습니다.',
        data,
      }));
  }

  @Get(':sceneId/qa')
  @ApiOperation({ summary: 'Scene 중간 QA report 조회' })
  @ApiParam({ name: 'sceneId', example: 'scene-seoul-city-hall' })
  @ApiSuccessEnvelope({ model: MidQaReportDto })
  getQa(
    @Param('sceneId') sceneId: string,
  ): Promise<ResponsePayload<MidQaReport>> {
    const validatedSceneId = validatePlaceId(sceneId);

    return this.sceneService.getMidQaReport(validatedSceneId).then((data) => ({
      message: 'Scene 중간 QA report 조회에 성공했습니다.',
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
  @ApiQuery({
    name: 'date',
    required: false,
    type: String,
    example: '2026-04-04',
  })
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
    const date = parseOptionalIsoDate(rawDate) ?? undefined;

    return {
      message: 'Scene weather 조회에 성공했습니다.',
      data: await this.sceneService.getWeather(validatedSceneId, {
        date,
        timeOfDay: timeOfDay ?? 'DAY',
      }),
    };
  }

  @Get(':sceneId/state')
  @ApiOperation({ summary: 'Scene live state 조회' })
  @ApiParam({ name: 'sceneId', example: 'scene-seoul-city-hall' })
  @ApiQuery({
    name: 'date',
    required: false,
    type: String,
    example: '2026-04-04',
  })
  @ApiQuery({ name: 'timeOfDay', required: false, enum: TIME_OF_DAY_VALUES })
  @ApiQuery({ name: 'weather', required: false, enum: WEATHER_VALUES })
  @ApiSuccessEnvelope({ model: SceneStateResponseDto })
  async getState(
    @Param('sceneId') sceneId: string,
    @Query('date') rawDate?: string,
    @Query('timeOfDay') rawTimeOfDay?: string,
    @Query('weather') rawWeather?: string,
  ): Promise<ResponsePayload<SceneStateResponse>> {
    const validatedSceneId = validatePlaceId(sceneId);
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
    const date = parseOptionalIsoDate(rawDate) ?? undefined;

    return {
      message: 'Scene live state 조회에 성공했습니다.',
      data: await this.sceneService.getState(validatedSceneId, {
        date,
        timeOfDay: timeOfDay ?? 'DAY',
        weather: weather ?? undefined,
      }),
    };
  }

  @Get(':sceneId/state/entities')
  @ApiOperation({ summary: 'Scene entity live state 조회' })
  @ApiParam({ name: 'sceneId', example: 'scene-seoul-city-hall' })
  @ApiQuery({
    name: 'date',
    required: false,
    type: String,
    example: '2026-04-04',
  })
  @ApiQuery({ name: 'timeOfDay', required: false, enum: TIME_OF_DAY_VALUES })
  @ApiQuery({ name: 'weather', required: false, enum: WEATHER_VALUES })
  @ApiQuery({ name: 'kind', required: false, enum: TWIN_ENTITY_KIND_VALUES })
  @ApiQuery({ name: 'objectId', required: false, type: String })
  @ApiSuccessEnvelope({ model: SceneEntityStateResponseDto })
  async getEntityState(
    @Param('sceneId') sceneId: string,
    @Query('date') rawDate?: string,
    @Query('timeOfDay') rawTimeOfDay?: string,
    @Query('weather') rawWeather?: string,
    @Query('kind') rawKind?: string,
    @Query('objectId') rawObjectId?: string,
  ): Promise<ResponsePayload<SceneEntityStateResponse>> {
    const validatedSceneId = validatePlaceId(sceneId);
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
    const kind = parseOptionalEnum(
      rawKind,
      TWIN_ENTITY_KIND_VALUES,
      ERROR_CODES.INVALID_REQUEST,
      'kind',
    );
    const date = parseOptionalIsoDate(rawDate) ?? undefined;

    return {
      message: 'Scene entity live state 조회에 성공했습니다.',
      data: await this.sceneService.getEntityState(validatedSceneId, {
        date,
        timeOfDay: timeOfDay ?? 'DAY',
        weather: weather ?? undefined,
        kind,
        objectId: rawObjectId?.trim() ? rawObjectId.trim() : undefined,
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
