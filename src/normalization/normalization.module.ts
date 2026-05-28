import { Module } from '@nestjs/common';

import { NormalizedEntityBuilderService } from './application/normalized-entity-builder.service';

@Module({
  providers: [NormalizedEntityBuilderService],
  exports: [NormalizedEntityBuilderService],
})
export class NormalizationModule {}

// Legacy export kept temporarily until AppModule fully migrates to Nest DI.
export const normalizationModule = {
  name: 'normalization',
  services: {
    normalizedEntityBuilder: new NormalizedEntityBuilderService(),
  },
} as const;
