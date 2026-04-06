import { Injectable } from '@nestjs/common';
import { TtlCacheService } from '../../../cache/ttl-cache.service';
import { OpenMeteoClient } from '../../../places/clients/open-meteo.client';
import { SnapshotBuilderService } from '../../../places/snapshot/snapshot-builder.service';
import { toRegistryLikePlace } from '../../../places/utils/place-registry.utils';
import type {
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

  private buildCacheKey(sceneId: string, query: SceneStateQuery): string {
    return `scene-state:${sceneId}:${query.date ?? 'AUTO'}:${query.timeOfDay}:${query.weather ?? 'AUTO'}`;
  }
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
