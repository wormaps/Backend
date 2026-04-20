import { Injectable } from '@nestjs/common';
import { TtlCacheService } from '../../../cache/ttl-cache.service';
import { TomTomTrafficClient } from '../../../places/clients/tomtom-traffic.client';
import type {
  SceneTrafficResponse,
  TrafficSegment,
} from '../../types/scene.types';
import { SceneReadService } from '../read/scene-read.service';
import { SceneRepository } from '../../storage/scene.repository';
import type { Coordinate } from '../../../places/types/place.types';
import type { FetchJsonEnvelope } from '../../../common/http/fetch-json';
import { AppLoggerService } from '../../../common/logging/app-logger.service';

type SceneTrafficProvider = 'TOMTOM' | 'UNAVAILABLE';

@Injectable()
export class SceneTrafficLiveService {
  private readonly ttlMs = 2 * 60 * 1000;

  constructor(
    private readonly sceneReadService: SceneReadService,
    private readonly sceneRepository: SceneRepository,
    private readonly ttlCacheService: TtlCacheService,
    private readonly tomTomTrafficClient: TomTomTrafficClient,
    private readonly appLoggerService: AppLoggerService,
  ) {}

  async getTraffic(sceneId: string): Promise<SceneTrafficResponse> {
    return this.ttlCacheService.getOrSet(
      this.buildCacheKey(sceneId),
      this.ttlMs,
      async () => {
        const storedScene = await this.sceneReadService.getReadyScene(sceneId);
        const cachedSnapshotResponse = this.readFreshSnapshot(storedScene);
        if (cachedSnapshotResponse) {
          return cachedSnapshotResponse;
        }

        const sampled = await this.sampleTrafficByRoads(
          storedScene.meta.roads.map((road) => ({
            objectId: road.objectId,
            center: road.center,
          })),
          storedScene.requestId ?? null,
        );
        const normalizedSegments = sampled.segments;
        const upstreamEnvelopes = sampled.upstreamEnvelopes;
        const failedSegmentCount = sampled.failedSegmentCount;
        const provider = sampled.provider;

        const averageCongestionScore =
          normalizedSegments.length > 0
            ? Number(
                (
                  normalizedSegments.reduce(
                    (sum, segment) => sum + segment.congestionScore,
                    0,
                  ) / normalizedSegments.length
                ).toFixed(3),
              )
            : 0;

        await this.sceneRepository.update(sceneId, (current) => ({
          ...current,
          latestTrafficSnapshot: {
            provider,
            observedAt: new Date().toISOString(),
            segmentCount: normalizedSegments.length,
            averageCongestionScore,
            degraded: failedSegmentCount > 0,
            failedSegmentCount,
            capturedAt: new Date().toISOString(),
            upstreamEnvelopes,
          },
        }));

        return {
          updatedAt: new Date().toISOString(),
          segments: normalizedSegments,
          degraded: failedSegmentCount > 0,
          failedSegmentCount,
          provider,
        };
      },
    );
  }

  async sampleTrafficByRoads(
    roads: Array<{ objectId: string; center: Coordinate }>,
    requestId?: string | null,
  ): Promise<{
    segments: TrafficSegment[];
    failedSegmentCount: number;
    upstreamEnvelopes: FetchJsonEnvelope[];
    provider: SceneTrafficProvider;
  }> {
    const tomTomUnavailableReason = this.resolveTomTomUnavailableReason();
    if (tomTomUnavailableReason) {
      this.appLoggerService.warn('scene.traffic.provider_unavailable', {
        requestId: requestId ?? null,
        provider: 'tomtom',
        step: 'live_traffic',
        reason: tomTomUnavailableReason,
      });
      return {
        segments: roads.map((road) => mapTrafficSegment(road.objectId)),
        failedSegmentCount: roads.length,
        upstreamEnvelopes: [],
        provider: 'UNAVAILABLE',
      };
    }

    let failedSegmentCount = 0;
    const sampled = await Promise.all(
      roads.map(async (road) => {
        try {
          const response =
            await this.tomTomTrafficClient.getFlowSegmentWithEnvelope(
              road.center,
              requestId,
            );
          return {
            segment: mapTrafficSegment(
              road.objectId,
              response.data?.flowSegmentData,
            ),
            upstreamEnvelopes: response.upstreamEnvelopes,
          };
        } catch {
          failedSegmentCount += 1;
          return {
            segment: mapTrafficSegment(road.objectId),
            upstreamEnvelopes: [],
          };
        }
      }),
    );

    return {
      segments: sampled.map((item) => item.segment),
      failedSegmentCount,
      upstreamEnvelopes: sampled.flatMap((item) => item.upstreamEnvelopes),
      provider: 'TOMTOM',
    };
  }

  private buildCacheKey(sceneId: string): string {
    return `scene-traffic:${sceneId}`;
  }

  private readFreshSnapshot(
    storedScene: Awaited<ReturnType<SceneReadService['getReadyScene']>>,
  ): SceneTrafficResponse | null {
    const snapshot = storedScene.latestTrafficSnapshot;
    if (!snapshot) {
      return null;
    }

    const capturedAtMs = Date.parse(snapshot.capturedAt);
    if (!Number.isFinite(capturedAtMs)) {
      return null;
    }

    if (Date.now() - capturedAtMs > this.ttlMs) {
      return null;
    }

    if (!storedScene.meta) {
      return null;
    }

    return {
      updatedAt: snapshot.capturedAt,
      segments:
        snapshot.segments && snapshot.segments.length > 0
          ? snapshot.segments
          : storedScene.meta.roads.map((road) => ({
              objectId: road.objectId,
              currentSpeed: 0,
              freeFlowSpeed: 0,
              congestionScore: Number(
                snapshot.averageCongestionScore.toFixed(2),
              ),
              status: resolveTrafficStatus(snapshot.averageCongestionScore),
              confidence: null,
              roadClosure: false,
            })),
      degraded: snapshot.degraded,
      failedSegmentCount: snapshot.failedSegmentCount,
      provider: snapshot.provider,
    };
  }

  private resolveTomTomUnavailableReason(): 'NO_API_KEY' | null {
    if (!process.env.TOMTOM_API_KEY?.trim()) {
      return 'NO_API_KEY';
    }

    return null;
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
