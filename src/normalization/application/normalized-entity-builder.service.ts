import type { NormalizedEntity, NormalizedEntityBundle } from '../../../packages/contracts/normalized-entity';
import type { QaIssue } from '../../../packages/contracts/qa';
import type { SourceSnapshot } from '../../../packages/contracts/source-snapshot';
import type { TwinEntityType } from '../../../packages/contracts/twin-scene-graph';
import type { MeshGeometry } from '../../../packages/core/geometry';

type OSMFeaturePayload = {
  id: string;
  entityType: 'building' | 'road' | 'walkway' | 'terrain' | 'poi';
  geometry?: MeshGeometry;
  tags?: Record<string, string>;
};

export class NormalizedEntityBuilderService {
  build(sceneId: string, snapshotBundleId: string, snapshots: SourceSnapshot[]): NormalizedEntityBundle {
    const entities: NormalizedEntity[] = snapshots.flatMap((snapshot) => this.normalizeSnapshot(snapshot));

    return {
      id: `normalized:${sceneId}:${snapshotBundleId}`,
      sceneId,
      snapshotBundleId,
      entities,
      issues: entities.flatMap((entity) => entity.issues),
      generatedAt: new Date(0).toISOString(),
      normalizationVersion: 'normalization.v1',
    };
  }

  private normalizeSnapshot(snapshot: SourceSnapshot): NormalizedEntity[] {
    if (snapshot.provider !== 'osm') {
      const issues = this.deriveIssues(snapshot);
      return [
        {
          id: `normalized:${snapshot.id}`,
          stableId: `${snapshot.provider}:${snapshot.id}`,
          type: this.deriveType(snapshot),
          geometry: undefined,
          sourceEntityRefs: [
            {
              provider: snapshot.provider,
              sourceId: snapshot.id,
              sourceSnapshotId: snapshot.id,
            },
          ],
          tags: [`provider:${snapshot.provider}`],
          issues,
        },
      ];
    }

    const parsed = this.parseOsmPayload(snapshot.payloadRef);
    if (parsed.length === 0) {
      const issues = this.deriveIssues(snapshot);
      return [
        {
          id: `normalized:${snapshot.id}`,
          stableId: `${snapshot.provider}:${snapshot.id}`,
          type: this.deriveType(snapshot),
          geometry: undefined,
          sourceEntityRefs: [
            {
              provider: snapshot.provider,
              sourceId: snapshot.id,
              sourceSnapshotId: snapshot.id,
            },
          ],
          tags: [`provider:${snapshot.provider}`],
          issues,
        },
      ];
    }

    const snapshotIssues = this.deriveIssues(snapshot);
    return parsed.map((feature) => ({
      id: `normalized:${snapshot.id}:${feature.id}`,
      stableId: `${snapshot.provider}:${feature.id}`,
      type: this.deriveFeatureType(feature),
      geometry: feature.geometry,
      sourceEntityRefs: [
        {
          provider: snapshot.provider,
          sourceId: feature.id,
          sourceSnapshotId: snapshot.id,
        },
      ],
      tags: this.deriveFeatureTags(snapshot.provider, feature),
      issues: snapshotIssues,
    }));
  }

  private parseOsmPayload(payloadRef?: string): OSMFeaturePayload[] {
    if (!payloadRef || !payloadRef.startsWith('[')) {
      return [];
    }

    try {
      const parsed = JSON.parse(payloadRef);
      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed.filter((value): value is OSMFeaturePayload => {
        if (typeof value !== 'object' || value === null) {
          return false;
        }
        const item = value as Record<string, unknown>;
        return typeof item.id === 'string' && typeof item.entityType === 'string';
      }).map((feature) => ({
        ...feature,
        geometry: this.toMeshGeometry(feature),
      }));
    } catch {
      return [];
    }
  }

  private toMeshGeometry(feature: {
    id: string;
    entityType: 'building' | 'road' | 'walkway' | 'terrain' | 'poi';
    geometry?: Record<string, unknown>;
    tags?: Record<string, string>;
  }): MeshGeometry | undefined {
    const raw = feature.geometry;
    if (raw === undefined || raw === null) {
      return undefined;
    }

    switch (feature.entityType) {
      case 'building': {
        const footprint = raw.footprint as { outer: Array<{ x: number; y: number; z: number }>; holes?: Array<Array<{ x: number; y: number; z: number }>> } | undefined;
        if (footprint === undefined) return undefined;
        return {
          kind: 'building',
          footprint,
          baseY: typeof raw.baseY === 'number' ? raw.baseY : undefined,
          height: typeof raw.height === 'number' ? raw.height : undefined,
        };
      }
      case 'road': {
        const centerline = raw.centerline as Array<{ x: number; y: number; z: number }> | undefined;
        if (centerline === undefined) return undefined;
        return {
          kind: 'road',
          centerline,
          bufferPolygon: raw.bufferPolygon as { outer: Array<{ x: number; y: number; z: number }>; holes?: Array<Array<{ x: number; y: number; z: number }>> } | undefined,
        };
      }
      case 'walkway': {
        const centerline = raw.centerline as Array<{ x: number; y: number; z: number }> | undefined;
        if (centerline === undefined) return undefined;
        return {
          kind: 'walkway',
          centerline,
        };
      }
      case 'terrain': {
        const samples = raw.samples as Array<{ x: number; y: number; z: number }> | undefined;
        if (samples === undefined) return undefined;
        return {
          kind: 'terrain',
          samples,
        };
      }
      case 'poi': {
        const point = raw.point as { x: number; y: number; z: number } | undefined;
        if (point === undefined) return undefined;
        return {
          kind: 'poi',
          point,
        };
      }
      default:
        return undefined;
    }
  }

