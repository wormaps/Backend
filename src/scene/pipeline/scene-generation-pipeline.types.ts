import type { GeoBounds, PlacePackage } from '../../places/types/place.types';
import type { ExternalPlaceDetail } from '../../places/types/external-place.types';
import type {
  ProviderTrace,
  SceneDetail,
  SceneMeta,
  StoredScene,
} from '../types/scene.types';

export interface SceneGenerationLogContext {
  requestId: string | null;
  sceneId: string;
  source: string;
}

export interface ResolvedScenePlace {
  place: ExternalPlaceDetail;
  bounds: GeoBounds;
  radiusM: number;
  candidateCount: number;
  providerTrace: ProviderTrace;
}

export interface SceneGenerationPipelineResult {
  place: ExternalPlaceDetail;
  placePackage: PlacePackage;
  meta: SceneMeta;
  detail: SceneDetail;
  assetPath: string;
  providerTraces: {
    googlePlaces: ProviderTrace;
    overpass: ProviderTrace;
    mapillary?: ProviderTrace | null;
  };
}

export interface SceneGenerationPipelineInput {
  sceneId: string;
  storedScene: StoredScene;
  logContext: SceneGenerationLogContext;
}
