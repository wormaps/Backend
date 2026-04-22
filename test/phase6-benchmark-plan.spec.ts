import { describe, expect, it } from 'bun:test';
import {
  aggregateNumbers,
  buildBenchmarkPlan,
  parseBenchmarkMode,
  parseBenchmarkProfile,
  parseSceneScale,
  PHASE6_LOAD_FIXTURE,
  resolveBenchmarkOutputPath,
  summarizeBenchmarkCase,
  summarizeBenchmarkReport,
} from '../scripts/scene-benchmark.plan';

describe('Phase 6 benchmark plan', () => {
  it('expands the phase6 load fixture and clamps concurrency', () => {
    const plan = buildBenchmarkPlan({
      SCENE_BENCH_MODE: 'stubbed',
      SCENE_BENCH_PROFILE: 'phase6-load',
      SCENE_BENCH_CONCURRENCY_LIMIT: '2',
    } as NodeJS.ProcessEnv);

    expect(plan.profile).toBe('phase6-load');
    expect(plan.cases).toHaveLength(3);
    expect(plan.cases.map((item) => item.concurrency)).toEqual([2, 2, 2]);
    expect(plan.cases.map((item) => item.requestedConcurrency)).toEqual([2, 3, 2]);
  });

  it('builds a single-case plan from explicit env values', () => {
    const plan = buildBenchmarkPlan({
      SCENE_BENCH_MODE: 'live',
      SCENE_BENCH_PROFILE: 'single',
      SCENE_BENCH_QUERY: 'Tokyo Station',
      SCENE_BENCH_SCALE: 'LARGE',
      SCENE_BENCH_ITERATIONS: '3',
      SCENE_BENCH_CONCURRENCY: '4',
      SCENE_BENCH_CONCURRENCY_LIMIT: '8',
      SCENE_BENCH_OUTPUT_PATH: '/tmp/scene-benchmark.json',
    } as NodeJS.ProcessEnv);

    expect(plan.mode).toBe('live');
    expect(plan.profile).toBe('single');
    expect(plan.cases).toEqual([
      {
        query: 'Tokyo Station',
        scale: 'LARGE',
        iterations: 3,
        requestedConcurrency: 4,
        concurrency: 4,
      },
    ]);
    expect(plan.outputPath).toBe('/tmp/scene-benchmark.json');
  });

  it('summarizes a benchmark report with aggregated metrics', () => {
    const plan = buildBenchmarkPlan({
      SCENE_BENCH_PROFILE: 'single',
      SCENE_BENCH_OUTPUT_PATH: '',
    } as NodeJS.ProcessEnv);
    const caseResult = summarizeBenchmarkCase(plan.cases[0]!, [
      {
        sceneId: 'scene-1',
        createSceneMs: 10,
        waitForIdleMs: 20,
        totalMs: 30,
        rssMb: 100,
        heapUsedMb: 50,
        status: 'READY',
      },
      {
        sceneId: 'scene-2',
        createSceneMs: 20,
        waitForIdleMs: 30,
        totalMs: 50,
        rssMb: 110,
        heapUsedMb: 55,
        status: 'READY',
      },
    ]);

    const report = summarizeBenchmarkReport({
      plan,
      caseResults: [caseResult],
      metricsSnapshot: { scene_queue_depth: [{ labels: {}, value: 0 }] },
      generatedAt: '2026-04-22T00:00:00.000Z',
    });

    expect(report.generatedAt).toBe('2026-04-22T00:00:00.000Z');
    expect(report.aggregate.totalMs).toEqual({ min: 30, max: 50, avg: 40 });
    expect(report.metricsSnapshot).toEqual({
      scene_queue_depth: [{ labels: {}, value: 0 }],
    });
  });

  it('falls back to the default benchmark output path', () => {
    const outputPath = resolveBenchmarkOutputPath('', '/workspace/repo');
    expect(outputPath).toBe('/workspace/repo/data/benchmark/scene-benchmark-report.json');
  });

  it('counts statusCounts correctly with mixed sample statuses', () => {
    const plan = buildBenchmarkPlan({
      SCENE_BENCH_PROFILE: 'single',
    } as NodeJS.ProcessEnv);
    const caseResult = summarizeBenchmarkCase(plan.cases[0]!, [
      {
        sceneId: 's1',
        createSceneMs: 10,
        waitForIdleMs: 20,
        totalMs: 30,
        rssMb: 100,
        heapUsedMb: 50,
        status: 'READY',
      },
      {
        sceneId: 's2',
        createSceneMs: 15,
        waitForIdleMs: 25,
        totalMs: 40,
        rssMb: 105,
        heapUsedMb: 52,
        status: 'FAILED',
        failureReason: 'timeout',
        failureCategory: 'timeout',
      },
      {
        sceneId: 's3',
        createSceneMs: 5,
        waitForIdleMs: 10,
        totalMs: 15,
        rssMb: 98,
        heapUsedMb: 48,
        status: 'PENDING',
      },
      {
        sceneId: 's4',
        createSceneMs: 8,
        waitForIdleMs: 12,
        totalMs: 20,
        rssMb: 99,
        heapUsedMb: 49,
        status: 'BUILDING',
      },
    ]);

    const report = summarizeBenchmarkReport({
      plan,
      caseResults: [caseResult],
      metricsSnapshot: {},
    });

    expect(report.statusCounts).toEqual({
      ready: 1,
      failed: 1,
      pending: 1,
      other: 1,
    });
  });

  it('produces zero statusCounts when no samples exist', () => {
    const plan = buildBenchmarkPlan({
      SCENE_BENCH_PROFILE: 'single',
    } as NodeJS.ProcessEnv);
    const caseResult = summarizeBenchmarkCase(plan.cases[0]!, []);

    const report = summarizeBenchmarkReport({
      plan,
      caseResults: [caseResult],
      metricsSnapshot: {},
    });

    expect(report.statusCounts).toEqual({
      ready: 0,
      failed: 0,
      pending: 0,
      other: 0,
    });
  });

  it('includes concurrentBatch in case result when provided', () => {
    const plan = buildBenchmarkPlan({
      SCENE_BENCH_PROFILE: 'single',
    } as NodeJS.ProcessEnv);
    const caseResult = summarizeBenchmarkCase(plan.cases[0]!, [
      {
        sceneId: 's1',
        createSceneMs: 10,
        waitForIdleMs: 20,
        totalMs: 30,
        rssMb: 100,
        heapUsedMb: 50,
        status: 'READY',
      },
    ], {
      requested: 3,
      effective: 2,
      uniqueSceneIds: 2,
      totalMs: 45,
    });

    expect(caseResult.concurrentBatch).toEqual({
      requested: 3,
      effective: 2,
      uniqueSceneIds: 2,
      totalMs: 45,
    });
  });

  it('verifies full report shape matches BenchmarkReport contract', () => {
    const plan = buildBenchmarkPlan({
      SCENE_BENCH_PROFILE: 'single',
      SCENE_BENCH_OUTPUT_PATH: '/tmp/test-report.json',
    } as NodeJS.ProcessEnv);
    const caseResult = summarizeBenchmarkCase(plan.cases[0]!, [
      {
        sceneId: 's1',
        createSceneMs: 10,
        waitForIdleMs: 20,
        totalMs: 30,
        rssMb: 100,
        heapUsedMb: 50,
        status: 'READY',
      },
    ]);

    const report = summarizeBenchmarkReport({
      plan,
      caseResults: [caseResult],
      metricsSnapshot: { scene_queue_depth: [{ labels: {}, value: 0 }] },
      generatedAt: '2026-04-22T00:00:00.000Z',
    });

    // Verify all required top-level fields
    expect(report).toHaveProperty('generatedAt');
    expect(report).toHaveProperty('mode');
    expect(report).toHaveProperty('profile');
    expect(report).toHaveProperty('sceneDataDir');
    expect(report).toHaveProperty('outputPath');
    expect(report).toHaveProperty('concurrencyLimit');
    expect(report).toHaveProperty('statusCounts');
    expect(report).toHaveProperty('cases');
    expect(report).toHaveProperty('aggregate');
    expect(report).toHaveProperty('metricsSnapshot');

    // Verify aggregate sub-fields
    expect(report.aggregate).toHaveProperty('createSceneMs');
    expect(report.aggregate).toHaveProperty('waitForIdleMs');
    expect(report.aggregate).toHaveProperty('totalMs');
    expect(report.aggregate).toHaveProperty('rssMb');
    expect(report.aggregate).toHaveProperty('heapUsedMb');

    // Verify each aggregate has min/max/avg
    for (const key of ['createSceneMs', 'waitForIdleMs', 'totalMs', 'rssMb', 'heapUsedMb'] as const) {
      expect(report.aggregate[key]).toHaveProperty('min');
      expect(report.aggregate[key]).toHaveProperty('max');
      expect(report.aggregate[key]).toHaveProperty('avg');
    }

    // Verify statusCounts sub-fields
    expect(report.statusCounts).toHaveProperty('ready');
    expect(report.statusCounts).toHaveProperty('failed');
    expect(report.statusCounts).toHaveProperty('pending');
    expect(report.statusCounts).toHaveProperty('other');
  });
});

