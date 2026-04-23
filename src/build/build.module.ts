import { SceneBuildOrchestratorService } from './application/scene-build-orchestrator.service';
import type { GlbCompilerService } from '../glb/application/glb-compiler.service';
import type { SnapshotCollectorService } from '../providers/application/snapshot-collector.service';
import type { QaGateService } from '../qa/application/qa-gate.service';
import type { MeshPlanBuilderService } from '../render/application/mesh-plan-builder.service';
import type { RenderIntentResolverService } from '../render/application/render-intent-resolver.service';
import type { EvidenceGraphBuilderService } from '../twin/application/evidence-graph-builder.service';
import type { TwinGraphBuilderService } from '../twin/application/twin-graph-builder.service';
import { BuildManifestFactory } from './application/build-manifest.factory';

export type BuildModuleDependencies = {
  snapshotCollector: SnapshotCollectorService;
  evidenceGraphBuilder: EvidenceGraphBuilderService;
  twinGraphBuilder: TwinGraphBuilderService;
  renderIntentResolver: RenderIntentResolverService;
  meshPlanBuilder: MeshPlanBuilderService;
  qaGate: QaGateService;
  glbCompiler: GlbCompilerService;
};

export function createBuildModule(dependencies: BuildModuleDependencies) {
  return {
    name: 'build',
    services: {
      sceneBuildOrchestrator: new SceneBuildOrchestratorService(
        dependencies.snapshotCollector,
        dependencies.evidenceGraphBuilder,
        dependencies.twinGraphBuilder,
        dependencies.renderIntentResolver,
        dependencies.meshPlanBuilder,
        dependencies.qaGate,
        dependencies.glbCompiler,
        new BuildManifestFactory(),
      ),
    },
  } as const;
}
