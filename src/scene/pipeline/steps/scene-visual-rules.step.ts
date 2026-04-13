import { Injectable } from '@nestjs/common';
import { SceneVisionService } from '../../services/vision';
import type {
  GeoBounds,
  PlacePackage,
} from '../../../places/types/place.types';
import type { ExternalPlaceDetail } from '../../../places/types/external-place.types';
import type { ProviderTrace, SceneDetail, SceneMeta } from '../../types/scene.types';

@Injectable()
export class SceneVisualRulesStep {
  constructor(private readonly sceneVisionService: SceneVisionService) {}

  execute(
    sceneId: string,
    place: ExternalPlaceDetail,
    bounds: GeoBounds,
    placePackage: PlacePackage,
  ): Promise<{
    detail: SceneDetail;
    metaPatch: Pick<
      SceneMeta,
      'detailStatus' | 'visualCoverage' | 'materialClasses' | 'landmarkAnchors'
    >;
    providerTrace: ProviderTrace | null;
  }> {
    return this.sceneVisionService.buildSceneVision(
      sceneId,
      place,
      bounds,
      placePackage,
    );
  }
}
