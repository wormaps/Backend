import { afterEach, beforeEach, describe, expect, it, vi } from 'bun:test';
import { Test, TestingModule } from '@nestjs/testing';
import { rm, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { SceneGenerationResultService } from '../src/scene/services/generation/scene-generation-result.service';
import { SceneRepository } from '../src/scene/storage/scene.repository';
import { SceneFailureHandlerService } from '../src/scene/services/generation/scene-failure-handler.service';
import { SceneSnapshotService } from '../src/scene/services/generation/scene-snapshot.service';
import { SceneQueueManagerService } from '../src/scene/services/generation/scene-queue-manager.service';
import { SceneWeatherLiveService } from '../src/scene/services/live/scene-weather-live.service';
import { SceneTrafficLiveService } from '../src/scene/services/live/scene-traffic-live.service';
import { AppLoggerService } from '../src/common/logging/app-logger.service';
import type { StoredScene, MidQaReport, SceneQualityGateResult, SceneLiveProvider } from '../src/scene/types/scene.types';

describe('Phase 1 QA FAIL blocks READY promotion', () => {
  const testSceneDataDir = join(process.cwd(), 'data', 'scene', '.spec-temp-qa');
  let resultService: SceneGenerationResultService;
  let repository: SceneRepository;
  let appLoggerService: AppLoggerService;

  beforeEach(async () => {
    await rm(testSceneDataDir, { recursive: true, force: true });
    await mkdir(testSceneDataDir, { recursive: true });
    process.env.SCENE_DATA_DIR = testSceneDataDir;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SceneGenerationResultService,
        SceneRepository,
        SceneFailureHandlerService,
        SceneSnapshotService,
        SceneQueueManagerService,
        {
          provide: SceneWeatherLiveService,
          useValue: {
            getWeather: vi.fn().mockResolvedValue({}),
          },
        },
        {
          provide: SceneTrafficLiveService,
          useValue: {
            getTraffic: vi.fn().mockResolvedValue({}),
          },
        },
        {
          provide: AppLoggerService,
          useValue: {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            fromRequest: vi.fn(),
          },
        },
      ],
    }).compile();

    resultService = module.get(SceneGenerationResultService);
    repository = module.get(SceneRepository);
    appLoggerService = module.get(AppLoggerService);
    await repository.clear();
  });

  afterEach(async () => {
    await rm(testSceneDataDir, { recursive: true, force: true });
    delete process.env.SCENE_DATA_DIR;
  });

  function makeStoredScene(sceneId: string): StoredScene {
    return {
      requestKey: `req-${sceneId}`,
      requestId: `req-${sceneId}`,
      attempts: 0,
      generationSource: 'api',
      query: 'test',
      scale: 'MEDIUM',
      scene: {
        sceneId,
        placeId: 'test-place',
        name: 'Test Place',
        centerLat: 37.5665,
        centerLng: 126.978,
        radiusM: 500,
        status: 'PENDING',
        metaUrl: `/api/scenes/${sceneId}/meta`,
        assetUrl: null,
        failureReason: null,
        failureCategory: null,
        qualityGate: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    };
  }

  function makeQualityGatePass(): SceneQualityGateResult {
    return {
      version: 'qg.v1',
      state: 'PASS',
      reasonCodes: [],
      scores: {
        overall: 0.8,
        breakdown: { structure: 0.82, atmosphere: 0.74, placeReadability: 0.78 },
        modeDeltaOverallScore: 0.12,
      },
      thresholds: {
        coverageGapMax: 1,
        overallMin: 0.45,
        structureMin: 0.45,
        placeReadabilityMin: 0,
        modeDeltaOverallMin: -0.2,
        criticalPolygonBudgetExceededMax: 0,
        criticalInvalidGeometryMax: 0,
        maxSkippedMeshesWarn: 180,
        maxMissingSourceWarn: 48,
      },
      meshSummary: {
        totalSkipped: 0,
        polygonBudgetExceededCount: 0,
        criticalPolygonBudgetExceededCount: 0,
        emptyOrInvalidGeometryCount: 0,
        criticalEmptyOrInvalidGeometryCount: 0,
        selectionCutCount: 0,
        missingSourceCount: 0,
      },
      artifactRefs: {
        diagnosticsLogPath: '/tmp/diagnostics.log',
        modeComparisonPath: '/tmp/mode-comparison.json',
      },
      oracleApproval: { required: false, state: 'NOT_REQUIRED', source: 'auto' },
      decidedAt: '2026-01-01T00:00:00.000Z',
    };
  }

  function makeQaReportFail(): MidQaReport {
    return {
      reportId: 'midqa-test',
      sceneId: 'test-scene',
      generatedAt: new Date().toISOString(),
      summary: 'FAIL',
      score: { overall: 0.3, confidence: 'low' },
      checks: [
        {
          id: 'provider_trace',
          state: 'FAIL',
          summary: '외부 provider trace 존재 여부',
          metrics: { providerSnapshotCount: 0 },
        },
      ],
      findings: [{ severity: 'error', message: 'provider_trace check failed' }],
      references: { twinBuildId: 'twin-1', validationReportId: 'val-1' },
    };
  }

  function makeQaReportWarn(): MidQaReport {
    return {
      reportId: 'midqa-test',
      sceneId: 'test-scene',
      generatedAt: new Date().toISOString(),
      summary: 'WARN',
      score: { overall: 0.6, confidence: 'medium' },
      checks: [
        {
          id: 'provider_trace',
          state: 'WARN',
          summary: '외부 provider trace 존재 여부',
          metrics: { providerSnapshotCount: 2 },
        },
      ],
      findings: [{ severity: 'warn', message: 'provider_trace check is partial' }],
      references: { twinBuildId: 'twin-1', validationReportId: 'val-1' },
    };
  }

  function makeQaReportPass(): MidQaReport {
    return {
      reportId: 'midqa-test',
      sceneId: 'test-scene',
      generatedAt: new Date().toISOString(),
      summary: 'PASS',
      score: { overall: 0.9, confidence: 'high' },
      checks: [
        {
          id: 'provider_trace',
          state: 'PASS',
          summary: '외부 provider trace 존재 여부',
          metrics: { providerSnapshotCount: 3 },
        },
      ],
      findings: [{ severity: 'info', message: '중간 QA에서 치명적 결함은 발견되지 않았습니다.' }],
      references: { twinBuildId: 'twin-1', validationReportId: 'val-1' },
    };
  }

  function makePersistArgs(sceneId: string, qa: MidQaReport, qualityPass: boolean) {
    const storedScene = makeStoredScene(sceneId);
    const qualityGate = makeQualityGatePass();
    return {
      sceneId,
      storedScene,
      result: {
        place: { placeId: 'test-place', displayName: 'Test', location: { lat: 37.5, lng: 126.9 } },
        meta: { generatedAt: '2026-01-01T00:00:00Z', roads: [], walkways: [], buildings: [] },
        detail: { facadeHints: [], provenance: { mapillaryUsed: false, osmTagCoverage: { coloredBuildings: 0, materialBuildings: 0 } } },
        placePackage: { placeId: 'test-place' },
        assetPath: '/tmp/test.glb',
        providerTraces: [],
      },
      qualityGate,
      twinBuild: { twin: { buildId: 'twin-1' }, validation: {} },
      qa,
      weatherSnapshot: {
        source: 'OPEN_METEO_HISTORICAL',
        updatedAt: '2026-01-01T00:00:00Z',
        preset: 'DAY_CLEAR',
        temperature: 20,
        observedAt: '2026-01-01T00:00:00Z',
      },
      weatherObserved: { observation: { date: '2026-01-01' }, upstreamEnvelopes: [] },
      trafficSnapshot: { segments: [], degraded: false, failedSegmentCount: 0, updatedAt: '2026-01-01T00:00:00Z' },
      trafficObserved: { provider: 'TOMTOM' as SceneLiveProvider, upstreamEnvelopes: [] },
      qualityPass,
      startedAt: Date.now() - 1000,
    };
  }

  async function seedScene(sceneId: string): Promise<void> {
    await repository.save(makeStoredScene(sceneId));
  }

  it('blocks READY when quality gate passes but QA summary is FAIL', async () => {
    const sceneId = 'scene-qa-fail-blocks-ready';
    await seedScene(sceneId);
    const args = makePersistArgs(sceneId, makeQaReportFail(), true);

    await resultService.persist(args);

    const stored = await repository.findById(sceneId);
    expect(stored).toBeDefined();
    expect(stored!.scene.status).toBe('FAILED');
    expect(stored!.scene.failureCategory).toBe('QA_REJECTED');
    expect(stored!.scene.failureReason).toContain('QA rejected');
    expect(stored!.scene.failureReason).toContain('provider_trace');
  });

  it('allows READY when quality gate passes and QA summary is WARN', async () => {
    const sceneId = 'scene-qa-warn-allows-ready';
    await seedScene(sceneId);
    const args = makePersistArgs(sceneId, makeQaReportWarn(), true);

    await resultService.persist(args);

    const stored = await repository.findById(sceneId);
    expect(stored).toBeDefined();
    expect(stored!.scene.status).toBe('READY');
    expect(stored!.scene.failureCategory).toBeNull();
    expect(stored!.scene.failureReason).toBeNull();
  });

  it('allows READY when quality gate passes and QA summary is PASS', async () => {
    const sceneId = 'scene-qa-pass-allows-ready';
    await seedScene(sceneId);
    const args = makePersistArgs(sceneId, makeQaReportPass(), true);

    await resultService.persist(args);

    const stored = await repository.findById(sceneId);
    expect(stored).toBeDefined();
    expect(stored!.scene.status).toBe('READY');
    expect(stored!.scene.failureCategory).toBeNull();
    expect(stored!.scene.failureReason).toBeNull();
  });

  it('blocks READY when both quality gate and QA fail', async () => {
    const sceneId = 'scene-both-fail';
    await seedScene(sceneId);
    const args = makePersistArgs(sceneId, makeQaReportFail(), false);

    await resultService.persist(args);

    const stored = await repository.findById(sceneId);
    expect(stored).toBeDefined();
    expect(stored!.scene.status).toBe('FAILED');
    // QA FAIL takes precedence for the distinct category
    expect(stored!.scene.failureCategory).toBe('QA_REJECTED');
  });

  it('blocks READY when quality gate fails but QA passes', async () => {
    const sceneId = 'scene-qg-fail-qa-pass';
    await seedScene(sceneId);
    const args = makePersistArgs(sceneId, makeQaReportPass(), false);

    await resultService.persist(args);

    const stored = await repository.findById(sceneId);
    expect(stored).toBeDefined();
    expect(stored!.scene.status).toBe('FAILED');
    expect(stored!.scene.failureCategory).toBe('QUALITY_GATE_REJECTED');
  });
});
