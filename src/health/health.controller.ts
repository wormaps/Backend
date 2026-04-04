import { Controller, Get } from '@nestjs/common';
import type { ResponsePayload } from '../common/http/api-response.interceptor';

@Controller('health')
export class HealthController {
  @Get()
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
