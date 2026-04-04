import { CallHandler, ExecutionContext } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { of } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import { AppModule } from './../src/app.module';
import { ERROR_CODES } from './../src/common/constants/error-codes';
import { AppException } from './../src/common/errors/app.exception';
import { ApiExceptionFilter } from './../src/common/http/api-exception.filter';
import {
  ApiResponseInterceptor,
  ResponsePayload,
} from './../src/common/http/api-response.interceptor';
import { HealthController } from './../src/health/health.controller';
import { PlacesController } from './../src/places/places.controller';

describe('AppModule integration', () => {
  let healthController: HealthController;
  let placesController: PlacesController;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    healthController = moduleFixture.get<HealthController>(HealthController);
    placesController = moduleFixture.get<PlacesController>(PlacesController);
  });

  it('should expose health data', () => {
    const response = healthController.getHealth();

    expect(response.message).toBe('서비스 상태가 정상입니다.');
    expect(response.data.service).toBe('wormapb');
  });

  it('should expose places registry', () => {
    const response = placesController.getPlaces();

    expect(response.data).toHaveLength(4);
    expect(response.data[0]?.id).toBe('shibuya-crossing');
  });

  it('should build scene snapshot through controller query flow', () => {
    const response = placesController.getSceneSnapshot(
      'gangnam-station',
      'night',
      'snow',
    );

    expect(response.data.placeId).toBe('gangnam-station');
    expect(response.data.timeOfDay).toBe('NIGHT');
    expect(response.data.weather).toBe('SNOW');
    expect(response.data.surface.snowCover).toBe(true);
  });

  it('should throw standardized app exception inputs before service call', () => {
    expect(() =>
      placesController.getSceneSnapshot('gangnam-station', 'dawn', 'clear'),
    ).toThrow(AppException);
  });

  it('should validate external search query requirement', async () => {
    await expect(
      placesController.searchPlaces(undefined, undefined),
    ).rejects.toThrow(AppException);
  });
});

describe('HTTP envelope integration', () => {
  it('should wrap success payload with request metadata', async () => {
    const interceptor = new ApiResponseInterceptor<{ service: string }>();
    const response = {
      statusCode: 200,
      setHeader: jest.fn(),
    };
    const request = {
      header: jest.fn().mockReturnValue(undefined),
    };
    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    } as ExecutionContext;
    const next: CallHandler<ResponsePayload<{ service: string }>> = {
      handle: () =>
        of({
          message: 'ok',
          data: {
            service: 'wormapb',
          },
        }),
    };

    const result = await firstValueFrom(interceptor.intercept(context, next));

    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(result.message).toBe('ok');
    expect(result.data.service).toBe('wormapb');
    expect(result.meta.requestId).toMatch(/^req_/);
    expect(result.meta.timestamp).toMatch(/Z$/);
  });

  it('should serialize AppException with common error envelope', () => {
    const filter = new ApiExceptionFilter();
    const json = jest.fn();
    const response = {
      status: jest.fn().mockReturnValue({ json }),
      setHeader: jest.fn(),
    };
    const request = {
      header: jest.fn().mockReturnValue(undefined),
    };
    const host = {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    } as ExecutionContext;

    filter.catch(
      new AppException({
        code: ERROR_CODES.PLACE_NOT_FOUND,
        message: '장소를 찾을 수 없습니다.',
        detail: { placeId: 'unknown-place' },
      }),
      host,
    );

    expect(response.status).toHaveBeenCalledWith(400);
    const [payload] = json.mock.calls[0] as [
      {
        ok: boolean;
        status: number;
        error: {
          code: string;
          message: string;
          detail: { placeId: string };
        };
      },
    ];
    expect(payload.ok).toBe(false);
    expect(payload.status).toBe(400);
    expect(payload.error.code).toBe('PLACE_NOT_FOUND');
    expect(payload.error.message).toBe('장소를 찾을 수 없습니다.');
    expect(payload.error.detail.placeId).toBe('unknown-place');
  });
});
