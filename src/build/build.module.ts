import { forwardRef, Module } from '@nestjs/common';

import { BUILD_JOB_STORE, InMemoryBuildJobStoreService } from './application';
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
  providers: [
    SceneBuildOrchestratorService,
    BuildManifestFactory,
    QaGateService,
    InMemoryBuildJobStoreService,
    {
      provide: BUILD_JOB_STORE,
      useExisting: InMemoryBuildJobStoreService,
    },
  ],
  exports: [SceneBuildOrchestratorService, BUILD_JOB_STORE, InMemoryBuildJobStoreService],
})
export class BuildModule {}
