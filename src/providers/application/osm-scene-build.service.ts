import { OsmSnapshotService } from './osm-snapshot.service';
import type { SceneBuildOrchestratorService } from '../../build/application/scene-build-orchestrator.service';
import type { SceneBuildRunResult } from '../../build/application/scene-build-run-result';
import type { SceneScope } from '../../../packages/contracts/twin-scene-graph';

export type OsmSceneBuildInput = {
  sceneId: string;
  buildId: string;
  snapshotBundleId: string;
  scope: SceneScope;
};

export class OsmSceneBuildService {
  constructor(
    private readonly osmSnapshot: OsmSnapshotService,
    private orchestrator?: SceneBuildOrchestratorService,
  ) {}

  setOrchestrator(orchestrator: SceneBuildOrchestratorService): void {
    this.orchestrator = orchestrator;
  }

  async run(input: OsmSceneBuildInput): Promise<SceneBuildRunResult> {
    if (!this.orchestrator) throw new Error('Orchestrator not set');

    const { snapshot, entities } = await this.osmSnapshot.createSnapshot(
      input.sceneId,
      input.snapshotBundleId,
      input.scope,
    );

    console.log(`[OSM Build] Fetched ${entities.length} entities from Overpass`);

    const buildInput = {
      sceneId: input.sceneId,
      buildId: input.buildId,
      snapshotBundleId: input.snapshotBundleId,
      scope: input.scope,
      snapshots: [snapshot],
    };

    const result = await this.orchestrator.run(buildInput);
    return result;
  }
}
