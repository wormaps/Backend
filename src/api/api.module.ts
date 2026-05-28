import { Module } from '@nestjs/common';

import { BuildModule } from '../build/build.module';
import { ProvidersModule } from '../providers/providers.module';
import { BuildController } from './build.controller';
import { BuildGatewayService } from './build.gateway.service';

@Module({
  imports: [BuildModule, ProvidersModule],
  controllers: [BuildController],
  providers: [BuildGatewayService],
})
export class ApiModule {}
