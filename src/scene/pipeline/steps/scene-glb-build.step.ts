import { Injectable } from '@nestjs/common';
import { GlbBuilderService } from '../../../assets/glb-builder.service';
import type { SceneDetail, SceneMeta } from '../../types/scene.types';
import { AppLoggerService } from '../../../common/logging/app-logger.service';

@Injectable()
export class SceneGlbBuildStep {
  constructor(
    private readonly glbBuilderService: GlbBuilderService,
    private readonly appLoggerService: AppLoggerService,
  ) {}

  execute(meta: SceneMeta, detail: SceneDetail): Promise<string> {
    this.appLoggerService.info('scene.glb_build.static_atmosphere', {
      sceneId: meta.sceneId,
      step: 'glb_build',
      staticAtmosphere: detail.staticAtmosphere?.preset ?? 'DAY_CLEAR',
      emissiveBoost: detail.staticAtmosphere?.emissiveBoost ?? 1,
      roadRoughnessScale: detail.staticAtmosphere?.roadRoughnessScale ?? 1,
      wetRoadBoost: detail.staticAtmosphere?.wetRoadBoost ?? 0,
    });

    return this.glbBuilderService.build(meta, detail);
  }
}
