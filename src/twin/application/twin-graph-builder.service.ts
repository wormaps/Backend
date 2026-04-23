import type { EvidenceGraph } from '../../../packages/contracts/evidence-graph';
import type { TwinSceneGraph } from '../../../packages/contracts/twin-scene-graph';
import type { SceneScope } from '../../../packages/contracts/twin-scene-graph';

export class TwinGraphBuilderService {
  build(sceneId: string, scope: SceneScope, evidenceGraph: EvidenceGraph): TwinSceneGraph {
    return {
      sceneId,
      scope,
      coordinateFrame: {
        origin: scope.center,
        axes: 'ENU',
        unit: 'meter',
        elevationDatum: 'UNKNOWN',
      },
      entities: [],
      relationships: [],
      evidenceGraphId: evidenceGraph.id,
      stateLayers: [],
      metadata: {
        initialRealityTierCandidate: 'PLACEHOLDER_SCENE',
        observedRatio: 0,
        inferredRatio: 0,
        defaultedRatio: 1,
        coreEntityCount: 0,
        contextEntityCount: 0,
        qualityIssues: [],
      },
    };
  }
}
