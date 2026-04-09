import { Test } from '@nestjs/testing';
import { access, mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { AppModule } from '../src/app.module';
import { SceneService } from '../src/scene/scene.service';
import { getSceneDataDir } from '../src/scene/storage/scene-storage.utils';

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const smokeDataDir = join(process.cwd(), 'data', 'scene');
  await mkdir(smokeDataDir, { recursive: true });
  process.env.SCENE_DATA_DIR = smokeDataDir;

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const sceneService = moduleRef.get(SceneService);
  const forceRegenerate = process.env.SCENE_FORCE_REGENERATE !== 'false';
  const created = await sceneService.createScene(
    'Shibuya Scramble Crossing',
    'MEDIUM',
    {
      forceRegenerate,
      source: 'smoke',
      requestId: `smoke_${Date.now().toString(36)}`,
    },
  );

  await sceneService.waitForIdle();
  const scene = await sceneService.getScene(created.sceneId);
  const sceneDir = getSceneDataDir();
  const glbPath = join(sceneDir, `${scene.sceneId}.glb`);
  const jsonPath = join(sceneDir, `${scene.sceneId}.json`);
  const metaPath = join(sceneDir, `${scene.sceneId}.meta.json`);
  const detailPath = join(sceneDir, `${scene.sceneId}.detail.json`);

  const result: Record<string, unknown> = {
    created,
    scene,
    smoke: {
      dataDir: smokeDataDir,
      forceRegenerate,
      reused: forceRegenerate ? false : created.status === 'READY',
    },
  };

  if (scene.status === 'READY') {
    const bootstrap = await sceneService.getBootstrap(scene.sceneId);
    const meta = await sceneService.getSceneMeta(scene.sceneId);
    const detail = await sceneService.getSceneDetail(scene.sceneId);
    await access(glbPath);
    await access(metaPath);
    await access(detailPath);
    const storedSceneRaw = await readFile(jsonPath, 'utf8');

    if (
      storedSceneRaw.includes('"latitude"') ||
      storedSceneRaw.includes('"longitude"')
    ) {
      throw new Error('Stored scene JSON must use lat/lng keys only.');
    }

    result.bootstrap = bootstrap;
    result.provenance = {
      glbSources: bootstrap.glbSources,
      weatherBaked: false,
      trafficBaked: false,
    };
    result.meta = {
      sceneId: meta.sceneId,
      name: meta.name,
      stats: meta.stats,
      diagnostics: meta.diagnostics,
      detailStatus: meta.detailStatus,
      visualCoverage: meta.visualCoverage,
      assetProfile: meta.assetProfile,
      materialClasses: meta.materialClasses.length,
      landmarkAnchors: meta.landmarkAnchors.length,
      roads: meta.roads.length,
      buildings: meta.buildings.length,
      walkways: meta.walkways.length,
      pois: meta.pois.length,
    };
    result.detail = {
      detailStatus: detail.detailStatus,
      crossings: detail.crossings.length,
      roadMarkings: detail.roadMarkings.length,
      streetFurniture: detail.streetFurniture.length,
      vegetation: detail.vegetation.length,
      facadeHints: detail.facadeHints.length,
      signageClusters: detail.signageClusters.length,
      annotationsApplied: detail.annotationsApplied.length,
      provenance: detail.provenance,
    };
    result.files = {
      glbPath,
      jsonPath,
      metaPath,
      detailPath,
    };
  } else {
    const [glbExists, sceneJsonExists, metaExists, detailExists] =
      await Promise.all([
        fileExists(glbPath),
        fileExists(jsonPath),
        fileExists(metaPath),
        fileExists(detailPath),
      ]);

    const failureSummary = {
      sceneId: scene.sceneId,
      status: scene.status,
      failureReason: scene.failureReason ?? null,
      failureCategory: scene.failureCategory ?? null,
      qualityGate: scene.qualityGate
        ? {
            state: scene.qualityGate.state,
            reasonCodes: scene.qualityGate.reasonCodes,
            scores: scene.qualityGate.scores,
            thresholds: scene.qualityGate.thresholds,
            meshSummary: scene.qualityGate.meshSummary,
            artifactRefs: scene.qualityGate.artifactRefs,
          }
        : null,
      generatedArtifacts: {
        glbPath,
        jsonPath,
        metaPath,
        detailPath,
        exists: {
          glb: glbExists,
          sceneJson: sceneJsonExists,
          meta: metaExists,
          detail: detailExists,
        },
      },
      note: 'GLB는 build 단계에서 먼저 생성되고, 이후 quality gate에서 FAIL 나면 scene status는 FAILED가 됩니다.',
    };

    console.error(JSON.stringify({ failureSummary }, null, 2));

    throw new Error(
      `Shibuya scene generation failed with status=${scene.status} reasonCodes=${scene.qualityGate?.reasonCodes?.join(',') ?? 'NONE'}`,
    );
  }

  console.log(JSON.stringify(result, null, 2));
}

void main().catch((error: Error) => {
  console.error(error.stack ?? error.message);
  process.exit(1);
});
