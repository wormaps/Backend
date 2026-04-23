import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const TEST_DATA_DIR = join(process.cwd(), 'data', 'scene', '.spec-temp-phase7-qa-table');

const REPRESENTATIVE_SCENES = [
  { placeId: 'shibuya', query: 'Shibuya Scramble Crossing, Tokyo' },
  { placeId: 'gangnam', query: 'Gangnam Station Intersection, Seoul' },
  { placeId: 'seoul-tower', query: 'N Seoul Tower, Seoul' },
  { placeId: 'residential-lowrise', query: 'Yeoksam-dong Residential Area, Seoul' },
  { placeId: 'industrial', query: 'Incheon Industrial Complex, Incheon' },
  { placeId: 'riverside-park', query: 'Han River Banpo Hangang Park, Seoul' },
  { placeId: 'coastal', query: 'Haeundae Beach, Busan' },
  { placeId: 'mountain-temple', query: 'Bulguksa Temple, Gyeongju' },
] as const;

describe('Phase 7 representative scene QA-table contract regression', () => {
  beforeEach(async () => {
    await rm(TEST_DATA_DIR, { recursive: true, force: true });
    await mkdir(TEST_DATA_DIR, { recursive: true });
  });

  afterEach(async () => {
    await rm(TEST_DATA_DIR, { recursive: true, force: true });
  });

  it('rebuilds the representative 8-scene QA table contract', async () => {
    for (const scene of REPRESENTATIVE_SCENES) {
      await writeRepresentativeScene(TEST_DATA_DIR, scene.placeId, scene.query);
    }

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

    const output = await readFile(join(TEST_DATA_DIR, 'scene-qa-8-table.json'), 'utf8');
    const report = JSON.parse(output) as {
      readyCount: number;
      pendingCount: number;
      failedCount: number;
      rows: Array<{
        placeId: string;
        query: string;
        status: string;
        readyGate: { passed: boolean };
      }>;
    };

    expect(report.readyCount).toBe(8);
    expect(report.pendingCount).toBe(0);
    expect(report.failedCount).toBe(0);
    expect(report.rows).toHaveLength(8);
    expect(report.rows.map((row) => row.placeId)).toEqual(
      REPRESENTATIVE_SCENES.map((scene) => scene.placeId),
    );
    expect(report.rows.every((row) => row.status === 'READY')).toBe(true);
    expect(report.rows.every((row) => row.readyGate.passed)).toBe(true);
  });
});

async function writeRepresentativeScene(
  dir: string,
  placeId: string,
  query: string,
): Promise<void> {
  const slug = slugify(query);
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
    stats: {
      buildingCount: 24,
      roadCount: 18,
      walkwayCount: 12,
    },
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
    comparison: {
      overallScoreDelta: 0.05,
    },
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

function slugify(query: string): string {
  return query
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
