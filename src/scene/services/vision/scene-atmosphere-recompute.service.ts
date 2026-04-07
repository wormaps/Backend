import { Injectable, Optional } from '@nestjs/common';
import type { SceneDetail, SceneMeta } from '../../types/scene.types';
import { SceneFacadeVisionService } from './scene-facade-vision.service';

@Injectable()
export class SceneAtmosphereRecomputeService {
  constructor(
    @Optional()
    private readonly sceneFacadeVisionService: SceneFacadeVisionService = new SceneFacadeVisionService(),
  ) {}

  recompute(
    meta: SceneMeta,
    detail: SceneDetail,
  ): { meta: SceneMeta; detail: SceneDetail } {
    const refreshed =
      this.sceneFacadeVisionService.refreshAtmosphereProfiles(detail);
    const materialClasses =
      this.sceneFacadeVisionService.summarizeMaterialClasses(
        detail.facadeHints,
      );

    return {
      meta: {
        ...meta,
        materialClasses,
      },
      detail: {
        ...detail,
        ...refreshed,
      },
    };
  }
}
