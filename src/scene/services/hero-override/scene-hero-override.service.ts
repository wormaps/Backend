import { Injectable } from '@nestjs/common';
import { ExternalPlaceDetail } from '../../../places/types/external-place.types';
import { SceneDetail, SceneMeta } from '../../types/scene.types';
import { SceneHeroOverrideApplierService } from './scene-hero-override-applier.service';
import { SceneHeroOverrideMatcherService } from './scene-hero-override-matcher.service';

@Injectable()
export class SceneHeroOverrideService {
  constructor(
    private readonly matcher: SceneHeroOverrideMatcherService,
    private readonly applier: SceneHeroOverrideApplierService,
  ) {}

  applyOverrides(
    place: ExternalPlaceDetail,
    meta: SceneMeta,
    detail: SceneDetail,
  ): {
    meta: SceneMeta;
    detail: SceneDetail;
  } {
    const manifest = this.matcher.findManifest(place);
    if (!manifest) {
      return { meta, detail };
    }
    return this.applier.apply(meta, detail, manifest);
  }
}
