import { Module } from '@nestjs/common';
import { CuratedAssetResolverService, SceneFidelityPlannerService } from '../services/planning';

@Module({
  providers: [CuratedAssetResolverService, SceneFidelityPlannerService],
  exports: [CuratedAssetResolverService, SceneFidelityPlannerService],
})
export class ScenePlanningModule {}
