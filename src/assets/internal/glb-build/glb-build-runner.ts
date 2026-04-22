import { Injectable } from '@nestjs/common';
import { AppLoggerService } from '../../../common/logging/app-logger.service';
import {
  SceneAssetProfileService,
} from '../../../scene/services/asset-profile';
import {
  createGlbBuildRunnerState,
  executeGlbBuild,
} from './glb-build-runner.pipeline';
import type { GlbInputContract } from './glb-build-contract';

@Injectable()
export class GlbBuildRunner {
  private readonly appLoggerService: AppLoggerService;
  private readonly sceneAssetProfileService: SceneAssetProfileService;

  constructor(
    appLoggerService: AppLoggerService,
    sceneAssetProfileService: SceneAssetProfileService,
  ) {
    this.appLoggerService = appLoggerService;
    this.sceneAssetProfileService = sceneAssetProfileService;
  }

  async build(
    contract: GlbInputContract,
    runMetrics?: {
      pipelineMs?: number;
    },
  ): Promise<string> {
    const state = createGlbBuildRunnerState({
      appLoggerService: this.appLoggerService,
      sceneAssetProfileService: this.sceneAssetProfileService,
    });
    return executeGlbBuild(state, contract, runMetrics);
  }
}
