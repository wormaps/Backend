import { Controller, Get, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { ResponsePayload } from '../common/http/api-response.interceptor';
import { Public } from '../common/http/public.decorator';
import { ApiSuccessEnvelope } from '../docs/decorators';
import { HealthDataDto } from '../docs/health';
import { HealthService } from './health.service';
import type { Response } from 'express';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: '헬스 체크' })
  @ApiSuccessEnvelope({ model: HealthDataDto })
  getHealth(): ResponsePayload<{ service: string; uptimeSeconds: number }> {
    return {
      message: '서비스 상태가 정상입니다.',
      data: {
        service: 'wormapb',
        uptimeSeconds: Math.round(process.uptime()),
      },
    };
  }

  @Public()
  @Get('liveness')
  @ApiOperation({ summary: 'Liveness 체크 (프로세스 uptime)' })
  getLiveness(): ResponsePayload<{ status: 'ok'; uptimeSeconds: number }> {
    return {
      message: '서비스가 정상적으로 실행 중입니다.',
      data: this.healthService.checkLiveness(),
    };
  }

  @Public()
  @Get('readiness')
  @ApiOperation({ summary: 'Readiness 체크 (외부 API 연결 상태)' })
  async getReadiness(
    @Res({ passthrough: true }) response: Response,
  ): Promise<
    ResponsePayload<{
      status: 'ok' | 'degraded';
      checks: {
        googlePlaces: boolean;
        overpass: boolean;
        mapillary: boolean;
        tomtom: boolean;
      };
    }>
  > {
    const result = await this.healthService.checkReadiness();
    response.status(result.status === 'ok' ? 200 : 503);
    return {
      message:
        result.status === 'ok'
          ? '모든 외부 서비스가 정상입니다.'
          : '일부 외부 서비스에 문제가 있습니다.',
      data: result,
    };
  }
}
