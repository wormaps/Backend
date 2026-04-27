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
        {
          const centerline = entity.geometry?.kind === 'road' ? entity.geometry.centerline : [];
          const resolvedCenterline = centerline.length >= 2
            ? centerline
            : [
                { x: 0, y: 0, z: 0 },
                { x: 1, y: 0, z: 1 },
              ];
        return {
          ...base,
          type: 'traffic_flow',
          geometry: {
            centerline: resolvedCenterline,
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
      }
      case 'terrain':
        {
          const samples = entity.geometry?.kind === 'terrain' ? entity.geometry.samples : [];
          const resolvedSamples = samples.length > 0 ? samples : [{ x: 0, y: 0, z: 0 }];
        return {
          ...base,
          type: 'terrain',
          geometry: {
            samples: resolvedSamples,
          },
          properties: {},
        };
      }
      case 'road':
        {
          const centerline = entity.geometry?.kind === 'road' ? entity.geometry.centerline : [];
          const resolvedCenterline = centerline.length >= 2
            ? centerline
            : [
                { x: 0, y: 0, z: 0 },
                { x: 1, y: 0, z: 0 },
              ];
        return {
          ...base,
          type: 'road',
          geometry: {
            centerline: resolvedCenterline,
          },
          properties: {},
        };
      }
      case 'walkway':
        {
          const centerline = entity.geometry?.kind === 'walkway' ? entity.geometry.centerline : [];
          const resolvedCenterline = centerline.length >= 2
            ? centerline
            : [
                { x: 0, y: 0, z: 0 },
                { x: 0, y: 0, z: 1 },
              ];
        return {
          ...base,
          type: 'walkway',
          geometry: {
            centerline: resolvedCenterline,
          },
          properties: {},
        };
      }
      case 'building':
        {
          const outer = entity.geometry?.kind === 'building' ? entity.geometry.footprint.outer : [];
          const resolvedOuter = outer.length >= 3
            ? outer
            : [
                { x: 0, y: 0, z: 0 },
                { x: 1, y: 0, z: 0 },
                { x: 1, y: 0, z: 1 },
                { x: 0, y: 0, z: 1 },
              ];
          const resolvedBaseY = entity.geometry?.kind === 'building' && typeof entity.geometry.baseY === 'number'
            ? entity.geometry.baseY
            : 0;

          const rawHeight = entity.geometry?.kind === 'building' ? entity.geometry.height : undefined;
          const parsedHeight = typeof rawHeight === 'number' && rawHeight > 0 ? rawHeight : undefined;

          let resolvedHeight: number;
          let heightProvenance: 'observed' | 'inferred' | 'defaulted';
          let heightReasonCodes: string[];

          if (parsedHeight !== undefined) {
            resolvedHeight = parsedHeight;
            heightProvenance = 'observed';
            heightReasonCodes = ['BUILDING_HEIGHT_FROM_OSM'];
          } else {
            resolvedHeight = 3.0;
            heightProvenance = 'defaulted';
            heightReasonCodes = ['BUILDING_HEIGHT_FALLBACK'];
          }

        return {
          ...base,
          type: 'building',
          geometry: {
            footprint: {
              outer: resolvedOuter,
            },
            baseY: resolvedBaseY,
            height: resolvedHeight,
          },
          properties: {
            height: {
              value: resolvedHeight,
              provenance: heightProvenance,
              confidence: base.confidence,
              source: entity.sourceEntityRefs[0]?.sourceId ?? entity.id,
              reasonCodes: heightReasonCodes,
            },
            levels: undefined,
          },
        };
      }
      case 'poi':
      default:
        {
          const point = entity.geometry?.kind === 'poi' ? entity.geometry.point : { x: 0, y: 0, z: 0 };
        return {
          ...base,
          type: this.asPoi(entity.type),
          geometry: {
            point,
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
  }

  private asPoi(type: TwinEntityType): 'poi' {
    return type === 'poi' ? 'poi' : 'poi';
  }
}
