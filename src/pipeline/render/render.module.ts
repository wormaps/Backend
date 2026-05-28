import { Module } from '@nestjs/common';

import { MeshPlanBuilderService } from './application/mesh-plan-builder.service';
import { RenderIntentPolicyService } from './application/render-intent-policy.service';
import { RenderIntentResolverService } from './application/render-intent-resolver.service';
import { TwinModule } from '../twin/twin.module';

@Module({
  imports: [TwinModule],
  providers: [RenderIntentPolicyService, RenderIntentResolverService, MeshPlanBuilderService],
  exports: [RenderIntentResolverService, MeshPlanBuilderService],
})
export class RenderModule {}
