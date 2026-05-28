import { Module } from '@nestjs/common';

import { BuildModule } from '../build';
import { ProvidersModule } from '../providers';
import { BuildController } from './build.controller';
import { BuildGatewayService } from './build.gateway.service';

@Module({
  imports: [BuildModule, ProvidersModule],
  controllers: [BuildController],
  providers: [BuildGatewayService],
})
export class ApiModule {}
