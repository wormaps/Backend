import type { GeoBounds, PlacePackage } from '../../places/types/place.types';
import type { ExternalPlaceDetail } from '../../places/types/external-place.types';
import type { SceneDetail, SceneMeta, StoredScene } from '../types/scene.types';

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
}

export interface SceneGenerationPipelineResult {
  place: ExternalPlaceDetail;
  placePackage: PlacePackage;
  meta: SceneMeta;
  detail: SceneDetail;
  assetPath: string;
}

export interface SceneGenerationPipelineInput {
  sceneId: string;
  storedScene: StoredScene;
  logContext: SceneGenerationLogContext;
}
