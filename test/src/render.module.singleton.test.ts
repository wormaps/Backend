import { describe, expect, it } from 'bun:test';
import { Test } from '@nestjs/testing';

import { RenderModule } from '../../src/pipeline/render/render.module';
import { RenderIntentResolverService } from '../../src/pipeline/render/application/render-intent-resolver.service';
import { RealityTierResolverService } from '../../src/pipeline/twin/application/reality-tier-resolver.service';

describe('RenderModule DI', () => {
  it('uses TwinModule-exported RealityTierResolverService instance', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [RenderModule],
    }).compile();

    const resolver = moduleRef.get(RenderIntentResolverService) as unknown as {
      realityTierResolver: RealityTierResolverService;
    };
    const tierResolver = moduleRef.get(RealityTierResolverService);

    expect(resolver.realityTierResolver).toBe(tierResolver);
  });
});
