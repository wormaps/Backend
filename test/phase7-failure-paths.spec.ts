import { afterEach, beforeEach, describe, expect, it, vi } from 'bun:test';
import { Test, type TestingModule } from '@nestjs/testing';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { AppLoggerService } from '../src/common/logging/app-logger.service';
import { SceneFailureHandlerService } from '../src/scene/services/generation/scene-failure-handler.service';
import { SceneGenerationResultService } from '../src/scene/services/generation/scene-generation-result.service';
import { SceneQueueManagerService } from '../src/scene/services/generation/scene-queue-manager.service';
import { SceneSnapshotService } from '../src/scene/services/generation/scene-snapshot.service';
import { SceneRepository } from '../src/scene/storage/scene.repository';
import {
  parseSceneJson,
  SceneCorruptionError,
  tryAcquireSceneGenerationLock,
} from '../src/scene/storage/scene-storage.utils';
import type {
  MidQaReport,
  SceneQualityGateResult,
  StoredScene,
} from '../src/scene/types/scene.types';

const TEST_DATA_DIR = join(process.cwd(), 'data', 'scene', '.spec-temp-phase7');

function makeStoredScene(sceneId: string, attempts = 0): StoredScene {
  return {
    requestKey: `req-${sceneId}`,
    requestId: `req-${sceneId}`,
    attempts,
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

function makeQualityGateFailure(): SceneQualityGateResult {
  return {
    version: 'qg.v1',
    state: 'FAIL',
    reasonCodes: ['COVERAGE_GAP_PRESENT'],
    scores: {
      overall: 0.2,
      breakdown: {
        structure: 0.2,
        atmosphere: 0.2,
        placeReadability: 0.2,
      },
      modeDeltaOverallScore: -0.1,
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
      totalMeshNodeCount: 0,
      totalSkipped: 0,
      polygonBudgetExceededCount: 0,
      criticalPolygonBudgetExceededCount: 0,
      emptyOrInvalidGeometryCount: 0,
      criticalEmptyOrInvalidGeometryCount: 0,
      selectionCutCount: 0,
      missingSourceCount: 0,
      triangulationFallbackCount: 0,
    },
    artifactRefs: {
      diagnosticsLogPath: '/tmp/diagnostics.log',
      modeComparisonPath: '/tmp/mode-comparison.json',
    },
    oracleApproval: { required: false, state: 'NOT_REQUIRED', source: 'auto' },
    decidedAt: '2026-01-01T00:00:00.000Z',
  };
}

function makeQaReport(summary: MidQaReport['summary']): MidQaReport {
  return {
    reportId: 'midqa-phase7',
    sceneId: 'scene-phase7',
    generatedAt: new Date().toISOString(),
    summary,
    score: { overall: summary === 'FAIL' ? 0.3 : 0.9, confidence: summary === 'FAIL' ? 'low' : 'high' },
    checks: [
      {
        id: 'provider_trace',
        state: summary,
        summary: '외부 provider trace 존재 여부',
        metrics: { providerSnapshotCount: summary === 'FAIL' ? 0 : 3 },
      },
    ],
    findings: [{ severity: summary === 'FAIL' ? 'error' : 'info', message: 'phase7 qa mock' }],
    references: { twinBuildId: 'twin-1', validationReportId: 'val-1' },
  };
}

describe('Phase 7 failure-path regression tests', () => {
  let repository: SceneRepository;
  let failureHandler: SceneFailureHandlerService;
  let resultService: SceneGenerationResultService;
  let module: TestingModule;
  const originalSceneDataDir = process.env.SCENE_DATA_DIR;

  beforeEach(async () => {
    await rm(TEST_DATA_DIR, { recursive: true, force: true });
    await mkdir(TEST_DATA_DIR, { recursive: true });
    process.env.SCENE_DATA_DIR = TEST_DATA_DIR;

    const queueManager = {
      enqueue: vi.fn(),
      recordFailure: vi.fn(),
      isShuttingDownFlag: false,
      waitForIdle: vi.fn().mockResolvedValue(undefined),
      flushSnapshot: vi.fn().mockResolvedValue(undefined),
    };

    module = await Test.createTestingModule({
      providers: [
        SceneRepository,
        SceneFailureHandlerService,
        SceneGenerationResultService,
        {
          provide: AppLoggerService,
          useValue: {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            fromRequest: vi.fn(),
          },
        },
        {
          provide: 'SceneQueueManagerService',
          useValue: queueManager,
        },
        {
          provide: SceneQueueManagerService,
          useValue: queueManager,
        },
        {
          provide: 'SceneSnapshotService',
          useValue: {
            toWeatherType: vi.fn().mockReturnValue('CLEAR'),
          },
        },
        {
          provide: SceneSnapshotService,
          useValue: {
            toWeatherType: vi.fn().mockReturnValue('CLEAR'),
          },
        },
      ],
    }).compile();

    repository = module.get(SceneRepository);
    failureHandler = module.get(SceneFailureHandlerService);
    resultService = module.get(SceneGenerationResultService);
    await repository.clear();
  });

  afterEach(async () => {
    await rm(TEST_DATA_DIR, { recursive: true, force: true });
    delete process.env.SCENE_DATA_DIR;
  });

  it('classifies malformed JSON as parse-failure', () => {
    expect(() => parseSceneJson('{ bad json', 'phase7')).toThrow(SceneCorruptionError);
    try {
      parseSceneJson('{ bad json', 'phase7');
    } catch (error) {
      expect((error as SceneCorruptionError).kind).toBe('parse-failure');
    }
  });

  it('reclaims a stale generation lock', async () => {
    const sceneId = 'phase7-stale-lock';
    const lockPath = join(TEST_DATA_DIR, `${sceneId}.generation.lock`);
    await mkdir(TEST_DATA_DIR, { recursive: true });
    await writeFile(
      lockPath,
      JSON.stringify({
        sceneId,
        ownerId: 'stale-owner',
        acquiredAt: '2020-01-01T00:00:00.000Z',
      }),
      'utf8',
    );

    const acquired = await tryAcquireSceneGenerationLock(sceneId, 'fresh-owner', 1);
    expect(acquired).toBe(true);

    const lock = JSON.parse(await Bun.file(lockPath).text()) as { ownerId: string };
    expect(lock.ownerId).toBe('fresh-owner');
  });

  it('retries transient generation failures once', async () => {
    const sceneId = 'phase7-retry-scene';
    const storedScene = makeStoredScene(sceneId);
    await repository.save(storedScene);

    await failureHandler.handleGenerationFailure(sceneId, storedScene, new Error('temporary failure'));

    const updated = await repository.findById(sceneId);
    expect(updated).toBeDefined();
    expect(updated!.scene.status).toBe('PENDING');
    expect(updated!.attempts).toBe(1);
  });

  it('blocks quality gate failures without retrying', async () => {
    const sceneId = 'phase7-gate-fail-scene';
    const storedScene = makeStoredScene(sceneId);
    await repository.save(storedScene);

    const error = Object.assign(new Error('quality gate rejected'), {
      qualityGate: makeQualityGateFailure(),
    });

    await failureHandler.handleGenerationFailure(sceneId, storedScene, error);

    const updated = await repository.findById(sceneId);
    expect(updated).toBeDefined();
    expect(updated!.scene.status).toBe('FAILED');
    expect(updated!.scene.failureCategory).toBe('QUALITY_GATE_REJECTED');
    expect(updated!.scene.failureReason).toContain('quality gate');
  });

  it('marks QA fail as FAILED in persistence even when quality gate passes', async () => {
    const sceneId = 'phase7-qa-fail-scene';
    const storedScene = makeStoredScene(sceneId);
    await repository.save(storedScene);

    await resultService.persist({
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
      qualityGate: makeQualityGateFailure(),
      twinBuild: { twin: { buildId: 'twin-1' }, validation: {} },
      qa: makeQaReport('FAIL'),
      weatherSnapshot: {
        source: 'OPEN_METEO_HISTORICAL',
        updatedAt: '2026-01-01T00:00:00Z',
        preset: 'DAY_CLEAR',
        temperature: 20,
        observedAt: '2026-01-01T00:00:00Z',
      },
      weatherObserved: { observation: { date: '2026-01-01' }, upstreamEnvelopes: [] },
      trafficSnapshot: { segments: [], degraded: false, failedSegmentCount: 0, updatedAt: '2026-01-01T00:00:00Z' },
      trafficObserved: { provider: 'TOMTOM', upstreamEnvelopes: [] },
      qualityPass: true,
      startedAt: Date.now() - 1000,
    } as any);

    const updated = await repository.findById(sceneId);
    expect(updated).toBeDefined();
    expect(updated!.scene.status).toBe('FAILED');
    expect(updated!.scene.failureCategory).toBe('QA_REJECTED');
  });
});
