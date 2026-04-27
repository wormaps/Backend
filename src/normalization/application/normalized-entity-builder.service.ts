import type { NormalizedEntityBundle } from '../../../packages/contracts/normalized-entity';
import type { QaIssue } from '../../../packages/contracts/qa';
import type { SourceSnapshot } from '../../../packages/contracts/source-snapshot';
import type { TwinEntityType } from '../../../packages/contracts/twin-scene-graph';

export class NormalizedEntityBuilderService {
  build(sceneId: string, snapshotBundleId: string, snapshots: SourceSnapshot[]): NormalizedEntityBundle {
    const entities = snapshots.map((snapshot) => {
      const issues = this.deriveIssues(snapshot);

      return {
        id: `normalized:${snapshot.id}`,
        stableId: `${snapshot.provider}:${snapshot.id}`,
        type: this.deriveType(snapshot),
        sourceEntityRefs: [
          {
            provider: snapshot.provider,
            sourceId: snapshot.id,
            sourceSnapshotId: snapshot.id,
          },
        ],
        tags: [`provider:${snapshot.provider}`],
        issues,
      };
    });

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

  private deriveType(snapshot: SourceSnapshot): TwinEntityType {
    if (snapshot.provider === 'osm' && snapshot.payloadRef?.startsWith('{')) {
      try {
        const parsed = JSON.parse(snapshot.payloadRef);
        if (Array.isArray(parsed)) {
          if (parsed[0]?.entityType === 'building') return 'building';
          if (parsed[0]?.entityType === 'road') return 'road';
          if (parsed[0]?.entityType === 'walkway') return 'walkway';
          if (parsed[0]?.entityType === 'terrain') return 'terrain';
        }
      } catch {
        // 파싱 실패 시 기존 로직 fallback
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
