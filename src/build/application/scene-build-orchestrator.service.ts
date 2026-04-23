import type { SourceSnapshot } from '../../../packages/contracts/source-snapshot';
import type { SceneScope } from '../../../packages/contracts/twin-scene-graph';
import type { GlbCompilerService } from '../../glb/application/glb-compiler.service';
import type { SnapshotCollectorService } from '../../providers/application/snapshot-collector.service';
import type { QaGateService } from '../../qa/application/qa-gate.service';
import type { MeshPlanBuilderService } from '../../render/application/mesh-plan-builder.service';
import type { RenderIntentResolverService } from '../../render/application/render-intent-resolver.service';
import type { EvidenceGraphBuilderService } from '../../twin/application/evidence-graph-builder.service';
import type { TwinGraphBuilderService } from '../../twin/application/twin-graph-builder.service';
import { SceneBuildAggregate } from '../domain/scene-build.aggregate';

export type SceneBuildMvpInput = {
  sceneId: string;
  buildId: string;
  snapshotBundleId: string;
  scope: SceneScope;
  snapshots: SourceSnapshot[];
};

export class SceneBuildOrchestratorService {
  constructor(
    private readonly snapshotCollector: SnapshotCollectorService,
    private readonly evidenceGraphBuilder: EvidenceGraphBuilderService,
    private readonly twinGraphBuilder: TwinGraphBuilderService,
    private readonly renderIntentResolver: RenderIntentResolverService,
    private readonly meshPlanBuilder: MeshPlanBuilderService,
    private readonly qaGate: QaGateService,
    private readonly glbCompiler: GlbCompilerService,
  ) {}

  run(input: SceneBuildMvpInput) {
    const build = SceneBuildAggregate.request(input.sceneId, input.buildId);
    build.transitionTo('SNAPSHOT_COLLECTING');

    const collected = this.snapshotCollector.collectFromSnapshots(input.snapshots);
    if (!collected.ok) {
      build.transitionTo(collected.error);
      return { build, collected };
    }

    build.transitionTo('SNAPSHOT_COLLECTED');
    build.transitionTo('GRAPH_BUILDING');
    const evidenceGraph = this.evidenceGraphBuilder.build(
      input.sceneId,
      input.snapshotBundleId,
      collected.value,
    );
    const twinSceneGraph = this.twinGraphBuilder.build(
      input.sceneId,
      input.scope,
      evidenceGraph,
    );
    build.transitionTo('GRAPH_BUILT');

    build.transitionTo('RENDER_INTENT_RESOLVING');
    const renderIntentSet = this.renderIntentResolver.resolve(twinSceneGraph);
    build.transitionTo('RENDER_INTENT_RESOLVED');

    build.transitionTo('MESH_PLANNING');
    const meshPlan = this.meshPlanBuilder.build(renderIntentSet);
    build.transitionTo('MESH_PLANNED');

    build.transitionTo('GLB_BUILDING');
    const glbArtifact = this.glbCompiler.compile(meshPlan);
    build.transitionTo('GLB_BUILT');

    build.transitionTo('QA_RUNNING');
    const qaResult = this.qaGate.evaluate({
      graph: twinSceneGraph,
      intentSet: renderIntentSet,
      meshPlan,
    });

    if (!qaResult.passed) {
      build.transitionTo('QUARANTINED');
      return { build, evidenceGraph, twinSceneGraph, renderIntentSet, meshPlan, qaResult };
    }

    build.transitionTo('COMPLETED');

    return { build, evidenceGraph, twinSceneGraph, renderIntentSet, meshPlan, qaResult, glbArtifact };
  }
}
