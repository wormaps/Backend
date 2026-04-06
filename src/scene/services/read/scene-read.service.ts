import { HttpStatus, Injectable } from '@nestjs/common';
import { ERROR_CODES } from '../../../common/constants/error-codes';
import { AppException } from '../../../common/errors/app.exception';
import { SceneRepository } from '../../storage/scene.repository';
import type {
  BootstrapResponse,
  SceneDetail,
  SceneEntity,
  SceneMeta,
  ScenePlacesResponse,
  StoredScene,
} from '../../types/scene.types';

type ReadyStoredScene = StoredScene & {
  meta: SceneMeta;
  detail: SceneDetail;
  place: NonNullable<StoredScene['place']>;
};

@Injectable()
export class SceneReadService {
  constructor(private readonly sceneRepository: SceneRepository) {}

  async getScene(sceneId: string): Promise<SceneEntity> {
    return (await this.getStoredScene(sceneId)).scene;
  }

  async getSceneMeta(sceneId: string): Promise<SceneMeta> {
    return (await this.getReadyScene(sceneId)).meta;
  }

  async getSceneDetail(sceneId: string): Promise<SceneDetail> {
    return (await this.getReadyScene(sceneId)).detail;
  }

  async getBootstrap(sceneId: string): Promise<BootstrapResponse> {
    const stored = await this.getReadyScene(sceneId);
    const scene = stored.scene;
    const detailUrl = `/api/scenes/${scene.sceneId}/detail`;
    const placesUrl = `/api/scenes/${scene.sceneId}/places`;

    return {
      sceneId: scene.sceneId,
      assetUrl:
        scene.assetUrl ?? `/api/scenes/${scene.sceneId}/assets/base.glb`,
      metaUrl: scene.metaUrl,
      detailUrl,
      detailStatus: stored.detail.detailStatus,
      glbSources: {
        googlePlaces: true,
        overpass: true,
        mapillary: stored.detail.provenance.mapillaryUsed,
        weatherBaked: false,
        trafficBaked: false,
      },
      assetProfile: stored.meta.assetProfile,
      structuralCoverage: stored.meta.structuralCoverage,
      fidelityPlan: stored.meta.fidelityPlan,
      liveEndpoints: {
        state: `/api/scenes/${scene.sceneId}/state`,
        traffic: `/api/scenes/${scene.sceneId}/traffic`,
        weather: `/api/scenes/${scene.sceneId}/weather`,
        places: placesUrl,
      },
      renderContract: {
        glbCoverage: {
          buildings: true,
          roads: true,
          walkways: true,
          crosswalks: true,
          streetFurniture: true,
          vegetation: true,
          pois: true,
          landCovers: true,
          linearFeatures: true,
        },
        overlaySources: {
          pois: placesUrl,
          crossings: detailUrl,
          streetFurniture: detailUrl,
          vegetation: detailUrl,
          landCovers: detailUrl,
          linearFeatures: detailUrl,
        },
        liveDataModes: {
          traffic: 'LIVE_BEST_EFFORT',
          weather: 'CURRENT_OR_HISTORICAL',
          state: 'SYNTHETIC_RULES',
        },
      },
    };
  }

  async getPlaces(sceneId: string): Promise<ScenePlacesResponse> {
    const storedScene = await this.getReadyScene(sceneId);
    const pois = storedScene.meta.pois;
    const categories = [...pois].reduce((acc, poi) => {
      const key = poi.category ?? poi.type.toLowerCase();
      const current = acc.get(key) ?? {
        category: key,
        count: 0,
        landmarkCount: 0,
      };
      current.count += 1;
      if (poi.isLandmark) {
        current.landmarkCount += 1;
      }
      acc.set(key, current);
      return acc;
    }, new Map<string, ScenePlacesResponse['categories'][number]>());

    return {
      pois,
      landmarks: pois.filter((poi) => poi.isLandmark),
      categories: [...categories.values()].sort((left, right) => {
        if (right.count !== left.count) {
          return right.count - left.count;
        }
        return left.category.localeCompare(right.category);
      }),
    };
  }

  async getStoredScene(sceneId: string): Promise<StoredScene> {
    const storedScene = await this.sceneRepository.findById(sceneId);
    if (!storedScene) {
      throw new AppException({
        code: ERROR_CODES.SCENE_NOT_FOUND,
        message: 'Scene을 찾을 수 없습니다.',
        detail: { sceneId },
        status: HttpStatus.NOT_FOUND,
      });
    }

    return storedScene;
  }

  async getReadyScene(sceneId: string): Promise<ReadyStoredScene> {
    const storedScene = await this.getStoredScene(sceneId);
    if (
      storedScene.scene.status !== 'READY' ||
      storedScene.meta === undefined ||
      storedScene.detail === undefined ||
      storedScene.place === undefined
    ) {
      throw new AppException({
        code: ERROR_CODES.SCENE_NOT_READY,
        message: 'Scene 생성이 아직 완료되지 않았습니다.',
        detail: {
          sceneId,
          status: storedScene.scene.status,
        },
        status: HttpStatus.CONFLICT,
      });
    }

    return storedScene as ReadyStoredScene;
  }
}
