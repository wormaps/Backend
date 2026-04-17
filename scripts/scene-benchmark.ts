import { mkdir } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { SceneService } from '../src/scene/scene.service';
import { getSceneDataDir } from '../src/scene/storage/scene-storage.utils';
import type { SceneScale } from '../src/scene/types/scene.types';

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

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const sceneService = moduleRef.get(SceneService);
  const samples: BenchmarkSample[] = [];

  console.log(
    JSON.stringify(
      {
        query,
        scale,
        iterations,
        concurrency,
        sceneDataDir,
        note:
          'This benchmark uses the live application wiring. Configure external APIs before running it.',
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
    query,
    scale,
    iterations,
    concurrency,
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

void main().catch((error: Error) => {
  console.error(error.stack ?? error.message);
  process.exit(1);
});
