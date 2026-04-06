import { HttpStatus, Injectable } from '@nestjs/common';
import { GooglePlacesClient } from '../../../places/clients/google-places.client';
import { ERROR_CODES } from '../../../common/constants/error-codes';
import { AppException } from '../../../common/errors/app.exception';
import { resolveSceneBounds } from '../../utils/scene-geometry.utils';
import type { SceneScale } from '../../types/scene.types';
import type { ResolvedScenePlace } from '../scene-generation-pipeline.types';

@Injectable()
export class ScenePlaceResolutionStep {
  constructor(
    private readonly googlePlacesClient: GooglePlacesClient,
  ) {}

  async execute(query: string, scale: SceneScale): Promise<ResolvedScenePlace> {
    const candidates = await this.googlePlacesClient.searchText(query, 1);
    const selected = candidates[0];
    if (!selected) {
      throw new AppException({
        code: ERROR_CODES.GOOGLE_PLACE_NOT_FOUND,
        message: '검색 결과에 해당하는 장소를 찾을 수 없습니다.',
        detail: { query },
        status: HttpStatus.NOT_FOUND,
      });
    }

    const place = await this.googlePlacesClient.getPlaceDetail(selected.placeId);
    const radiusM = this.resolveRadius(scale);
    const bounds = resolveSceneBounds(place.location, radiusM);

    return {
      place,
      bounds,
      radiusM,
      candidateCount: candidates.length,
    };
  }

  private resolveRadius(scale: SceneScale): number {
    if (scale === 'SMALL') {
      return 300;
    }
    if (scale === 'LARGE') {
      return 1000;
    }
    return 600;
  }
}
