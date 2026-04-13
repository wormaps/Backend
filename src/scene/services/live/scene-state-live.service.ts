import { HttpStatus, Injectable } from '@nestjs/common';
import { ERROR_CODES } from '../../../common/constants/error-codes';
import { AppException } from '../../../common/errors/app.exception';
import { TtlCacheService } from '../../../cache/ttl-cache.service';
import { OpenMeteoClient } from '../../../places/clients/open-meteo.client';
import { SnapshotBuilderService } from '../../../places/snapshot/snapshot-builder.service';
import { toRegistryLikePlace } from '../../../places/utils/place-registry.utils';
import type {
  SceneEntityStateItem,
  SceneEntityStateQuery,
  SceneEntityStateResponse,
  SceneTwinGraph,
  TwinComponent,
  TwinEntity,
  SceneStateQuery,
  SceneStateResponse,
} from '../../types/scene.types';
import { SceneReadService } from '../read/scene-read.service';

@Injectable()
export class SceneStateLiveService {
  private readonly ttlMs = 10 * 60 * 1000;

  constructor(
    private readonly sceneReadService: SceneReadService,
    private readonly ttlCacheService: TtlCacheService,
    private readonly openMeteoClient: OpenMeteoClient,
    private readonly snapshotBuilderService: SnapshotBuilderService,
  ) {}

  async getState(
    sceneId: string,
    query: SceneStateQuery,
  ): Promise<SceneStateResponse> {
    return this.ttlCacheService.getOrSet(
      this.buildCacheKey(sceneId, query),
      this.ttlMs,
      async () => {
        const storedScene = await this.sceneReadService.getReadyScene(sceneId);
        const date = query.date ?? resolvePlaceLocalDate(storedScene.place);
        const weatherObservation =
          query.weather === undefined
            ? await this.openMeteoClient.getObservation(
                storedScene.place,
                date,
                query.timeOfDay,
              )
            : null;
        const resolvedWeather =
          query.weather ?? weatherObservation?.resolvedWeather ?? 'CLEAR';
        const snapshot = this.snapshotBuilderService.build(
          toRegistryLikePlace(storedScene.place),
          query.timeOfDay,
          resolvedWeather,
        );

        return {
          placeId: snapshot.placeId,
          updatedAt: snapshot.generatedAt,
          timeOfDay: snapshot.timeOfDay,
          weather: snapshot.weather,
          source: snapshot.source,
          crowd: snapshot.crowd,
          vehicles: snapshot.vehicles,
          lighting: snapshot.lighting,
          surface: snapshot.surface,
          playback: snapshot.playback,
          sourceDetail: weatherObservation
            ? {
                provider: weatherObservation.source,
                date: weatherObservation.date,
                localTime: weatherObservation.localTime,
              }
            : {
                provider: 'MVP_SYNTHETIC_RULES',
              },
        };
      },
    );
  }

  async getEntityState(
    sceneId: string,
    query: SceneEntityStateQuery,
  ): Promise<SceneEntityStateResponse> {
    return this.ttlCacheService.getOrSet(
      this.buildEntityStateCacheKey(sceneId, query),
      this.ttlMs,
      async () => {
        const storedScene = await this.sceneReadService.getReadyScene(sceneId);
        const twin = storedScene.twin;
        if (!twin) {
          throw new AppException({
            code: ERROR_CODES.SCENE_NOT_READY,
            message: 'Scene twin graph가 아직 준비되지 않았습니다.',
            detail: {
              sceneId,
              status: storedScene.scene.status,
            },
            status: HttpStatus.CONFLICT,
          });
        }

        const date = query.date ?? resolvePlaceLocalDate(storedScene.place);
        const weatherObservation =
          query.weather === undefined
            ? await this.openMeteoClient.getObservation(
                storedScene.place,
                date,
                query.timeOfDay,
              )
            : null;
        const resolvedWeather =
          query.weather ?? weatherObservation?.resolvedWeather ?? 'CLEAR';
        const snapshot = this.snapshotBuilderService.build(
          toRegistryLikePlace(storedScene.place),
          query.timeOfDay,
          resolvedWeather,
        );

        const entities = buildEntityStateItems(twin, {
          kind: query.kind,
          objectId: query.objectId,
        });

        return {
          sceneId,
          updatedAt: snapshot.generatedAt,
          timeOfDay: snapshot.timeOfDay,
          weather: snapshot.weather,
          source: snapshot.source,
          filters: {
            kind: query.kind,
            objectId: query.objectId,
          },
          total: entities.length,
          entities,
        };
      },
    );
  }

  private buildCacheKey(sceneId: string, query: SceneStateQuery): string {
    return `scene-state:${sceneId}:${query.date ?? 'AUTO'}:${query.timeOfDay}:${query.weather ?? 'AUTO'}`;
  }

  private buildEntityStateCacheKey(
    sceneId: string,
    query: SceneEntityStateQuery,
  ): string {
    return `scene-entity-state:${sceneId}:${query.date ?? 'AUTO'}:${query.timeOfDay}:${query.weather ?? 'AUTO'}:${query.kind ?? 'ALL'}:${query.objectId ?? 'ALL'}`;
  }
}

function buildEntityStateItems(
  twin: SceneTwinGraph,
  filters: {
    kind?: SceneEntityStateQuery['kind'];
    objectId?: string;
  },
): SceneEntityStateItem[] {
  const componentMap = new Map<string, TwinComponent>(
    twin.components.map((component) => [component.componentId, component]),
  );

  return twin.entities
    .filter((entity) => entity.kind !== 'SCENE')
    .filter((entity) => (filters.kind ? entity.kind === filters.kind : true))
    .filter((entity) =>
      filters.objectId ? entity.objectId === filters.objectId : true,
    )
    .map((entity) => toEntityStateItem(entity, componentMap))
    .filter((item): item is SceneEntityStateItem => item !== null);
}

function toEntityStateItem(
  entity: TwinEntity,
  componentMap: Map<string, TwinComponent>,
): SceneEntityStateItem | null {
  const stateComponents = entity.componentIds
    .map((componentId) => componentMap.get(componentId))
    .filter((component): component is TwinComponent => Boolean(component))
    .filter((component) => component.kind === 'STATE_BINDING');

  if (stateComponents.length === 0) {
    return null;
  }

  const stateProperty = stateComponents
    .flatMap((component) => component.properties)
    .find((property) => property.name === 'stateMode');

  return {
    entityId: entity.entityId,
    objectId: entity.objectId,
    kind: entity.kind,
    stateMode:
      stateProperty?.value === 'SYNTHETIC_RULES'
        ? 'SYNTHETIC_RULES'
        : 'SYNTHETIC_RULES',
    confidence: stateProperty?.confidence ?? 0.4,
    sourceSnapshotIds: stateProperty?.sourceSnapshotIds ?? [],
  };
}

export function resolvePlaceLocalDate(place: {
  utcOffsetMinutes: number | null;
}): string {
  const now = new Date();
  const offsetMinutes = place.utcOffsetMinutes ?? 0;
  const shifted = new Date(now.getTime() + offsetMinutes * 60 * 1000);
  const year = shifted.getUTCFullYear();
  const month = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const day = String(shifted.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
