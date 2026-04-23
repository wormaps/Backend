import type { SourceSnapshot } from '../../../packages/contracts/source-snapshot';
import type { SceneScope } from '../../../packages/contracts/twin-scene-graph';
import type { GlbCompilerService } from '../../glb/application/glb-compiler.service';
import type { SnapshotCollectorService } from '../../providers/application/snapshot-collector.service';
import type { QaGateService } from '../../qa/application/qa-gate.service';
import type { MeshPlanBuilderService } from '../../render/application/mesh-plan-builder.service';
import type { RenderIntentResolverService } from '../../render/application/render-intent-resolver.service';
import type { EvidenceGraphBuilderService } from '../../twin/application/evidence-graph-builder.service';
import type { TwinGraphBuilderService } from '../../twin/application/twin-graph-builder.service';
import { BuildManifestFactory } from './build-manifest.factory';
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
    private readonly manifestFactory: BuildManifestFactory,
  ) {}

  run(input: SceneBuildMvpInput) {
    const build = SceneBuildAggregate.request(input.sceneId, input.buildId);
    build.transitionTo('SNAPSHOT_COLLECTING');

    const collected = this.snapshotCollector.collectFromSnapshots(input.snapshots);
    if (!collected.ok) {
      const qaResult = {
        passed: false,
        issues: this.snapshotCollector.failedSnapshotIssues(input.snapshots),
      };
      build.transitionTo(collected.error);
      const manifest = this.manifestFactory.create({
        sceneId: input.sceneId,
        buildId: input.buildId,
        state: build.currentState(),
        scopeId: input.scope.focusPlaceId ?? input.sceneId,
        snapshotBundleId: input.snapshotBundleId,
        snapshots: input.snapshots,
        complianceIssues: qaResult.issues.filter((issue) => issue.code.startsWith('COMPLIANCE_')),
      });

      return { build, collected, qaResult, manifest };
    }

    build.transitionTo('SNAPSHOT_COLLECTED');
    build.transitionTo('GRAPH_BUILDING');
    const evidenceGraph = this.evidenceGraphBuilder.build(
      input.sceneId,
      input.snapshotBundleId,
      collected.value.snapshots,
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
      const manifest = this.manifestFactory.create({
        sceneId: input.sceneId,
        buildId: input.buildId,
        state: build.currentState(),
        scopeId: input.scope.focusPlaceId ?? input.sceneId,
        snapshotBundleId: input.snapshotBundleId,
        snapshots: collected.value.snapshots,
        renderIntentSet,
        meshPlan,
        complianceIssues: qaResult.issues.filter((issue) => issue.code.startsWith('COMPLIANCE_')),
      });

      return { build, evidenceGraph, twinSceneGraph, renderIntentSet, meshPlan, qaResult, manifest };
    }

    build.transitionTo('COMPLETED');
    const manifest = this.manifestFactory.create({
      sceneId: input.sceneId,
      buildId: input.buildId,
      state: build.currentState(),
      scopeId: input.scope.focusPlaceId ?? input.sceneId,
      snapshotBundleId: input.snapshotBundleId,
        snapshots: collected.value.snapshots,
      renderIntentSet,
      meshPlan,
      complianceIssues: qaResult.issues.filter((issue) => issue.code.startsWith('COMPLIANCE_')),
    });

    return { build, evidenceGraph, twinSceneGraph, renderIntentSet, meshPlan, qaResult, glbArtifact, manifest };
  }
}
