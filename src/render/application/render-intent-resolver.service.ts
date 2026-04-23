import type { RenderIntentSet } from '../../../packages/contracts/render-intent';
import type { TwinSceneGraph } from '../../../packages/contracts/twin-scene-graph';
import type { RealityTierResolverService } from '../../reality/application/reality-tier-resolver.service';
import type { RenderIntentPolicyService } from './render-intent-policy.service';

export class RenderIntentResolverService {
  constructor(
    private readonly renderIntentPolicy: RenderIntentPolicyService,
    private readonly realityTierResolver: RealityTierResolverService,
  ) {}

  resolve(graph: TwinSceneGraph): RenderIntentSet {
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
