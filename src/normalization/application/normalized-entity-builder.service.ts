import type { NormalizedEntityBundle } from '../../../packages/contracts/normalized-entity';
import type { SourceSnapshot } from '../../../packages/contracts/source-snapshot';

export class NormalizedEntityBuilderService {
  build(sceneId: string, snapshotBundleId: string, snapshots: SourceSnapshot[]): NormalizedEntityBundle {
    return {
      id: `normalized:${sceneId}:${snapshotBundleId}`,
      sceneId,
      snapshotBundleId,
      entities: snapshots.map((snapshot) => ({
        id: `normalized:${snapshot.id}`,
        stableId: `${snapshot.provider}:${snapshot.id}`,
        type: snapshot.provider === 'tomtom' ? 'traffic_flow' : 'poi',
        sourceEntityRefs: [
          {
            provider: snapshot.provider,
            sourceId: snapshot.id,
            sourceSnapshotId: snapshot.id,
          },
        ],
        tags: [`provider:${snapshot.provider}`],
        issues: snapshot.issues ?? [],
      })),
      issues: snapshots.flatMap((snapshot) => snapshot.issues ?? []),
      generatedAt: new Date(0).toISOString(),
      normalizationVersion: 'normalization.v1',
    };
  }
}
