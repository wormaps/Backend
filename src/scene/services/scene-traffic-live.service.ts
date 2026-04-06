import { Injectable } from '@nestjs/common';
import { TtlCacheService } from '../../cache/ttl-cache.service';
import { TomTomTrafficClient } from '../../places/clients/tomtom-traffic.client';
import type {
  SceneTrafficResponse,
  TrafficSegment,
} from '../types/scene.types';
import { SceneReadService } from './scene-read.service';

@Injectable()
export class SceneTrafficLiveService {
  private readonly ttlMs = 2 * 60 * 1000;

  constructor(
    private readonly sceneReadService: SceneReadService,
    private readonly ttlCacheService: TtlCacheService,
    private readonly tomTomTrafficClient: TomTomTrafficClient,
  ) {}

  async getTraffic(sceneId: string): Promise<SceneTrafficResponse> {
    return this.ttlCacheService.getOrSet(
      this.buildCacheKey(sceneId),
      this.ttlMs,
      async () => {
        const storedScene = await this.sceneReadService.getReadyScene(sceneId);
        let failedSegmentCount = 0;
        const segments = await Promise.all(
          storedScene.meta.roads.map(async (road) => {
            try {
              const segment = await this.tomTomTrafficClient.getFlowSegment(
                road.center,
              );
              return mapTrafficSegment(road.objectId, segment?.flowSegmentData);
            } catch {
              failedSegmentCount += 1;
              return mapTrafficSegment(road.objectId);
            }
          }),
        );

        return {
          updatedAt: new Date().toISOString(),
          segments,
          degraded: failedSegmentCount > 0,
          failedSegmentCount,
        };
      },
    );
  }

  private buildCacheKey(sceneId: string): string {
    return `scene-traffic:${sceneId}`;
  }
}

function mapTrafficSegment(
  objectId: string,
  flowSegmentData?: {
    currentSpeed?: number;
    freeFlowSpeed?: number;
    confidence?: number;
    roadClosure?: boolean;
  },
): TrafficSegment {
  const currentSpeed = flowSegmentData?.currentSpeed ?? 0;
  const freeFlowSpeed = flowSegmentData?.freeFlowSpeed ?? 0;
  const congestionScore =
    freeFlowSpeed > 0 ? 1 - currentSpeed / freeFlowSpeed : 0;

  return {
    objectId,
    currentSpeed,
    freeFlowSpeed,
    congestionScore: Number(congestionScore.toFixed(2)),
    status: resolveTrafficStatus(congestionScore),
    confidence: flowSegmentData?.confidence ?? null,
    roadClosure: flowSegmentData?.roadClosure ?? false,
  };
}

function resolveTrafficStatus(
  congestionScore: number,
): 'free' | 'moderate' | 'slow' | 'jammed' {
  if (congestionScore >= 0.8) {
    return 'jammed';
  }
  if (congestionScore >= 0.5) {
    return 'slow';
  }
  if (congestionScore >= 0.2) {
    return 'moderate';
  }
  return 'free';
}
