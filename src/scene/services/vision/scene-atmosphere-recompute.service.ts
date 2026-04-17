import { Injectable } from '@nestjs/common';
import type { SceneDetail, SceneMeta } from '../../types/scene.types';
import { SceneFacadeAtmosphereService } from './scene-facade-atmosphere.service';

@Injectable()
export class SceneAtmosphereRecomputeService {
  constructor(
    private readonly sceneFacadeAtmosphereService: SceneFacadeAtmosphereService,
  ) {}

  recompute(
    meta: SceneMeta,
    detail: SceneDetail,
  ): { meta: SceneMeta; detail: SceneDetail } {
    const refreshed =
      this.sceneFacadeAtmosphereService.refreshAtmosphereProfiles(detail);
    const materialClasses =
      this.sceneFacadeAtmosphereService.summarizeMaterialClasses(
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
