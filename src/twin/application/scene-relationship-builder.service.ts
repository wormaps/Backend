import type { SceneRelationship, TwinEntity } from '../../../packages/contracts/twin-scene-graph';

export class SceneRelationshipBuilderService {
  build(entities: TwinEntity[]): SceneRelationship[] {
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

    const overlapRoad = entities.find(
      (entity) =>
        entity.type === 'road' &&
        entity.qualityIssues.some((issue) => issue.code === 'SCENE_ROAD_BUILDING_OVERLAP'),
    );
    const overlapBuilding = entities.find((entity) => entity.type === 'building');

    if (overlapRoad !== undefined && overlapBuilding !== undefined) {
      relationships.push({
        id: `rel:${overlapRoad.id}:${overlapBuilding.id}:conflicts`,
        fromEntityId: overlapRoad.id,
        toEntityId: overlapBuilding.id,
        relation: 'conflicts',
        confidence: 0.9,
        reasonCodes: ['SCENE_ROAD_BUILDING_OVERLAP'],
      });
    }

    return relationships;
  }
}
