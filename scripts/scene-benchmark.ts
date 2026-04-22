import { mkdir } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { GlbBuilderService } from '../src/assets/glb-builder.service';
import { appMetrics } from '../src/common/metrics/metrics.instance';
import { GooglePlacesClient } from '../src/places/clients/google-places.client';
import { MapillaryClient } from '../src/places/clients/mapillary.client';
import { OpenMeteoClient } from '../src/places/clients/open-meteo.client';
import { OverpassClient } from '../src/places/clients/overpass.client';
import { TomTomTrafficClient } from '../src/places/clients/tomtom-traffic.client';
import { placeDetail, placePackage } from '../src/scene/scene.service.spec.fixture';
import { SceneService } from '../src/scene/scene.service';
import { getSceneDataDir, writeFileAtomically } from '../src/scene/storage/scene-storage.utils';
import {
  buildBenchmarkPlan,
  summarizeBenchmarkCase,
  summarizeBenchmarkReport,
  type BenchmarkCasePlan,
  type BenchmarkCaseResult,
  type BenchmarkSample,
} from './scene-benchmark.plan';

async function main() {
  const plan = buildBenchmarkPlan(process.env);
  const sceneDataDir = getSceneDataDir();
  await mkdir(sceneDataDir, { recursive: true });

  const moduleBuilder = Test.createTestingModule({
    imports: [AppModule],
  });

  if (plan.mode === 'stubbed') {
    moduleBuilder
      .overrideProvider(GooglePlacesClient)
      .useValue(createGooglePlacesStub())
      .overrideProvider(OverpassClient)
      .useValue(createOverpassStub())
      .overrideProvider(MapillaryClient)
      .useValue(createMapillaryStub())
      .overrideProvider(OpenMeteoClient)
      .useValue(createOpenMeteoStub())
      .overrideProvider(TomTomTrafficClient)
      .useValue(createTomTomTrafficStub());
  }

  const moduleRef = await moduleBuilder.compile();
  const sceneService = moduleRef.get(SceneService);
  const glbBuilderService = moduleRef.get(GlbBuilderService);
  const caseResults: BenchmarkCaseResult[] = [];

  console.log(
    JSON.stringify(
      {
        mode: plan.mode,
        profile: plan.profile,
        outputPath: plan.outputPath,
        sceneDataDir: plan.sceneDataDir,
        concurrencyLimit: plan.concurrencyLimit,
        cases: plan.cases,
        note:
          plan.mode === 'live'
            ? 'Live mode uses external APIs and may fail if credentials or network are unavailable.'
            : 'Stubbed mode uses fixed fixtures to measure the internal generation path.',
      },
      null,
      2,
    ),
  );

  for (const benchmarkCase of plan.cases) {
    caseResults.push(await runBenchmarkCase(sceneService, benchmarkCase));
  }

  const report = summarizeBenchmarkReport({
    plan,
    caseResults,
    metricsSnapshot: appMetrics.snapshot(),
  });

  await writeFileAtomically(plan.outputPath, JSON.stringify(report, null, 2), 'utf8');

  console.log(
    JSON.stringify(
      {
        mode: plan.mode,
        profile: plan.profile,
        glbBuilder: {
          provider: glbBuilderService.constructor.name,
        },
        caseCount: caseResults.length,
        reportPath: plan.outputPath,
        statusCounts: report.statusCounts,
        metricsSnapshot: report.metricsSnapshot,
        aggregate: report.aggregate,
        cases: caseResults.map((result) => ({
          query: result.fixture.query,
          scale: result.fixture.scale,
          iterations: result.fixture.iterations,
          requestedConcurrency: result.fixture.requestedConcurrency,
          effectiveConcurrency: result.fixture.concurrency,
          aggregate: result.aggregate,
          concurrentBatch: result.concurrentBatch,
        })),
      },
      null,
      2,
    ),
  );
}

