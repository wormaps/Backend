import type { NormalizedEntityBundle } from '../../../packages/contracts/normalized-entity';
import type { TwinEntity, TwinEntityType } from '../../../packages/contracts/twin-scene-graph';

export class TwinEntityProjectionService {
  project(bundle: NormalizedEntityBundle): TwinEntity[] {
    return bundle.entities.map((entity) => this.projectEntity(entity));
  }

  private resolvePoint(value: unknown): { x: number; y: number; z: number } | null {
    if (typeof value !== 'object' || value === null) {
      return null;
    }

    const candidate = value as Record<string, unknown>;
    const x = candidate.x;
    const y = candidate.y;
    const z = candidate.z;

    if (typeof x !== 'number' || typeof y !== 'number' || typeof z !== 'number') {
      return null;
    }

    return { x, y, z };
  }

  private resolveLine(value: unknown): Array<{ x: number; y: number; z: number }> {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((point) => this.resolvePoint(point))
      .filter((point): point is { x: number; y: number; z: number } => point !== null);
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
          const geometry = (entity.geometry ?? {}) as Record<string, unknown>;
          const centerline = this.resolveLine(geometry.centerline);
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
          const geometry = (entity.geometry ?? {}) as Record<string, unknown>;
          const samples = this.resolveLine(geometry.samples);
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
          const geometry = (entity.geometry ?? {}) as Record<string, unknown>;
          const centerline = this.resolveLine(geometry.centerline);
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
          const geometry = (entity.geometry ?? {}) as Record<string, unknown>;
          const centerline = this.resolveLine(geometry.centerline);
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
          const geometry = (entity.geometry ?? {}) as Record<string, unknown>;
          const footprintValue = (geometry.footprint as Record<string, unknown> | undefined)?.outer;
          const outer = this.resolveLine(footprintValue);
          const resolvedOuter = outer.length >= 3
            ? outer
            : [
                { x: 0, y: 0, z: 0 },
                { x: 1, y: 0, z: 0 },
                { x: 1, y: 0, z: 1 },
                { x: 0, y: 0, z: 1 },
              ];
          const baseYValue = geometry.baseY;
          const resolvedBaseY = typeof baseYValue === 'number' ? baseYValue : 0;

          const rawHeight = geometry.height;
          const rawLevels = geometry.levels;
          const parsedHeight = typeof rawHeight === 'number' && rawHeight > 0 ? rawHeight : undefined;
          const parsedLevels = typeof rawLevels === 'number' && rawLevels > 0 ? rawLevels : undefined;

          let resolvedHeight: number;
          let heightProvenance: 'observed' | 'inferred' | 'defaulted';
          let heightReasonCodes: string[];

          if (parsedHeight !== undefined) {
            resolvedHeight = parsedHeight;
            heightProvenance = 'observed';
            heightReasonCodes = ['BUILDING_HEIGHT_FROM_OSM'];
          } else if (parsedLevels !== undefined) {
            resolvedHeight = parsedLevels * 3.0;
            heightProvenance = 'inferred';
            heightReasonCodes = ['BUILDING_HEIGHT_FROM_LEVELS'];
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
            levels: parsedLevels !== undefined ? {
              value: parsedLevels,
              provenance: 'observed',
              confidence: base.confidence,
              source: entity.sourceEntityRefs[0]?.sourceId ?? entity.id,
              reasonCodes: ['BUILDING_LEVELS_FROM_OSM'],
            } : undefined,
          },
        };
      }
      case 'poi':
      default:
        {
          const geometry = (entity.geometry ?? {}) as Record<string, unknown>;
          const point = this.resolvePoint(geometry.point) ?? { x: 0, y: 0, z: 0 };
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
