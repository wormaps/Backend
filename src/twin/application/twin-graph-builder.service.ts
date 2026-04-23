import type { EvidenceGraph } from '../../../packages/contracts/evidence-graph';
import type { NormalizedEntityBundle } from '../../../packages/contracts/normalized-entity';
import type { SceneRelationship, TwinEntity, TwinEntityType } from '../../../packages/contracts/twin-scene-graph';
import type { TwinSceneGraph } from '../../../packages/contracts/twin-scene-graph';
import type { SceneScope } from '../../../packages/contracts/twin-scene-graph';

export class TwinGraphBuilderService {
  build(
    sceneId: string,
    scope: SceneScope,
    evidenceGraph: EvidenceGraph,
    normalizedBundle: NormalizedEntityBundle,
  ): TwinSceneGraph {
    const entities = normalizedBundle.entities.map((entity) => this.projectEntity(entity));
    const relationships = this.buildRelationships(entities);
    const qualityIssues = this.validateGraph(normalizedBundle, relationships);

    return {
      sceneId,
      scope,
      coordinateFrame: {
        origin: scope.center,
        axes: 'ENU',
        unit: 'meter',
        elevationDatum: 'UNKNOWN',
      },
      entities,
      relationships,
      evidenceGraphId: evidenceGraph.id,
      stateLayers: entities
        .filter((entity) => entity.type === 'traffic_flow')
        .map((entity) => ({
          id: `state:${entity.id}`,
          type: 'traffic',
          entityIds: [entity.id],
          sourceSnapshotIds: entity.sourceSnapshotIds,
        })),
      metadata: {
        initialRealityTierCandidate: 'PLACEHOLDER_SCENE',
        observedRatio: entities.length === 0 ? 0 : entities.filter((entity) => entity.qualityIssues.length === 0).length / entities.length,
        inferredRatio: 0,
        defaultedRatio:
          entities.length === 0 ? 1 : entities.filter((entity) => entity.qualityIssues.length > 0).length / entities.length,
        coreEntityCount: entities.length,
        contextEntityCount: 0,
        qualityIssues,
      },
    };
  }

  private projectEntity(entity: NormalizedEntityBundle['entities'][number]): TwinEntity {
    const base = {
      id: entity.id,
      stableId: entity.stableId,
      confidence: entity.issues.length === 0 ? 1 : 0.4,
      sourceSnapshotIds: entity.sourceEntityRefs.map((source) => source.sourceSnapshotId),
      sourceEntityRefs: entity.sourceEntityRefs,
      derivation: [
        {
          step: 'normalized-to-twin',
          version: 'twin-graph.v1',
          reasonCodes: ['NORMALIZED_ENTITY_PROJECTED'],
          inputEntityIds: [entity.id],
          outputEntityIds: [entity.id],
        },
      ],
      tags: entity.tags,
      qualityIssues: entity.issues,
    };

    switch (entity.type) {
      case 'traffic_flow':
        return {
          ...base,
          type: 'traffic_flow',
          geometry: {
            centerline: [
              { x: 0, y: 0, z: 0 },
              { x: 1, y: 0, z: 1 },
            ],
          },
          properties: {
            trafficState: {
              value: {
                currentSpeedKph: 0,
                freeFlowSpeedKph: 0,
                confidence: base.confidence,
                closure: false,
              },
              provenance: entity.issues.length === 0 ? 'observed' : 'defaulted',
              confidence: base.confidence,
              source: entity.sourceEntityRefs[0]?.sourceId ?? entity.id,
              reasonCodes: entity.issues.length === 0 ? ['TRAFFIC_FLOW_AVAILABLE'] : ['TRAFFIC_FLOW_DEFAULTED'],
            },
          },
        };
      case 'terrain':
        return {
          ...base,
          type: 'terrain',
          geometry: {
            samples: [{ x: 0, y: 0, z: 0 }],
          },
          properties: {},
        };
      case 'road':
        return {
          ...base,
          type: 'road',
          geometry: {
            centerline: [
              { x: 0, y: 0, z: 0 },
              { x: 1, y: 0, z: 0 },
            ],
          },
          properties: {},
        };
      case 'walkway':
        return {
          ...base,
          type: 'walkway',
          geometry: {
            centerline: [
              { x: 0, y: 0, z: 0 },
              { x: 0, y: 0, z: 1 },
            ],
          },
          properties: {},
        };
      case 'building':
        return {
          ...base,
          type: 'building',
          geometry: {
            footprint: {
              outer: [
                { x: 0, y: 0, z: 0 },
                { x: 1, y: 0, z: 0 },
                { x: 1, y: 0, z: 1 },
                { x: 0, y: 0, z: 1 },
              ],
            },
            baseY: 0,
          },
          properties: {},
        };
      case 'poi':
      default:
        return {
          ...base,
          type: this.asPoi(entity.type),
          geometry: {
            point: { x: 0, y: 0, z: 0 },
          },
          properties: {
            placeId: {
              value: entity.sourceEntityRefs[0]?.sourceId ?? entity.id,
              provenance: entity.issues.length === 0 ? 'observed' : 'defaulted',
              confidence: base.confidence,
              source: entity.sourceEntityRefs[0]?.sourceId ?? entity.id,
              reasonCodes: entity.issues.length === 0 ? ['POI_AVAILABLE'] : ['POI_DEFAULTED'],
            },
          },
        };
    }
  }

  private asPoi(type: TwinEntityType): 'poi' {
    return type === 'poi' ? 'poi' : 'poi';
  }

  private buildRelationships(entities: TwinEntity[]): SceneRelationship[] {
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

  private validateGraph(
    normalizedBundle: NormalizedEntityBundle,
    relationships: SceneRelationship[],
  ) {
    const issues = [...normalizedBundle.issues];

    if (
      issues.some((issue) => issue.code === 'SCENE_DUPLICATED_FOOTPRINT') &&
      !relationships.some((relationship) => relationship.relation === 'duplicates')
    ) {
      issues.push({
        code: 'SCENE_DUPLICATED_FOOTPRINT',
        severity: 'major',
        scope: 'scene',
        message: 'Duplicate footprint issue exists without duplicates relationship.',
        action: 'warn_only',
      });
    }

    if (
      issues.some((issue) => issue.code === 'SCENE_ROAD_BUILDING_OVERLAP') &&
      !relationships.some((relationship) => relationship.relation === 'conflicts')
    ) {
      issues.push({
        code: 'SCENE_ROAD_BUILDING_OVERLAP',
        severity: 'critical',
        scope: 'scene',
        message: 'Road-building overlap exists without conflicts relationship.',
        action: 'fail_build',
      });
    }

    return issues;
  }
}