async function runBenchmarkCase(
  sceneService: SceneService,
  benchmarkCase: BenchmarkCasePlan,
): Promise<BenchmarkCaseResult> {
  const samples: BenchmarkSample[] = [];

  for (let iteration = 0; iteration < benchmarkCase.iterations; iteration += 1) {
    const startedAt = performance.now();
    const createStartedAt = performance.now();
    const created = await sceneService.createScene(
      benchmarkCase.query,
      benchmarkCase.scale,
      {
        forceRegenerate: true,
        source: 'smoke',
        requestId: `scene_bench_${Date.now().toString(36)}_${iteration}`,
      },
    );
    const createSceneMs = performance.now() - createStartedAt;

    const waitStartedAt = performance.now();
    await sceneService.waitForIdle();
    const waitForIdleMs = performance.now() - waitStartedAt;
    const totalMs = performance.now() - startedAt;
    const finished = await sceneService.getScene(created.sceneId);
    if (finished.status !== 'READY') {
      console.warn(
        JSON.stringify(
          {
            sceneId: finished.sceneId,
            status: finished.status,
            failureReason: finished.failureReason ?? null,
            failureCategory: finished.failureCategory ?? null,
          },
          null,
          2,
        ),
      );
    }

    samples.push({
      sceneId: created.sceneId,
      createSceneMs,
      waitForIdleMs,
      totalMs,
      rssMb: roundMb(process.memoryUsage().rss),
      heapUsedMb: roundMb(process.memoryUsage().heapUsed),
      status: finished.status,
      failureReason: finished.failureReason ?? null,
      failureCategory: finished.failureCategory ?? null,
    });
  }

  let concurrentBatch: BenchmarkCaseResult['concurrentBatch'];
  if (benchmarkCase.concurrency > 1) {
    const concurrentStartedAt = performance.now();
    const results = await Promise.all(
      Array.from({ length: benchmarkCase.concurrency }, (_value, index) =>
        sceneService.createScene(benchmarkCase.query, benchmarkCase.scale, {
          forceRegenerate: true,
          source: 'smoke',
          requestId: `scene_bench_concurrent_${Date.now().toString(36)}_${index}`,
        }),
      ),
    );
    await sceneService.waitForIdle();
    concurrentBatch = {
      requested: benchmarkCase.requestedConcurrency,
      effective: benchmarkCase.concurrency,
      uniqueSceneIds: new Set(results.map((item) => item.sceneId)).size,
      totalMs: performance.now() - concurrentStartedAt,
    };
  }

  return summarizeBenchmarkCase(benchmarkCase, samples, concurrentBatch);
}

function roundMb(value: number): number {
  return Number((value / (1024 * 1024)).toFixed(2));
}

function createGooglePlacesStub() {
  const envelope = {
    provider: 'Google Places',
    requestedAt: new Date().toISOString(),
    receivedAt: new Date().toISOString(),
    url: 'stub://google-places',
    method: 'POST',
    request: {},
    response: { status: 200, body: {} },
  };
  return {
    searchText: async () => [placeDetail],
    getPlaceDetail: async () => placeDetail,
    searchTextWithEnvelope: async () => ({
      items: [placeDetail],
      envelope,
    }),
    getPlaceDetailWithEnvelope: async () => ({
      place: placeDetail,
      envelope,
    }),
  };
}

function createOverpassStub() {
  const upstreamEnvelope = {
    provider: 'Overpass',
    requestedAt: new Date().toISOString(),
    receivedAt: new Date().toISOString(),
    url: 'stub://overpass',
    method: 'POST',
    request: {},
    response: { status: 200, body: {} },
  };
  return {
    buildPlacePackage: async () => placePackage,
    buildPlacePackageWithTrace: async () => ({
      placePackage,
      upstreamEnvelopes: [upstreamEnvelope],
    }),
  };
}

function createMapillaryStub() {
  return {
    isConfigured: () => false,
    getMapFeaturesWithEnvelope: async () => ({
      features: [],
      upstreamEnvelopes: [],
    }),
    getNearbyImagesWithDiagnostics: async () => ({
      images: [],
      diagnostics: {
        strategy: 'none',
        attempts: [],
      },
      upstreamEnvelopes: [],
    }),
  };
}

function createOpenMeteoStub() {
  return {
    getObservation: async () => null,
    getHistoricalObservation: async () => null,
    getObservationWithEnvelope: async () => ({
      observation: null,
      upstreamEnvelopes: [],
    }),
  };
}

function createTomTomTrafficStub() {
  return {
    getFlowSegment: async () => null,
    getFlowSegmentWithEnvelope: async () => ({
      data: null,
      upstreamEnvelopes: [],
    }),
  };
}

if (process.argv[1]?.endsWith('scene-benchmark.ts')) {
  void main().catch((error: Error) => {
    console.error(error.stack ?? error.message);
    process.exit(1);
  });
}