describe('Phase 6 load fixture constants', () => {
  it('defines exactly 3 fixture cases', () => {
    expect(PHASE6_LOAD_FIXTURE).toHaveLength(3);
  });

  it('uses Seoul City Hall as the first fixture', () => {
    expect(PHASE6_LOAD_FIXTURE[0]).toMatchObject({
      query: 'Seoul City Hall',
      scale: 'MEDIUM',
      iterations: 2,
      requestedConcurrency: 2,
    });
  });

  it('uses Shibuya Scramble Crossing as the second fixture', () => {
    expect(PHASE6_LOAD_FIXTURE[1]).toMatchObject({
      query: 'Shibuya Scramble Crossing, Tokyo',
      scale: 'MEDIUM',
      iterations: 1,
      requestedConcurrency: 3,
    });
  });

  it('uses Akihabara as the third fixture with LARGE scale', () => {
    expect(PHASE6_LOAD_FIXTURE[2]).toMatchObject({
      query: 'Akihabara, Tokyo',
      scale: 'LARGE',
      iterations: 1,
      requestedConcurrency: 2,
    });
  });
});

describe('Phase 6 concurrency clamping edge cases', () => {
  it('clamps all concurrency to 1 when limit is 1', () => {
    const plan = buildBenchmarkPlan({
      SCENE_BENCH_MODE: 'stubbed',
      SCENE_BENCH_PROFILE: 'phase6-load',
      SCENE_BENCH_CONCURRENCY_LIMIT: '1',
    } as NodeJS.ProcessEnv);

    expect(plan.cases).toHaveLength(3);
    expect(plan.cases.map((item) => item.concurrency)).toEqual([1, 1, 1]);
    expect(plan.cases.map((item) => item.requestedConcurrency)).toEqual([2, 3, 2]);
  });

  it('does not clamp when limit exceeds all requested values', () => {
    const plan = buildBenchmarkPlan({
      SCENE_BENCH_MODE: 'stubbed',
      SCENE_BENCH_PROFILE: 'phase6-load',
      SCENE_BENCH_CONCURRENCY_LIMIT: '10',
    } as NodeJS.ProcessEnv);

    expect(plan.cases.map((item) => item.concurrency)).toEqual([2, 3, 2]);
  });
});

