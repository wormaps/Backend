import type { EvidenceGraph } from '../../../packages/contracts/evidence-graph';
import type { NormalizedEntityBundle } from '../../../packages/contracts/normalized-entity';
import type { TwinSceneGraph } from '../../../packages/contracts/twin-scene-graph';
import type { SceneScope } from '../../../packages/contracts/twin-scene-graph';
import { validateTwinSceneGraph } from '../../../packages/contracts/validate';
import { SceneRelationshipBuilderService } from './scene-relationship-builder.service';
import { TwinEntityProjectionService } from './twin-entity-projection.service';
import { TwinGraphValidationService } from './twin-graph-validation.service';
import { TwinSceneGraphMetadataFactory } from './twin-scene-graph-metadata.factory';
import { RealityTierResolverService } from '../../reality/application/reality-tier-resolver.service';

export class TwinGraphBuilderService {
  constructor(
    private readonly entityProjection = new TwinEntityProjectionService(),
    private readonly relationshipBuilder = new SceneRelationshipBuilderService(),
    private readonly graphValidation = new TwinGraphValidationService(),
    private readonly metadataFactory = new TwinSceneGraphMetadataFactory(new RealityTierResolverService()),
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
      console.warn('TwinSceneGraph validation failed:', validation.error.format());
    }

    return twinSceneGraph;
  }
}
