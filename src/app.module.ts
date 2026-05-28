import { createBuildModule } from './build/build.module';
import { QaGateService } from './build/application/qa-gate.service';
import { glbModule } from './glb/glb.module';
import { normalizationModule } from './normalization/normalization.module';
import { providersModule } from './providers/providers.module';
import { renderModule } from './render/render.module';
import { twinModule } from './twin/twin.module';

const buildModule = createBuildModule({
  snapshotCollector: providersModule.services.snapshotCollector,
  normalizedEntityBuilder: normalizationModule.services.normalizedEntityBuilder,
  evidenceGraphBuilder: twinModule.services.evidenceGraphBuilder,
  twinGraphBuilder: twinModule.services.twinGraphBuilder,
  renderIntentResolver: renderModule.services.renderIntentResolver,
  meshPlanBuilder: renderModule.services.meshPlanBuilder,
  qaGate: new QaGateService(twinModule.services.realityTierResolver),
  glbCompiler: glbModule.services.glbCompiler,
  glbValidation: glbModule.services.glbValidation,
});

providersModule.services.osmSceneBuild.setOrchestrator(buildModule.services.sceneBuildOrchestrator);

export const appModule = {
  name: 'wormap-v2',
  modules: [providersModule, normalizationModule, twinModule, renderModule, glbModule, buildModule],
  services: {
    sceneBuildOrchestrator: buildModule.services.sceneBuildOrchestrator,
    osmSceneBuild: providersModule.services.osmSceneBuild,
  },
} as const;
