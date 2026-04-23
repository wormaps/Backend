import type { RenderIntent } from '../../../packages/contracts/render-intent';
import type { QaIssue } from '../../../packages/contracts/qa';
import type {
  SceneRelationship,
  TwinEntity,
  TwinSceneGraph,
} from '../../../packages/contracts/twin-scene-graph';

export class RenderIntentPolicyService {
  resolve(graph: TwinSceneGraph): RenderIntent[] {
    return graph.entities.map((entity) => this.resolveEntityIntent(entity, graph.relationships));
  }

  private resolveEntityIntent(entity: TwinEntity, relationships: SceneRelationship[]): RenderIntent {
    const conflictRelationships = relationships.filter(
      (relationship) =>
        relationship.relation === 'conflicts' &&
        (relationship.fromEntityId === entity.id || relationship.toEntityId === entity.id),
    );

    if (this.hasIssue(entity.qualityIssues, 'GEOMETRY_SELF_INTERSECTION')) {
      return this.intent(entity, 'excluded', 'L2', ['GEOMETRY_SELF_INTERSECTION_EXCLUDED']);
    }

    if (conflictRelationships.length > 0) {
      return this.intent(entity, 'placeholder', 'L2', ['SCENE_CONFLICT_PLACEHOLDER']);
    }

    if (this.hasIssue(entity.qualityIssues, 'SCENE_DUPLICATED_FOOTPRINT')) {
      return this.intent(entity, 'placeholder', 'L1', ['SCENE_DUPLICATE_PLACEHOLDER']);
    }

    if (entity.confidence < 0.5) {
      return this.intent(entity, 'placeholder', 'L1', ['LOW_CONFIDENCE_PLACEHOLDER']);
    }

    if (entity.type === 'traffic_flow') {
      return this.intent(entity, 'traffic_overlay', 'L0', ['TRAFFIC_FLOW_OVERLAY']);
    }

    if (entity.type === 'poi') {
      return this.intent(entity, 'placeholder', 'L1', ['POI_MARKER_PLACEHOLDER']);
    }

    return this.intent(entity, 'massing', 'L0', ['MVP_MASSING_ONLY']);
  }

  private intent(
    entity: TwinEntity,
    visualMode: RenderIntent['visualMode'],
    lod: RenderIntent['lod'],
    reasonCodes: string[],
  ): RenderIntent {
    return {
      entityId: entity.id,
      visualMode,
      allowedDetails: {
        windows: false,
        entrances: false,
        roofEquipment: false,
        facadeMaterial: false,
        signage: false,
      },
      lod,
      reasonCodes,
      confidence: entity.confidence,
    };
  }

  private hasIssue(issues: QaIssue[], code: QaIssue['code']): boolean {
    return issues.some((issue) => issue.code === code);
  }
}
