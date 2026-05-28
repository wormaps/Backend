import { Module } from '@nestjs/common';

import { SceneBuildOrchestratorService } from './application/scene-build-orchestrator.service';
import { QaGateService } from './application/qa-gate.service';
import { BuildManifestFactory } from './application/build-manifest.factory';
import { GlbModule } from '../pipeline/glb/glb.module';
import { TwinModule } from '../pipeline/twin/twin.module';
import { NormalizationModule } from '../pipeline/normalization/normalization.module';
import { ProvidersModule } from '../providers/providers.module';
import { RenderModule } from '../pipeline/render/render.module';

@Module({
  imports: [GlbModule, TwinModule, NormalizationModule, ProvidersModule, RenderModule],
  providers: [SceneBuildOrchestratorService, BuildManifestFactory, QaGateService],
  exports: [SceneBuildOrchestratorService],
})
export class BuildModule {}
