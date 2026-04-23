import { createBuildModule } from './build/build.module';
import { glbModule } from './glb/glb.module';
import { providersModule } from './providers/providers.module';
import { qaModule } from './qa/qa.module';
import { renderModule } from './render/render.module';
import { twinModule } from './twin/twin.module';

const buildModule = createBuildModule({
  snapshotCollector: providersModule.services.snapshotCollector,
  evidenceGraphBuilder: twinModule.services.evidenceGraphBuilder,
  twinGraphBuilder: twinModule.services.twinGraphBuilder,
  renderIntentResolver: renderModule.services.renderIntentResolver,
  meshPlanBuilder: renderModule.services.meshPlanBuilder,
  qaGate: qaModule.services.qaGate,
  glbCompiler: glbModule.services.glbCompiler,
});

export const appModule = {
  name: 'wormap-v2',
  modules: [providersModule, twinModule, renderModule, qaModule, glbModule, buildModule],
  services: {
    sceneBuildOrchestrator: buildModule.services.sceneBuildOrchestrator,
  },
} as const;