  private deriveFeatureType(feature: OSMFeaturePayload): TwinEntityType {
    switch (feature.entityType) {
      case 'building':
      case 'road':
      case 'walkway':
      case 'terrain':
      case 'poi':
        return feature.entityType;
      default:
        return 'poi';
    }
  }

  private deriveFeatureTags(provider: SourceSnapshot['provider'], feature: OSMFeaturePayload): string[] {
    const tags = [`provider:${provider}`, `entityType:${feature.entityType}`];
    const osmTags = feature.tags ?? {};
    for (const [key, value] of Object.entries(osmTags)) {
      tags.push(`osm:${key}=${value}`);
    }
    return tags;
  }

  private deriveType(snapshot: SourceSnapshot): TwinEntityType {
    if (snapshot.provider === 'osm' && snapshot.payloadRef?.startsWith('[')) {
      try {
        const parsed = JSON.parse(snapshot.payloadRef);
        if (Array.isArray(parsed)) {
          if (parsed[0]?.entityType === 'building') return 'building';
          if (parsed[0]?.entityType === 'road') return 'road';
          if (parsed[0]?.entityType === 'walkway') return 'walkway';
          if (parsed[0]?.entityType === 'terrain') return 'terrain';
        }
      } catch {
        // JSON 파싱 실패 — fixture hint 기반 로직으로 fallback
      }
    }

    switch (snapshot.provider) {
      case 'tomtom':
        return 'traffic_flow';
      case 'osm':
        if (this.hasHint(snapshot, 'duplicate-footprint')) {
          return 'building';
        }
        if (this.hasHint(snapshot, 'self-intersection')) {
          return 'building';
        }
        if (this.hasHint(snapshot, 'extreme-terrain-slope')) {
          return 'terrain';
        }
        if (this.hasHint(snapshot, 'terrain')) {
          return 'terrain';
        }
        if (this.hasHint(snapshot, 'road')) {
          return 'road';
        }
        if (this.hasHint(snapshot, 'building')) {
          return 'building';
        }
        return 'poi';
      case 'google_places':
      case 'manual':
      case 'curated':
        return 'poi';
      case 'open_meteo':
        return 'terrain';
      default:
        return 'poi';
    }
  }

  private deriveIssues(snapshot: SourceSnapshot): QaIssue[] {
    const payloadRef = snapshot.payloadRef ?? '';

    if (payloadRef.includes('duplicate-footprint')) {
      return [this.issue('SCENE_DUPLICATED_FOOTPRINT', 'major', 'strip_detail')];
    }

    if (payloadRef.includes('self-intersection')) {
      return [this.issue('GEOMETRY_SELF_INTERSECTION', 'critical', 'fail_build')];
    }

    if (payloadRef.includes('road-building-overlap')) {
      return [this.issue('SCENE_ROAD_BUILDING_OVERLAP', 'critical', 'fail_build')];
    }

    if (payloadRef.includes('coordinate-outlier')) {
      return [this.issue('SPATIAL_COORDINATE_OUTLIER', 'major', 'downgrade_tier')];
    }

    if (payloadRef.includes('extreme-terrain-slope')) {
      return [this.issue('SPATIAL_EXTREME_TERRAIN_SLOPE', 'major', 'downgrade_tier')];
    }

    if (payloadRef.includes('provider-policy-risk')) {
      return [this.issue('COMPLIANCE_PROVIDER_POLICY_RISK', 'major', 'downgrade_tier', 'provider')];
    }

    return [];
  }

  private hasHint(snapshot: SourceSnapshot, token: string): boolean {
    return (snapshot.payloadRef ?? '').includes(token);
  }

  private issue(
    code: QaIssue['code'],
    severity: QaIssue['severity'],
    action: QaIssue['action'],
    scope: QaIssue['scope'] = 'scene',
  ): QaIssue {
    return {
      code,
      severity,
      scope,
      message: `Normalized issue: ${code}`,
      action,
    };
  }
}
