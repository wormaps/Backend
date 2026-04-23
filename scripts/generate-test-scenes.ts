import { Test } from '@nestjs/testing';
import { access, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { AppModule } from '../src/app.module';
import { SceneService } from '../src/scene/scene.service';
import { getSceneDataDir } from '../src/scene/storage/scene-storage.utils';
import type { SceneScale } from '../src/scene/types/scene.types';

interface TestPlace {
  id: string;
  query: string;
  scale: SceneScale;
  expectReady?: boolean;
}

const TEST_PLACES: TestPlace[] = [
  {
    id: 'shibuya',
    query: 'Shibuya Scramble Crossing, Tokyo',
    scale: 'MEDIUM',
  },
  {
    id: 'gangnam',
    query: 'Gangnam Station Intersection, Seoul',
    scale: 'MEDIUM',
  },
  {
    id: 'seoul-tower',
    query: 'N Seoul Tower, Seoul',
    scale: 'SMALL',
  },
  {
    id: 'residential-lowrise',
    query: 'Yeoksam-dong Residential Area, Seoul',
    scale: 'MEDIUM',
  },
  {
    id: 'industrial',
    query: 'Incheon Industrial Complex, Incheon',
    scale: 'LARGE',
  },
  {
    id: 'riverside-park',
    query: 'Han River Banpo Hangang Park, Seoul',
    scale: 'MEDIUM',
  },
  {
    id: 'coastal',
    query: 'Haeundae Beach, Busan',
    scale: 'MEDIUM',
  },
  {
    id: 'mountain-temple',
    query: 'Bulguksa Temple, Gyeongju',
    scale: 'SMALL',
  },
];

const CORE_REPRESENTATIVE_PLACES = new Set([
  'shibuya',
  'gangnam',
  'seoul-tower',
  'residential-lowrise',
  'coastal',
]);

interface GenerationResult {
  place: TestPlace;
  sceneId?: string;
  status: 'READY' | 'FAILED' | 'SKIP';
  error?: string;
  files?: {
    glb: boolean;
    meta: boolean;
    detail: boolean;
    diagnosticsLog: boolean;
    modeComparison: boolean;
  };
}

async function main() {
  const sceneDataDir = getSceneDataDir();
  await mkdir(sceneDataDir, { recursive: true });

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const sceneService = moduleRef.get(SceneService);
  const forceRegenerate = process.env.SCENE_FORCE_REGENERATE !== 'false';
  const results: GenerationResult[] = [];

  for (const place of TEST_PLACES) {
    console.log(`\n=== Generating: ${place.id} (${place.query}) ===`);
    const result: GenerationResult = {
      place,
      status: 'SKIP',
    };

    try {
      const created = await sceneService.createScene(place.query, place.scale, {
        forceRegenerate,
        source: 'smoke',
        requestId: `test_${place.id}_${Date.now().toString(36)}`,
      });
      result.sceneId = created.sceneId;

      console.log(
        `  Scene created: ${created.sceneId} (status: ${created.status})`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.status = 'FAILED';
      result.error = message;
      console.error(`  FAILED to create scene: ${message}`);
    }

    results.push(result);
  }

  console.log('\n=== Waiting for all generations to complete ===');
  await sceneService.waitForIdle();

  console.log('\n=== Verifying outputs ===');
  for (const result of results) {
    if (!result.sceneId) {
      continue;
    }

    try {
      const scene = await sceneService.getScene(result.sceneId);
      if (scene.status === 'READY') {
        result.status = 'READY';

        const glbPath = join(sceneDataDir, `${result.sceneId}.glb`);
        const metaPath = join(sceneDataDir, `${result.sceneId}.meta.json`);
        const detailPath = join(sceneDataDir, `${result.sceneId}.detail.json`);
        const diagPath = join(
          sceneDataDir,
          `${result.sceneId}.diagnostics.log`,
        );
        const modePath = join(
          sceneDataDir,
          `${result.sceneId}.mode-comparison.json`,
        );

        result.files = {
          glb: await fileExists(glbPath),
          meta: await fileExists(metaPath),
          detail: await fileExists(detailPath),
          diagnosticsLog: await fileExists(diagPath),
          modeComparison: await fileExists(modePath),
        };

        console.log(`  ${result.place.id}: READY`);
        console.log(`    GLB: ${result.files.glb ? 'OK' : 'MISSING'}`);
        console.log(`    META: ${result.files.meta ? 'OK' : 'MISSING'}`);
        console.log(`    DETAIL: ${result.files.detail ? 'OK' : 'MISSING'}`);
        console.log(
          `    DIAGNOSTICS: ${result.files.diagnosticsLog ? 'OK' : 'MISSING'}`,
        );
        console.log(
          `    MODE_COMPARISON: ${result.files.modeComparison ? 'OK' : 'MISSING'}`,
        );
      } else {
        result.status = 'FAILED';
        result.error = `Final status: ${scene.status}`;
        console.log(`  ${result.place.id}: FAILED (status=${scene.status})`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.status = 'FAILED';
      result.error = message;
      console.error(
        `  ${result.place.id}: FAILED (verification error: ${message})`,
      );
    }
  }

  console.log('\n=== Summary ===');
  const ready = results.filter((r) => r.status === 'READY').length;
  const failed = results.filter((r) => r.status === 'FAILED').length;
  const coreFailed = results.filter(
    (r) => r.status !== 'READY' && CORE_REPRESENTATIVE_PLACES.has(r.place.id),
  ).length;
  console.log(`Total: ${results.length}, Ready: ${ready}, Failed: ${failed}`);

  if (failed > 0) {
    console.log('\nFailed places:');
    for (const r of results.filter((r) => r.status === 'FAILED')) {
      console.log(`  - ${r.place.id}: ${r.error}`);
    }
  }

  const summary = {
    sceneDataDir,
    total: results.length,
    ready,
    failed,
    results: results.map((r) => ({
      id: r.place.id,
      query: r.place.query,
      scale: r.place.scale,
      sceneId: r.sceneId,
      status: r.status,
      error: r.error,
      files: r.files,
    })),
  };

  console.log('\n=== JSON Summary ===');
  console.log(JSON.stringify(summary, null, 2));

  if (coreFailed > 0) {
    console.error(
      `\nCore representative scene gate failed: ${coreFailed} required scene(s) are not READY.`,
    );
    process.exitCode = 1;
  }
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

void main().catch((error: Error) => {
  console.error(error.stack ?? error.message);
  process.exit(1);
});