describe('Phase 6 parser error cases', () => {
  it('throws on invalid benchmark mode', () => {
    expect(() => parseBenchmarkMode('invalid')).toThrow(
      'Invalid SCENE_BENCH_MODE. Expected live or stubbed.',
    );
  });

  it('throws on invalid benchmark profile', () => {
    expect(() => parseBenchmarkProfile('invalid')).toThrow(
      'Invalid SCENE_BENCH_PROFILE. Expected single or phase6-load.',
    );
  });

  it('throws on invalid scene scale', () => {
    expect(() => parseSceneScale('XLARGE')).toThrow(
      'Invalid SCENE_BENCH_SCALE=XLARGE. Expected one of SMALL, MEDIUM, LARGE.',
    );
  });
});

describe('Phase 6 aggregateNumbers edge cases', () => {
  it('returns zeros for empty array', () => {
    const result = aggregateNumbers([]);
    expect(result).toEqual({ min: 0, max: 0, avg: 0 });
  });

  it('returns correct aggregate for single value', () => {
    const result = aggregateNumbers([42]);
    expect(result).toEqual({ min: 42, max: 42, avg: 42 });
  });

  it('returns correct aggregate for multiple values', () => {
    const result = aggregateNumbers([10, 20, 30]);
    expect(result).toEqual({ min: 10, max: 30, avg: 20 });
  });

  it('rounds to 2 decimal places', () => {
    const result = aggregateNumbers([1, 2, 4]);
    expect(result.avg).toBe(2.33);
  });
});

describe('Phase 6 default env values', () => {
  it('builds a valid plan with empty env', () => {
    const plan = buildBenchmarkPlan({} as NodeJS.ProcessEnv);

    expect(plan.mode).toBe('stubbed');
    expect(plan.profile).toBe('single');
    expect(plan.concurrencyLimit).toBe(4);
    expect(plan.cases).toHaveLength(1);
    expect(plan.cases[0]!.query).toBe('Seoul City Hall');
    expect(plan.cases[0]!.scale).toBe('MEDIUM');
    expect(plan.cases[0]!.iterations).toBe(1);
    expect(plan.cases[0]!.concurrency).toBe(1);
  });
});
