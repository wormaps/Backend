import type { EvidenceGraph } from '../../../packages/contracts/evidence-graph';
import type { SourceSnapshot } from '../../../packages/contracts/source-snapshot';

export class EvidenceGraphBuilderService {
  build(sceneId: string, snapshotBundleId: string, snapshots: SourceSnapshot[]): EvidenceGraph {
    return {
      id: `evidence:${sceneId}:${snapshotBundleId}`,
      sceneId,
      snapshotBundleId,
      nodes: snapshots.map((snapshot) => ({
        id: `evidence:${snapshot.id}`,
        sourceEntityRef: {
          provider: snapshot.provider,
          sourceId: snapshot.id,
          sourceSnapshotId: snapshot.id,
        },
        provenance: snapshot.status === 'success' ? 'observed' : 'defaulted',
        confidence: snapshot.status === 'success' ? 1 : 0,
        reasonCodes: snapshot.status === 'success' ? ['SNAPSHOT_AVAILABLE'] : ['SNAPSHOT_NOT_SUCCESSFUL'],
        valueHash: snapshot.responseHash,
      })),
      edges: [],
      generatedAt: new Date(0).toISOString(),
      evidencePolicyVersion: 'evidence-policy.v1',
    };
  }
}
