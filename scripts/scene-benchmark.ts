import { mkdir } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { GlbBuilderService } from '../src/assets/glb-builder.service';
import { GooglePlacesClient } from '../src/places/clients/google-places.client';
import { MapillaryClient } from '../src/places/clients/mapillary.client';
import { OpenMeteoClient } from '../src/places/clients/open-meteo.client';
import { OverpassClient } from '../src/places/clients/overpass.client';
import { TomTomTrafficClient } from '../src/places/clients/tomtom-traffic.client';
import { placeDetail, placePackage } from '../src/scene/scene.service.spec.fixture';
import { SceneService } from '../src/scene/scene.service';
import { getSceneDataDir } from '../src/scene/storage/scene-storage.utils';
import type { SceneScale } from '../src/scene/types/scene.types';

type BenchmarkMode = 'stubbed' | 'live';

interface BenchmarkSample {
  sceneId: string;
  createSceneMs: number;
  waitForIdleMs: number;
  totalMs: number;
  rssMb: number;
  heapUsedMb: number;
  status: string;
}

async function main() {
  const mode = parseBenchmarkMode(process.env.SCENE_BENCH_MODE?.trim() || 'stubbed');
  const query = process.env.SCENE_BENCH_QUERY?.trim() || 'Seoul City Hall';
  const scale = parseSceneScale(process.env.SCENE_BENCH_SCALE?.trim() || 'MEDIUM');
  const iterations = parsePositiveInteger(
    process.env.SCENE_BENCH_ITERATIONS?.trim() || '1',
    1,
  );
  const concurrency = parsePositiveInteger(
    process.env.SCENE_BENCH_CONCURRENCY?.trim() || '1',
    1,
  );

  const sceneDataDir = getSceneDataDir();
  await mkdir(sceneDataDir, { recursive: true });

  const moduleBuilder = Test.createTestingModule({
    imports: [AppModule],
  });

  if (mode === 'stubbed') {
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
  const samples: BenchmarkSample[] = [];

  console.log(
    JSON.stringify(
      {
        mode,
        query,
        scale,
        iterations,
        concurrency,
        sceneDataDir,
        note:
          mode === 'live'
            ? 'Live mode uses external APIs and may fail if credentials or network are unavailable.'
            : 'Stubbed mode uses fixed fixtures to measure the internal generation path.',
      },
      null,
      2,
    ),
  );

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const startedAt = performance.now();
    const createStartedAt = performance.now();
    const created = await sceneService.createScene(query, scale, {
      forceRegenerate: true,
      source: 'smoke',
      requestId: `scene_bench_${Date.now().toString(36)}_${iteration}`,
    });
    const createSceneMs = performance.now() - createStartedAt;

    const waitStartedAt = performance.now();
    await sceneService.waitForIdle();
    const waitForIdleMs = performance.now() - waitStartedAt;
    const totalMs = performance.now() - startedAt;

    samples.push({
      sceneId: created.sceneId,
      createSceneMs,
      waitForIdleMs,
      totalMs,
      rssMb: roundMb(process.memoryUsage().rss),
      heapUsedMb: roundMb(process.memoryUsage().heapUsed),
      status: created.status,
    });
  }

  if (concurrency > 1) {
    const concurrentStartedAt = performance.now();
    const results = await Promise.all(
      Array.from({ length: concurrency }, (_value, index) =>
        sceneService.createScene(query, scale, {
          forceRegenerate: true,
          source: 'smoke',
          requestId: `scene_bench_concurrent_${Date.now().toString(36)}_${index}`,
        }),
      ),
    );
    await sceneService.waitForIdle();
    const concurrentTotalMs = performance.now() - concurrentStartedAt;
    console.log(
      JSON.stringify(
        {
          concurrentBatch: {
            requested: concurrency,
            uniqueSceneIds: new Set(results.map((item) => item.sceneId)).size,
            totalMs: concurrentTotalMs,
          },
        },
        null,
        2,
      ),
    );
  }

  const summary = {
    mode,
    query,
    scale,
    iterations,
    concurrency,
    glbBuilder: {
      provider: glbBuilderService.constructor.name,
    },
    samples,
    aggregate: {
      createSceneMs: aggregate(samples.map((sample) => sample.createSceneMs)),
      waitForIdleMs: aggregate(samples.map((sample) => sample.waitForIdleMs)),
      totalMs: aggregate(samples.map((sample) => sample.totalMs)),
      rssMb: aggregate(samples.map((sample) => sample.rssMb)),
      heapUsedMb: aggregate(samples.map((sample) => sample.heapUsedMb)),
    },
  };

  console.log(JSON.stringify(summary, null, 2));
}

function parseBenchmarkMode(input: string): BenchmarkMode {
  const normalized = input.toLowerCase();
  if (normalized === 'live' || normalized === 'stubbed') {
    return normalized;
  }
  throw new Error('Invalid SCENE_BENCH_MODE. Expected live or stubbed.');
}

function parseSceneScale(input: string): SceneScale {
  const allowed: SceneScale[] = ['SMALL', 'MEDIUM', 'LARGE'];
  const normalized = input.toUpperCase();
  if (allowed.includes(normalized as SceneScale)) {
    return normalized as SceneScale;
  }
  throw new Error(
    `Invalid SCENE_BENCH_SCALE=${input}. Expected one of ${allowed.join(', ')}.`,
  );
}

function parsePositiveInteger(input: string, fallback: number): number {
  const value = Number.parseInt(input, 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function roundMb(value: number): number {
  return Number((value / (1024 * 1024)).toFixed(2));
}

function aggregate(values: number[]): {
  min: number;
  max: number;
  avg: number;
} {
  if (values.length === 0) {
    return { min: 0, max: 0, avg: 0 };
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const avg = values.reduce((sum, current) => sum + current, 0) / values.length;
  return {
    min: Number(min.toFixed(2)),
    max: Number(max.toFixed(2)),
    avg: Number(avg.toFixed(2)),
  };
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

void main().catch((error: Error) => {
  console.error(error.stack ?? error.message);
  process.exit(1);
});
