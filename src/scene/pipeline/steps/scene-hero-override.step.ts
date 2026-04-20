import { Injectable } from '@nestjs/common';
import { SceneHeroOverrideService } from '../../services/hero-override';
import type { ExternalPlaceDetail } from '../../../places/types/external-place.types';
import type { SceneDetail, SceneMeta } from '../../types/scene.types';

@Injectable()
export class SceneHeroOverrideStep {
  constructor(
    private readonly sceneHeroOverrideService: SceneHeroOverrideService,
  ) {}

  async execute(
    place: ExternalPlaceDetail,
    meta: SceneMeta,
    detail: SceneDetail,
  ): Promise<{ meta: SceneMeta; detail: SceneDetail }> {
    return this.sceneHeroOverrideService.applyOverrides(place, meta, detail);
  }
}
