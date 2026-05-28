import { forwardRef, Module } from '@nestjs/common';

import { SceneBuildOrchestratorService } from './application';
import { QaGateService } from './application';
import { BuildManifestFactory } from './application';
import { GlbModule } from '../pipeline/glb';
import { TwinModule } from '../pipeline/twin';
import { NormalizationModule } from '../pipeline/normalization';
import { ProvidersModule } from '../providers';
import { RenderModule } from '../pipeline/render';

@Module({
  imports: [GlbModule, TwinModule, NormalizationModule, forwardRef(() => ProvidersModule), RenderModule],
  providers: [SceneBuildOrchestratorService, BuildManifestFactory, QaGateService],
  exports: [SceneBuildOrchestratorService],
})
export class BuildModule {}
