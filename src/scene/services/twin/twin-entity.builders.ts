import type {
  TwinComponent,
  TwinEntity,
  TwinEvidence,
  TwinRelationship,
} from '../../types/scene.types';
import type { SnapshotIds } from './twin-source-snapshot.builder';
import {
  registerSceneEntity,
  registerPlaceEntity,
  registerBuildings,
} from './twin-entity-core.builders';
import {
  registerRoads,
  registerWalkways,
  registerPois,
} from './twin-entity-infrastructure.builders';
import {
  registerCrossings,
  registerStreetFurniture,
  registerVegetation,
  registerLandCovers,
  registerLinearFeatures,
  registerLandmarkAnchors,
} from './twin-entity-detail.builders';

export interface RegisterAllEntitiesArgs {
  entities: TwinEntity[];
  components: TwinComponent[];
  relationships: TwinRelationship[];
  evidence: TwinEvidence[];
  sceneId: string;
  snapshotIds: SnapshotIds;
  meta: import('../../types/scene.types').SceneMeta;
  detail: import('../../types/scene.types').SceneDetail;
  scale: string;
  terrainProfile: {
    mode: string;
    hasElevationModel: boolean;
    baseHeightMeters: number;
  };
  place: import('../../../places/types/external-place.types').ExternalPlaceDetail;
}

export function registerAllEntities(ctx: RegisterAllEntitiesArgs): void {
  const sceneEntityId = registerSceneEntity(ctx);
  registerPlaceEntity(ctx, sceneEntityId);
  registerBuildings(ctx, sceneEntityId);
  registerRoads(ctx, sceneEntityId);
  registerWalkways(ctx, sceneEntityId);
  registerPois(ctx, sceneEntityId);
  registerCrossings(ctx, sceneEntityId);
  registerStreetFurniture(ctx, sceneEntityId);
  registerVegetation(ctx, sceneEntityId);
  registerLandCovers(ctx, sceneEntityId);
  registerLinearFeatures(ctx, sceneEntityId);
  registerLandmarkAnchors(ctx, sceneEntityId);
}
