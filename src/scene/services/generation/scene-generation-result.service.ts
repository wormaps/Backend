import { Injectable } from '@nestjs/common';
import { appMetrics } from '../../../common/metrics/metrics.instance';
import { AppLoggerService } from '../../../common/logging/app-logger.service';
import { SceneRepository } from '../../storage/scene.repository';
import { SceneFailureHandlerService } from './scene-failure-handler.service';
import { SceneSnapshotService } from './scene-snapshot.service';
import type { StoredScene, TrafficSegment, SceneLiveProvider, MidQaReport, SceneQualityGateResult } from '../../types/scene.types';
import type { FetchJsonEnvelope } from '../../../common/http/fetch-json';
import type { WeatherType } from '../../../places/types/place.types';

@Injectable()
export class SceneGenerationResultService {
  constructor(
    private readonly sceneRepository: SceneRepository,
    private readonly failureHandler: SceneFailureHandlerService,
    private readonly snapshotService: SceneSnapshotService,
    private readonly appLoggerService: AppLoggerService,
  ) {}

  async persist(args: {
    sceneId: string;
    storedScene: StoredScene;
    result: { place: any; meta: any; detail: any; placePackage: any; assetPath: string | null; providerTraces: any };
    qualityGate: SceneQualityGateResult;
    twinBuild: { twin: any; validation: any };
    qa: MidQaReport;
    weatherSnapshot: { source: string; updatedAt: string; preset: string; temperature: number | null; observedAt: string | null };
    weatherObserved: { observation: { date?: string } | null; upstreamEnvelopes: FetchJsonEnvelope[] };
    trafficSnapshot: { segments: TrafficSegment[]; degraded: boolean; failedSegmentCount: number; updatedAt: string };
    trafficObserved: { provider: SceneLiveProvider; upstreamEnvelopes: FetchJsonEnvelope[] };
    qualityPass: boolean;
    startedAt: number;
  }): Promise<void> {
    const {
      sceneId, storedScene, result, qualityGate, twinBuild, qa,
      weatherSnapshot, weatherObserved, trafficSnapshot, trafficObserved,
      qualityPass, startedAt,
    } = args;

    const qaFail = qa.summary === 'FAIL';
    const overallPass = qualityPass && !qaFail;
    const failureCategory = overallPass
      ? null
      : qaFail
        ? 'QA_REJECTED'
        : 'QUALITY_GATE_REJECTED';
    const weatherProvider = (weatherSnapshot.source === 'OPEN_METEO_HISTORICAL' || weatherSnapshot.source === 'OPEN_METEO_CURRENT')
      ? weatherSnapshot.source as 'OPEN_METEO_CURRENT' | 'OPEN_METEO_HISTORICAL'
      : 'OPEN_METEO_HISTORICAL';

    await this.sceneRepository.update(sceneId, (c) => ({
      ...c,
      attempts: c.attempts + 1,
      place: result.place,
      meta: { ...result.meta, qualityGate },
      detail: { ...result.detail, qualityGate },
      twin: twinBuild.twin,
      validation: twinBuild.validation,
      qa,
      latestWeatherSnapshot: {
        provider: weatherProvider,
        date: weatherObserved.observation?.date ?? weatherSnapshot.updatedAt.slice(0, 10),
        localTime: weatherSnapshot.observedAt ?? weatherSnapshot.updatedAt,
        resolvedWeather: this.snapshotService.toWeatherType(weatherSnapshot.preset),
        temperatureCelsius: weatherSnapshot.temperature,
        precipitationMm: null,
        capturedAt: weatherSnapshot.updatedAt,
        upstreamEnvelopes: weatherObserved.upstreamEnvelopes,
      },
      latestTrafficSnapshot: {
        provider: trafficObserved.provider === 'TOMTOM' ? 'TOMTOM' : 'UNAVAILABLE',
        observedAt: trafficSnapshot.updatedAt,
        segmentCount: trafficSnapshot.segments.length,
        averageCongestionScore: trafficSnapshot.segments.length > 0
          ? Number((trafficSnapshot.segments.reduce((s: number, seg: TrafficSegment) => s + seg.congestionScore, 0) / trafficSnapshot.segments.length).toFixed(3))
          : 0,
        segments: trafficSnapshot.segments,
        degraded: trafficSnapshot.degraded,
        failedSegmentCount: trafficSnapshot.failedSegmentCount,
        capturedAt: trafficSnapshot.updatedAt,
        upstreamEnvelopes: trafficObserved.upstreamEnvelopes,
      },
      scene: {
        ...c.scene,
        placeId: result.place.placeId,
        name: result.place.displayName,
        centerLat: result.place.location.lat,
        centerLng: result.place.location.lng,
        status: overallPass ? 'READY' : 'FAILED',
        assetUrl: result.assetPath ? `/api/scenes/${sceneId}/assets/base.glb` : null,
        failureReason: overallPass ? null : this.buildFailureReason(qualityGate, qa),
        failureCategory,
        qualityGate,
        updatedAt: new Date().toISOString(),
      },
    }));

    const logContext = {
      requestId: storedScene.requestId ?? null,
      sceneId,
      source: storedScene.generationSource ?? 'api',
    };

    if (overallPass) {
      this.recordSuccess(logContext, qualityGate, startedAt);
    } else {
      this.recordQualityFailure(logContext, qualityGate, qa, startedAt);
    }
  }

  private recordSuccess(
    logContext: Record<string, unknown>,
    qualityGate: { version: string; state: string; reasonCodes: string[] },
    startedAt: number,
  ): void {
    appMetrics.incrementCounter('scene_generation_total', 1, { outcome: 'success' }, 'Total scene generation results by outcome.');
    appMetrics.observeDuration('scene_generation_duration_ms', Date.now() - startedAt, { outcome: 'success' }, 'Scene generation duration in milliseconds.');
    this.appLoggerService.info('scene.ready', { ...logContext, step: 'complete', status: 'READY', qualityGate: { version: qualityGate.version, state: qualityGate.state, reasonCodes: qualityGate.reasonCodes } });
  }

  private recordQualityFailure(
    logContext: Record<string, unknown>,
    qualityGate: SceneQualityGateResult,
    qa: MidQaReport,
    startedAt: number,
  ): void {
    const qaFail = qa.summary === 'FAIL';
    const failureCategory = qaFail ? 'QA_REJECTED' : 'QUALITY_GATE_REJECTED';
    this.appLoggerService.warn('scene.quality_gate.rejected', {
      ...logContext, step: 'quality_gate', status: 'FAILED', failureCategory,
      qualityGate: { version: qualityGate.version, state: qualityGate.state, reasonCodes: qualityGate.reasonCodes, scores: qualityGate.scores, thresholds: qualityGate.thresholds },
      qaSummary: qa.summary,
    });
    appMetrics.incrementCounter('scene_generation_total', 1, { outcome: 'failure' }, 'Total scene generation results by outcome.');
    appMetrics.observeDuration('scene_generation_duration_ms', Date.now() - startedAt, { outcome: 'failure' }, 'Scene generation duration in milliseconds.');
  }

  private buildFailureReason(qualityGate: SceneQualityGateResult, qa: MidQaReport): string | null {
    const qaFail = qa.summary === 'FAIL';
    if (qaFail) {
      const failedChecks = qa.checks.filter((c) => c.state === 'FAIL').map((c) => c.id);
      return `QA rejected this scene: ${failedChecks.join(', ')}`;
    }
    return this.failureHandler.buildQualityFailureReason(qualityGate);
  }
}
