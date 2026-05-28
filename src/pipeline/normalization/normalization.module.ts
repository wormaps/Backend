import { Module } from '@nestjs/common';

import { NormalizedEntityBuilderService } from './application/normalized-entity-builder.service';

@Module({
  providers: [NormalizedEntityBuilderService],
  exports: [NormalizedEntityBuilderService],
})
export class NormalizationModule {}
