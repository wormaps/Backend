import { Injectable, Logger } from '@nestjs/common';
import type { QaIssue } from '../../../shared/contracts/qa';
import type { TwinEntity, TwinSceneGraphMetadata } from '../../../shared/contracts/twin-scene-graph';
import { RealityTierResolverService } from './reality-tier-resolver.service';

@Injectable()
export class TwinSceneGraphMetadataFactory {
  private readonly logger = new Logger(TwinSceneGraphMetadataFactory.name);

  constructor(
    private readonly realityTierResolver: RealityTierResolverService = new RealityTierResolverService(),
  ) {}

  create(entities: TwinEntity[], qualityIssues: QaIssue[]): TwinSceneGraphMetadata {
    this.logger.debug(`Creating twin metadata entities=${entities.length} issues=${qualityIssues.length}`);
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
