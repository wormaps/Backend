import type { NormalizedEntityBundle } from '../../../packages/contracts/normalized-entity';
import type { TwinEntity, TwinEntityType } from '../../../packages/contracts/twin-scene-graph';

export class TwinEntityProjectionService {
  project(bundle: NormalizedEntityBundle): TwinEntity[] {
    return bundle.entities.map((entity) => this.projectEntity(entity));
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
}
