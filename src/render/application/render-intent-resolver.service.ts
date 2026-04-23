import type { RenderIntentSet } from '../../../packages/contracts/render-intent';
import type { TwinSceneGraph } from '../../../packages/contracts/twin-scene-graph';

export class RenderIntentResolverService {
  resolve(graph: TwinSceneGraph): RenderIntentSet {
    return {
      sceneId: graph.sceneId,
      twinSceneGraphId: graph.sceneId,
      intents: graph.entities.map((entity) => ({
        entityId: entity.id,
        visualMode: entity.confidence >= 0.8 ? 'massing' : 'placeholder',
        allowedDetails: {
          windows: false,
          entrances: false,
          roofEquipment: false,
          facadeMaterial: false,
          signage: false,
        },
        lod: 'L0',
        reasonCodes: ['MVP_MASSING_ONLY'],
        confidence: entity.confidence,
      })),
      policyVersion: 'render-policy.v1',
      generatedAt: new Date(0).toISOString(),
      tier: {
        initialCandidate: graph.metadata.initialRealityTierCandidate,
        provisional: 'PLACEHOLDER_SCENE',
        reasonCodes: ['MVP_NO_VISUAL_EVIDENCE'],
      },
    };
  }
}
