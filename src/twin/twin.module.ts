import { EvidenceGraphBuilderService } from './application/evidence-graph-builder.service';
import { SceneRelationshipBuilderService } from './application/scene-relationship-builder.service';
import { TwinEntityProjectionService } from './application/twin-entity-projection.service';
import { TwinGraphBuilderService } from './application/twin-graph-builder.service';
import { TwinSceneGraphMetadataFactory } from './application/twin-scene-graph-metadata.factory';
import { TwinGraphValidationService } from './application/twin-graph-validation.service';
import { realityModule } from '../reality/reality.module';

const twinEntityProjection = new TwinEntityProjectionService();
const sceneRelationshipBuilder = new SceneRelationshipBuilderService();
const twinGraphValidation = new TwinGraphValidationService();
const twinSceneGraphMetadataFactory = new TwinSceneGraphMetadataFactory(realityModule.services.realityTierResolver);

export const twinModule = {
  name: 'twin',
  services: {
    evidenceGraphBuilder: new EvidenceGraphBuilderService(),
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
