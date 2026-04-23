import { NormalizedEntityBuilderService } from './application/normalized-entity-builder.service';

export const normalizationModule = {
  name: 'normalization',
  services: {
    normalizedEntityBuilder: new NormalizedEntityBuilderService(),
  },
} as const;
