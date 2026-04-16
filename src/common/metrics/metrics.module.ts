import { Module } from '@nestjs/common';
import { MetricsController } from './metrics.controller';
import { AppMetricsService } from './app-metrics.service';
import { appMetrics } from './metrics.instance';

@Module({
  controllers: [MetricsController],
  providers: [
    {
      provide: AppMetricsService,
      useValue: appMetrics,
    },
  ],
  exports: [AppMetricsService],
})
export class MetricsModule {}
