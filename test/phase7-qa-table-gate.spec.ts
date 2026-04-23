import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const TEST_DATA_DIR = join(process.cwd(), 'data', 'scene', '.spec-temp-phase7-qa-gate');

describe('Phase 7 QA-table release gate', () => {
  beforeEach(async () => {
    await rm(TEST_DATA_DIR, { recursive: true, force: true });
    await mkdir(TEST_DATA_DIR, { recursive: true });
  });

  afterEach(async () => {
    await rm(TEST_DATA_DIR, { recursive: true, force: true });
  });

  it('fails closed when representative scenes are missing', async () => {
    const result = Bun.spawnSync({
      cmd: ['bun', 'run', 'scripts/build-scene-qa-table.ts'],
      cwd: process.cwd(),
      env: {
        ...process.env,
        SCENE_DATA_DIR: TEST_DATA_DIR,
      },
      stdout: 'pipe',
      stderr: 'pipe',
    });

    expect(result.exitCode).toBe(1);

    const report = await Bun.file(join(TEST_DATA_DIR, 'scene-qa-table.json')).text();
    const parsed = JSON.parse(report) as {
      readyCount: number;
      failedCount: number;
      rows: Array<{ status: string; readyGate: { passed: boolean } }>;
    };

    expect(parsed.readyCount).toBe(0);
    expect(parsed.failedCount).toBe(8);
    expect(parsed.rows.every((row) => row.status === 'FAILED')).toBe(true);
    expect(parsed.rows.every((row) => !row.readyGate.passed)).toBe(true);
  });

  it('allows tail scenes to fail when core scenes are ready', async () => {
    await seedSyntheticScene(TEST_DATA_DIR, 'shibuya', 'Shibuya Scramble Crossing, Tokyo');
    await seedSyntheticScene(TEST_DATA_DIR, 'gangnam', 'Gangnam Station Intersection, Seoul');
    await seedSyntheticScene(TEST_DATA_DIR, 'seoul-tower', 'N Seoul Tower, Seoul');
    await seedSyntheticScene(TEST_DATA_DIR, 'residential-lowrise', 'Yeoksam-dong Residential Area, Seoul');
    await seedSyntheticScene(TEST_DATA_DIR, 'coastal', 'Haeundae Beach, Busan');

    const result = Bun.spawnSync({
      cmd: ['bun', 'run', 'scripts/build-scene-qa-table.ts'],
      cwd: process.cwd(),
      env: {
        ...process.env,
        SCENE_DATA_DIR: TEST_DATA_DIR,
      },
      stdout: 'pipe',
      stderr: 'pipe',
    });

    expect(result.exitCode).toBe(0);

    const report = await Bun.file(join(TEST_DATA_DIR, 'scene-qa-table.json')).text();
    const parsed = JSON.parse(report) as {
      readyCount: number;
      failedCount: number;
      rows: Array<{ placeId: string; status: string; readyGate: { passed: boolean } }>;
    };

    expect(parsed.rows.filter((row) => row.readyGate.passed)).toHaveLength(5);
    expect(parsed.failedCount).toBe(3);
  });
});

async function seedSyntheticScene(
  dir: string,
  placeId: string,
  query: string,
): Promise<void> {
  const slug = query
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const sceneId = `scene-${slug}-001`;
  const basePath = join(dir, sceneId);

  const scene = {
    scene: {
      sceneId,
      placeId,
      name: query,
      status: 'READY',
      assetUrl: `/api/scenes/${sceneId}/assets/base.glb`,
      metaUrl: `/api/scenes/${sceneId}/meta`,
      failureReason: null,
      failureCategory: null,
      qualityGate: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  };

  const meta = {
    stats: { buildingCount: 24, roadCount: 18, walkwayCount: 12 },
    structuralCoverage: {
      fallbackMassingRate: 0.02,
      selectedBuildingCoverage: 0.78,
      coreAreaBuildingCoverage: 0.71,
      heroLandmarkCoverage: 0.73,
    },
    assetProfile: {
      selected: {
        crossingCount: 4,
        trafficLightCount: 2,
        streetLightCount: 3,
        signPoleCount: 2,
      },
    },
    materialClasses: ['concrete', 'glass', 'asphalt'],
    landmarkAnchors: [{ id: 'landmark-1' }],
  };

  const detail = {
    crossings: [{ id: 'crossing-1' }],
    roadMarkings: [{ id: 'marking-1' }],
    districtAtmosphereProfiles: [{ id: 'district-1' }],
  };

  const modeComparison = {
    sceneId,
    generatedAt: '2026-01-01T00:00:00.000Z',
    comparison: { overallScoreDelta: 0.05 },
  };

  await writeFile(`${basePath}.json`, `${JSON.stringify(scene, null, 2)}\n`, 'utf8');
  await writeFile(`${basePath}.meta.json`, `${JSON.stringify(meta, null, 2)}\n`, 'utf8');
  await writeFile(`${basePath}.detail.json`, `${JSON.stringify(detail, null, 2)}\n`, 'utf8');
  await writeFile(
    `${basePath}.mode-comparison.json`,
    `${JSON.stringify(modeComparison, null, 2)}\n`,
    'utf8',
  );
}
