import type { SceneBuildManifest, SceneBuildState } from '../../../packages/contracts/manifest';

const ALLOWED_TRANSITIONS: Record<SceneBuildState, SceneBuildState[]> = {
  REQUESTED: ['SNAPSHOT_COLLECTING', 'CANCELLED'],
  SNAPSHOT_COLLECTING: ['SNAPSHOT_PARTIAL', 'SNAPSHOT_COLLECTED', 'FAILED', 'CANCELLED'],
  SNAPSHOT_PARTIAL: ['GRAPH_BUILDING', 'FAILED', 'CANCELLED'],
  SNAPSHOT_COLLECTED: ['NORMALIZING', 'GRAPH_BUILDING', 'FAILED', 'CANCELLED'],
  NORMALIZING: ['NORMALIZED', 'FAILED', 'CANCELLED'],
  NORMALIZED: ['GRAPH_BUILDING', 'FAILED', 'CANCELLED'],
  GRAPH_BUILDING: ['GRAPH_BUILT', 'FAILED', 'CANCELLED'],
  GRAPH_BUILT: ['RENDER_INTENT_RESOLVING', 'FAILED', 'CANCELLED'],
  RENDER_INTENT_RESOLVING: ['RENDER_INTENT_RESOLVED', 'FAILED', 'CANCELLED'],
  RENDER_INTENT_RESOLVED: ['MESH_PLANNING', 'FAILED', 'CANCELLED'],
  MESH_PLANNING: ['MESH_PLANNED', 'FAILED', 'CANCELLED'],
  MESH_PLANNED: ['GLB_BUILDING', 'QA_RUNNING', 'FAILED', 'CANCELLED'],
  GLB_BUILDING: ['GLB_BUILT', 'FAILED', 'CANCELLED'],
  GLB_BUILT: ['QA_RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED'],
  QA_RUNNING: ['GLB_BUILDING', 'QUARANTINED', 'COMPLETED', 'FAILED', 'CANCELLED'],
  QUARANTINED: ['FAILED', 'SUPERSEDED'],
  COMPLETED: ['SUPERSEDED'],
  FAILED: [],
  CANCELLED: [],
  SUPERSEDED: [],
};

export class SceneBuildAggregate {
  private constructor(
    readonly sceneId: string,
    readonly buildId: string,
    private state: SceneBuildState,
  ) {}

  static request(sceneId: string, buildId: string): SceneBuildAggregate {
    return new SceneBuildAggregate(sceneId, buildId, 'REQUESTED');
  }

  currentState(): SceneBuildState {
    return this.state;
  }

  transitionTo(nextState: SceneBuildState): void {
    if (!ALLOWED_TRANSITIONS[this.state].includes(nextState)) {
      throw new Error(`Invalid scene build transition: ${this.state} -> ${nextState}`);
    }

    this.state = nextState;
  }

  complete(manifest: SceneBuildManifest): void {
    if (manifest.sceneId !== this.sceneId || manifest.buildId !== this.buildId) {
      throw new Error('Manifest does not belong to this scene build.');
    }

    this.state = manifest.state;
  }
}
