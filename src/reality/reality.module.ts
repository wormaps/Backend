import { RealityTierResolverService } from './application/reality-tier-resolver.service';

const realityTierResolver = new RealityTierResolverService();

export const realityModule = {
  name: 'reality',
  services: {
    realityTierResolver,
  },
} as const;
