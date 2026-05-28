import { Module } from '@nestjs/common';

import { NormalizedEntityBuilderService } from './application';

@Module({
  providers: [NormalizedEntityBuilderService],
  exports: [NormalizedEntityBuilderService],
})
export class NormalizationModule {}
