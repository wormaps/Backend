import { Injectable, Logger } from '@nestjs/common';
import type { EvidenceGraph } from '../../../shared/contracts';
import type { NormalizedEntityBundle } from '../../../shared/contracts';
import type { TwinSceneGraph } from '../../../shared/contracts';
import type { SceneScope } from '../../../shared/contracts';
import { validateTwinSceneGraph } from '../../../shared/contracts';
import { SceneRelationshipBuilderService } from './scene-relationship-builder.service';
import { TwinEntityProjectionService } from './twin-entity-projection.service';
import { TwinGraphValidationService } from './twin-graph-validation.service';
import { TwinSceneGraphMetadataFactory } from './twin-scene-graph-metadata.factory';

@Injectable()
export class TwinGraphBuilderService {
  private readonly logger = new Logger(TwinGraphBuilderService.name);

  constructor(
    private readonly entityProjection: TwinEntityProjectionService,
    private readonly relationshipBuilder: SceneRelationshipBuilderService,
    private readonly graphValidation: TwinGraphValidationService,
    private readonly metadataFactory: TwinSceneGraphMetadataFactory,
  ) {}

  build(
    sceneId: string,
    scope: SceneScope,
    evidenceGraph: EvidenceGraph,
    normalizedBundle: NormalizedEntityBundle,
  ): TwinSceneGraph {
    const entities = this.entityProjection.project(normalizedBundle);
    const relationships = this.relationshipBuilder.build(entities);
    const qualityIssues = this.graphValidation.validate(normalizedBundle, relationships);
    const metadata = this.metadataFactory.create(entities, qualityIssues);

    const twinSceneGraph = {
      sceneId,
      scope,
      coordinateFrame: {
        origin: scope.center,
        axes: 'ENU' as const,
        unit: 'meter' as const,
        elevationDatum: 'UNKNOWN' as const,
      },
      entities,
      relationships,
      evidenceGraphId: evidenceGraph.id,
      stateLayers: entities
        .filter((entity) => entity.type === 'traffic_flow')
        .map((entity) => ({
          id: `state:${entity.id}`,
          type: 'traffic' as const,
          entityIds: [entity.id],
          sourceSnapshotIds: entity.sourceSnapshotIds,
        })),
      metadata,
    };

    // PoC validation at pipeline boundary — warns but doesn't break existing flow
    const validation = validateTwinSceneGraph(twinSceneGraph);
    if (!validation.success) {
      this.logger.warn(`TwinSceneGraph validation failed: ${JSON.stringify(validation.error.format())}`);
    }

    return twinSceneGraph;
  }
}
