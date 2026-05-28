import { Module } from '@nestjs/common';

import { EvidenceGraphBuilderService } from './application/evidence-graph-builder.service';
import { RealityTierResolverService } from './application/reality-tier-resolver.service';
import { SceneRelationshipBuilderService } from './application/scene-relationship-builder.service';
import { TwinEntityProjectionService } from './application/twin-entity-projection.service';
import { TwinGraphBuilderService } from './application/twin-graph-builder.service';
import { TwinSceneGraphMetadataFactory } from './application/twin-scene-graph-metadata.factory';
import { TwinGraphValidationService } from './application/twin-graph-validation.service';
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
