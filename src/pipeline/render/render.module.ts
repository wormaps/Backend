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
