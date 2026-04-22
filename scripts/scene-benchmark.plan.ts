import { join } from 'node:path';
import { getSceneDataDir } from '../src/scene/storage/scene-storage.utils';
import type { SceneScale } from '../src/scene/types/scene.types';

export type BenchmarkMode = 'stubbed' | 'live';
export type BenchmarkProfile = 'single' | 'phase6-load';

export interface BenchmarkCaseFixture {
  query: string;
  scale: SceneScale;
  iterations: number;
  requestedConcurrency: number;
}

export interface BenchmarkCasePlan extends BenchmarkCaseFixture {
  concurrency: number;
}

export interface BenchmarkPlan {
  mode: BenchmarkMode;
  profile: BenchmarkProfile;
  sceneDataDir: string;
  outputPath: string;
  concurrencyLimit: number;
  cases: BenchmarkCasePlan[];
}

export interface BenchmarkSample {
  sceneId: string;
  createSceneMs: number;
  waitForIdleMs: number;
  totalMs: number;
  rssMb: number;
  heapUsedMb: number;
  status: string;
  failureReason?: string | null;
  failureCategory?: string | null;
}

export interface BenchmarkCaseResult {
  fixture: BenchmarkCasePlan;
  samples: BenchmarkSample[];
  concurrentBatch?: {
    requested: number;
    effective: number;
    uniqueSceneIds: number;
    totalMs: number;
  };
  aggregate: BenchmarkAggregate;
}

export interface BenchmarkAggregate {
  min: number;
  max: number;
  avg: number;
}

export interface BenchmarkReport {
  generatedAt: string;
  mode: BenchmarkMode;
  profile: BenchmarkProfile;
  sceneDataDir: string;
  outputPath: string;
  concurrencyLimit: number;
  statusCounts: {
    ready: number;
    failed: number;
    pending: number;
    other: number;
  };
  cases: BenchmarkCaseResult[];
  aggregate: {
    createSceneMs: BenchmarkAggregate;
    waitForIdleMs: BenchmarkAggregate;
    totalMs: BenchmarkAggregate;
    rssMb: BenchmarkAggregate;
    heapUsedMb: BenchmarkAggregate;
  };
  metricsSnapshot: Record<string, unknown>;
}

export const PHASE6_LOAD_FIXTURE: BenchmarkCaseFixture[] = [
  {
    query: 'Seoul City Hall',
    scale: 'MEDIUM',
    iterations: 2,
    requestedConcurrency: 2,
  },
  {
    query: 'Shibuya Scramble Crossing, Tokyo',
    scale: 'MEDIUM',
    iterations: 1,
    requestedConcurrency: 3,
  },
  {
    query: 'Akihabara, Tokyo',
    scale: 'LARGE',
    iterations: 1,
    requestedConcurrency: 2,
  },
];

export function buildBenchmarkPlan(env: NodeJS.ProcessEnv, cwd = process.cwd()): BenchmarkPlan {
  const mode = parseBenchmarkMode(env.SCENE_BENCH_MODE?.trim() || 'stubbed');
  const profile = parseBenchmarkProfile(env.SCENE_BENCH_PROFILE?.trim() || 'single');
  const sceneDataDir = getSceneDataDir();
  const outputPath = resolveBenchmarkOutputPath(
    env.SCENE_BENCH_OUTPUT_PATH?.trim() || '',
    cwd,
  );
  const concurrencyLimit = parsePositiveInteger(
    env.SCENE_BENCH_CONCURRENCY_LIMIT?.trim() || '4',
    1,
  );

  return {
    mode,
    profile,
    sceneDataDir,
    outputPath,
    concurrencyLimit,
    cases:
      profile === 'phase6-load'
        ? PHASE6_LOAD_FIXTURE.map((fixture) => ({
            ...fixture,
            concurrency: Math.min(fixture.requestedConcurrency, concurrencyLimit),
          }))
        : [
            {
              query: env.SCENE_BENCH_QUERY?.trim() || 'Seoul City Hall',
              scale: parseSceneScale(env.SCENE_BENCH_SCALE?.trim() || 'MEDIUM'),
              iterations: parsePositiveInteger(
                env.SCENE_BENCH_ITERATIONS?.trim() || '1',
                1,
              ),
              requestedConcurrency: parsePositiveInteger(
                env.SCENE_BENCH_CONCURRENCY?.trim() || '1',
                1,
              ),
              concurrency: Math.min(
                parsePositiveInteger(env.SCENE_BENCH_CONCURRENCY?.trim() || '1', 1),
                concurrencyLimit,
              ),
            },
          ],
  };
}

