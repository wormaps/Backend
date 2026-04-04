import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { ResponsePayload } from '../common/http/api-response.interceptor';
import { ApiSuccessEnvelope } from '../docs/swagger.decorators';
import { HealthDataDto } from '../docs/swagger.dto';

@ApiTags('health')
@Controller('health')
export class HealthController {
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
}
