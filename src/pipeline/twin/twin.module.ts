import { Module } from '@nestjs/common';

import { EvidenceGraphBuilderService } from './application';
import { RealityTierResolverService } from './application';
import { SceneRelationshipBuilderService } from './application';
import { TwinEntityProjectionService } from './application';
import { TwinGraphBuilderService } from './application';
import { TwinSceneGraphMetadataFactory } from './application';
import { TwinGraphValidationService } from './application';
@Module({
  providers: [
    EvidenceGraphBuilderService,
    TwinEntityProjectionService,
    SceneRelationshipBuilderService,
    TwinGraphValidationService,
    RealityTierResolverService,
    TwinSceneGraphMetadataFactory,
    TwinGraphBuilderService,
  ],
  exports: [EvidenceGraphBuilderService, TwinGraphBuilderService, RealityTierResolverService],
})
export class TwinModule {}
