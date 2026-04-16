import { Controller, Get, Header } from '@nestjs/common';
import { Public } from '../http/public.decorator';
import { appMetrics } from './metrics.instance';

@Controller('metrics')
export class MetricsController {
  @Public()
  @Get()
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  getMetrics(): string {
    return appMetrics.renderPrometheus();
  }
}