export function resolveBenchmarkOutputPath(
  rawOutputPath: string,
  cwd = process.cwd(),
): string {
  const normalized = rawOutputPath.trim();
  if (normalized.length > 0) {
    return normalized;
  }
  return join(cwd, 'data', 'benchmark', 'scene-benchmark-report.json');
}

export function summarizeBenchmarkCase(
  fixture: BenchmarkCasePlan,
  samples: BenchmarkSample[],
  concurrentBatch?: BenchmarkCaseResult['concurrentBatch'],
): BenchmarkCaseResult {
  return {
    fixture,
    samples,
    concurrentBatch,
    aggregate: aggregateSamples(samples),
  };
}

export function summarizeBenchmarkReport(args: {
  plan: BenchmarkPlan;
  caseResults: BenchmarkCaseResult[];
  metricsSnapshot: Record<string, unknown>;
  generatedAt?: string;
}): BenchmarkReport {
  const allSamples = args.caseResults.flatMap((result) => result.samples);
  const statusCounts = allSamples.reduce(
    (counts, sample) => {
      if (sample.status === 'READY') {
        counts.ready += 1;
      } else if (sample.status === 'FAILED') {
        counts.failed += 1;
      } else if (sample.status === 'PENDING') {
        counts.pending += 1;
      } else {
        counts.other += 1;
      }
      return counts;
    },
    {
      ready: 0,
      failed: 0,
      pending: 0,
      other: 0,
    },
  );
  return {
    generatedAt: args.generatedAt ?? new Date().toISOString(),
    mode: args.plan.mode,
    profile: args.plan.profile,
    sceneDataDir: args.plan.sceneDataDir,
    outputPath: args.plan.outputPath,
    concurrencyLimit: args.plan.concurrencyLimit,
    statusCounts,
    cases: args.caseResults,
    aggregate: {
      createSceneMs: aggregateNumbers(
        allSamples.map((sample) => sample.createSceneMs),
      ),
      waitForIdleMs: aggregateNumbers(
        allSamples.map((sample) => sample.waitForIdleMs),
      ),
      totalMs: aggregateNumbers(allSamples.map((sample) => sample.totalMs)),
      rssMb: aggregateNumbers(allSamples.map((sample) => sample.rssMb)),
      heapUsedMb: aggregateNumbers(allSamples.map((sample) => sample.heapUsedMb)),
    },
    metricsSnapshot: args.metricsSnapshot,
  };
}

export function aggregateSamples(samples: BenchmarkSample[]): BenchmarkAggregate {
  return aggregateNumbers(samples.map((sample) => sample.totalMs));
}

export function parseBenchmarkMode(input: string): BenchmarkMode {
  const normalized = input.toLowerCase();
  if (normalized === 'live' || normalized === 'stubbed') {
    return normalized;
  }
  throw new Error('Invalid SCENE_BENCH_MODE. Expected live or stubbed.');
}

export function parseBenchmarkProfile(input: string): BenchmarkProfile {
  const normalized = input.toLowerCase();
  if (normalized === 'single' || normalized === 'phase6-load') {
    return normalized;
  }
  throw new Error(
    'Invalid SCENE_BENCH_PROFILE. Expected single or phase6-load.',
  );
}

export function parseSceneScale(input: string): SceneScale {
  const allowed: SceneScale[] = ['SMALL', 'MEDIUM', 'LARGE'];
  const normalized = input.toUpperCase();
  if (allowed.includes(normalized as SceneScale)) {
    return normalized as SceneScale;
  }
  throw new Error(
    `Invalid SCENE_BENCH_SCALE=${input}. Expected one of ${allowed.join(', ')}.`,
  );
}

export function parsePositiveInteger(input: string, fallback: number): number {
  const value = Number.parseInt(input, 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function aggregateNumbers(values: number[]): BenchmarkAggregate {
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
