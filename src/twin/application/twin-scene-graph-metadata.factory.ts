import type { QaIssue } from '../../../packages/contracts/qa';
import type { TwinEntity, TwinSceneGraphMetadata } from '../../../packages/contracts/twin-scene-graph';
import type { RealityTierResolverService } from '../../reality/application/reality-tier-resolver.service';

export class TwinSceneGraphMetadataFactory {
  constructor(private readonly realityTierResolver: RealityTierResolverService) {}

  create(entities: TwinEntity[], qualityIssues: QaIssue[]): TwinSceneGraphMetadata {
    const observedEntityCount = entities.filter((entity) => entity.qualityIssues.length === 0).length;
    const defaultedEntityCount = entities.filter((entity) => entity.qualityIssues.length > 0).length;
    const totalEntityCount = entities.length;
    const observedRatio = totalEntityCount === 0 ? 0 : observedEntityCount / totalEntityCount;
    const defaultedRatio = totalEntityCount === 0 ? 1 : defaultedEntityCount / totalEntityCount;

    return {
      initialRealityTierCandidate: this.realityTierResolver.resolveInitial({
        initialRealityTierCandidate: 'PLACEHOLDER_SCENE',
        observedRatio,
        inferredRatio: 0,
        defaultedRatio,
        coreEntityCount: totalEntityCount,
        contextEntityCount: 0,
        qualityIssues,
      }),
      observedRatio,
      inferredRatio: 0,
      defaultedRatio,
      coreEntityCount: totalEntityCount,
      contextEntityCount: 0,
      qualityIssues,
    };
  }
}
