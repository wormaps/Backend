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

const twinEntityProjection = new TwinEntityProjectionService();
const sceneRelationshipBuilder = new SceneRelationshipBuilderService();
const twinGraphValidation = new TwinGraphValidationService();
const realityTierResolver = new RealityTierResolverService();
const twinSceneGraphMetadataFactory = new TwinSceneGraphMetadataFactory(realityTierResolver);

// Legacy export kept temporarily until AppModule fully migrates to Nest DI.
export const twinModule = {
  name: 'twin',
  services: {
    evidenceGraphBuilder: new EvidenceGraphBuilderService(),
    realityTierResolver,
    twinEntityProjection,
    sceneRelationshipBuilder,
    twinGraphValidation,
    twinSceneGraphMetadataFactory,
    twinGraphBuilder: new TwinGraphBuilderService(
      twinEntityProjection,
      sceneRelationshipBuilder,
      twinGraphValidation,
      twinSceneGraphMetadataFactory,
    ),
  },
} as const;
