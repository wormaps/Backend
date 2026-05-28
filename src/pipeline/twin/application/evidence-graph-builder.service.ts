import { Injectable, Logger } from '@nestjs/common';
import type { EvidenceGraph } from '../../../shared/contracts/evidence-graph';
import type { NormalizedEntityBundle } from '../../../shared/contracts/normalized-entity';

@Injectable()
export class EvidenceGraphBuilderService {
  private readonly logger = new Logger(EvidenceGraphBuilderService.name);

  build(normalizedBundle: NormalizedEntityBundle): EvidenceGraph {
    this.logger.debug(`Building evidence graph for scene ${normalizedBundle.sceneId}`);
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
