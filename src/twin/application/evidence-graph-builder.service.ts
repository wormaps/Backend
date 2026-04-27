import type { EvidenceGraph } from '../../../packages/contracts/evidence-graph';
import type { NormalizedEntityBundle } from '../../../packages/contracts/normalized-entity';

export class EvidenceGraphBuilderService {
  build(normalizedBundle: NormalizedEntityBundle): EvidenceGraph {
    return {
      id: `evidence:${normalizedBundle.sceneId}:${normalizedBundle.snapshotBundleId}`,
      sceneId: normalizedBundle.sceneId,
      snapshotBundleId: normalizedBundle.snapshotBundleId,
      nodes: normalizedBundle.entities.map((entity) => ({
        id: `evidence:${entity.id}`,
        entityId: entity.id,
        sourceEntityRef: entity.sourceEntityRefs[0],
        provenance: entity.issues.length === 0 ? 'observed' : 'defaulted',
        confidence: entity.issues.length === 0 ? 1 : 0.25,
        reasonCodes: entity.issues.length === 0 ? ['NORMALIZED_ENTITY_AVAILABLE'] : ['NORMALIZED_ENTITY_HAS_ISSUES'],
      })),
      edges: normalizedBundle.issues.map((issue, index) => ({
        from: `normalized:${index}`,
        to: `issue:${issue.code}`,
        relation: 'supports',
        reasonCodes: [issue.code],
      })),
      generatedAt: new Date(0).toISOString(),
      evidencePolicyVersion: 'evidence-policy.v1',
    };
  }
}
