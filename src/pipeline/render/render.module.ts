import { Module } from '@nestjs/common';

import { MeshPlanBuilderService } from './application';
import { RenderIntentPolicyService } from './application';
import { RenderIntentResolverService } from './application';
import { TwinModule } from '../twin';

@Module({
  imports: [TwinModule],
  providers: [RenderIntentPolicyService, RenderIntentResolverService, MeshPlanBuilderService],
  exports: [RenderIntentResolverService, MeshPlanBuilderService],
})
export class RenderModule {}
