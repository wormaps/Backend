import { createBuildModule } from './build/build.module';
import { glbModule } from './glb/glb.module';
import { normalizationModule } from './normalization/normalization.module';
import { providersModule } from './providers/providers.module';
import { qaModule } from './qa/qa.module';
import { realityModule } from './reality/reality.module';
import { renderModule } from './render/render.module';
import { twinModule } from './twin/twin.module';

const buildModule = createBuildModule({
  snapshotCollector: providersModule.services.snapshotCollector,
  normalizedEntityBuilder: normalizationModule.services.normalizedEntityBuilder,
  evidenceGraphBuilder: twinModule.services.evidenceGraphBuilder,
  twinGraphBuilder: twinModule.services.twinGraphBuilder,
  renderIntentResolver: renderModule.services.renderIntentResolver,
  meshPlanBuilder: renderModule.services.meshPlanBuilder,
  qaGate: qaModule.services.qaGate,
  glbCompiler: glbModule.services.glbCompiler,
  glbValidation: glbModule.services.glbValidation,
});

providersModule.services.osmSceneBuild.setOrchestrator(buildModule.services.sceneBuildOrchestrator);

export const appModule = {
  name: 'wormap-v2',
  modules: [providersModule, normalizationModule, realityModule, twinModule, renderModule, qaModule, glbModule, buildModule],
  services: {
    sceneBuildOrchestrator: buildModule.services.sceneBuildOrchestrator,
    osmSceneBuild: providersModule.services.osmSceneBuild,
  },
} as const;
