import { Injectable, Logger } from '@nestjs/common';
import type { SceneRelationship, TwinEntity } from '../../../shared/contracts';

@Injectable()
export class SceneRelationshipBuilderService {
  private readonly logger = new Logger(SceneRelationshipBuilderService.name);

  build(entities: TwinEntity[]): SceneRelationship[] {
    this.logger.debug(`Building relationships for ${entities.length} entities`);
    const relationships: SceneRelationship[] = [];
    const traffic = entities.find((entity) => entity.type === 'traffic_flow');
    const road = entities.find((entity) => entity.type === 'road');

    if (traffic !== undefined && road !== undefined) {
      relationships.push({
        id: `rel:${traffic.id}:${road.id}:matches_traffic_fragment`,
        fromEntityId: traffic.id,
        toEntityId: road.id,
        relation: 'matches_traffic_fragment',
        confidence: 0.9,
        reasonCodes: ['TRAFFIC_AND_ROAD_PRESENT'],
      });
    }

    const duplicateCandidate = entities.find((entity) =>
      entity.qualityIssues.some((issue) => issue.code === 'SCENE_DUPLICATED_FOOTPRINT'),
    );
    const duplicatePeer = entities.find(
      (entity) => entity.id !== duplicateCandidate?.id && entity.type === duplicateCandidate?.type,
    );

    if (duplicateCandidate !== undefined && duplicatePeer !== undefined) {
      relationships.push({
        id: `rel:${duplicateCandidate.id}:${duplicatePeer.id}:duplicates`,
        fromEntityId: duplicateCandidate.id,
        toEntityId: duplicatePeer.id,
        relation: 'duplicates',
        confidence: 0.85,
        reasonCodes: ['SCENE_DUPLICATED_FOOTPRINT'],
      });
    }

    const overlapRoads = entities.filter(
      (entity) =>
        entity.type === 'road' &&
        entity.qualityIssues.some((issue) => issue.code === 'SCENE_ROAD_BUILDING_OVERLAP'),
    );
    const buildings = entities.filter((entity) => entity.type === 'building');

    // No per-entity overlap data yet — conservatively conflict each overlapping road
    // against all buildings so no actually-overlapping building escapes placeholder mode.
    for (const overlapRoad of overlapRoads) {
      for (const building of buildings) {
        relationships.push({
          id: `rel:${overlapRoad.id}:${building.id}:conflicts`,
          fromEntityId: overlapRoad.id,
          toEntityId: building.id,
          relation: 'conflicts',
          confidence: 0.9,
          reasonCodes: ['SCENE_ROAD_BUILDING_OVERLAP'],
        });
      }
    }

    return relationships;
  }
}
