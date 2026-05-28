import { Module } from '@nestjs/common';

import { MeshPlanBuilderService } from './application/mesh-plan-builder.service';
import { RenderIntentPolicyService } from './application/render-intent-policy.service';
import { RenderIntentResolverService } from './application/render-intent-resolver.service';
import { TwinModule } from '../twin/twin.module';
import { RealityTierResolverService } from '../twin/application/reality-tier-resolver.service';

@Module({
  imports: [TwinModule],
  providers: [RenderIntentPolicyService, RenderIntentResolverService, MeshPlanBuilderService, RealityTierResolverService],
  exports: [RenderIntentResolverService, MeshPlanBuilderService],
})
export class RenderModule {}

const renderIntentPolicy = new RenderIntentPolicyService();
const realityTierResolver = new RealityTierResolverService();

// Legacy export kept temporarily until AppModule fully migrates to Nest DI.
export const renderModule = {
  name: 'render',
  services: {
    renderIntentPolicy,
    renderIntentResolver: new RenderIntentResolverService(
      renderIntentPolicy,
      realityTierResolver,
    ),
    meshPlanBuilder: new MeshPlanBuilderService(),
  },
} as const;
