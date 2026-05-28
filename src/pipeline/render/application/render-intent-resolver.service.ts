import { Injectable, Logger } from '@nestjs/common';
import type { RenderIntentSet } from '../../../shared/contracts';
import type { TwinSceneGraph } from '../../../shared/contracts';
import { RealityTierResolverService } from '../../twin/application';
import { RenderIntentPolicyService } from './render-intent-policy.service';

@Injectable()
export class RenderIntentResolverService {
  private readonly logger = new Logger(RenderIntentResolverService.name);

  constructor(
    private readonly renderIntentPolicy: RenderIntentPolicyService,
    private readonly realityTierResolver: RealityTierResolverService,
  ) {}

  resolve(graph: TwinSceneGraph): RenderIntentSet {
    this.logger.debug(`Resolving render intents for scene ${graph.sceneId}`);
    const intents = this.renderIntentPolicy.resolve(graph);
    const provisional = this.realityTierResolver.resolveProvisional(
      graph.metadata.initialRealityTierCandidate,
      intents,
      graph.metadata.qualityIssues,
    );

    return {
      sceneId: graph.sceneId,
      twinSceneGraphId: graph.sceneId,
      intents,
      policyVersion: 'render-policy.v1',
      generatedAt: new Date(0).toISOString(),
      tier: {
        initialCandidate: graph.metadata.initialRealityTierCandidate,
        provisional: provisional.tier,
        reasonCodes: provisional.reasonCodes,
      },
    };
  }
}
