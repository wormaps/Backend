import { Module } from '@nestjs/common';

import { BuildController } from './build.controller';
import { BuildGatewayService } from './build.gateway.service';

@Module({
  controllers: [BuildController],
  providers: [BuildGatewayService],
})
export class HttpAppModule {}
