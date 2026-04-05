import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { PlacesService } from '../src/places/places.service';
import { SceneService } from '../src/scene/scene.service';
import { getSceneDataDir } from '../src/scene/storage/scene-storage.utils';
import type {
  BootstrapResponse,
  SceneDetail,
  SceneMeta,
  SceneStateResponse,
  SceneTrafficResponse,
  SceneWeatherResponse,
} from '../src/scene/types/scene.types';

type AuditStatus = 'PASS' | 'PARTIAL' | 'FAIL';

interface AuditCheck {
  id: string;
  title: string;
  status: AuditStatus;
  evidence: string[];
}

interface GlbInspection {
  nodeNames: string[];
  categories: Record<string, boolean>;
}

interface AuditStepError {
  error: string;
}

async function main() {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const placesService = moduleRef.get(PlacesService);
  const sceneService = moduleRef.get(SceneService);

  const searchResults = await placesService.searchExternalPlaces(
    'Shibuya Scramble Crossing',
    1,
  );
  const created = await sceneService.createScene('Shibuya Scramble Crossing', 'MEDIUM', {
    forceRegenerate: true,
    source: 'smoke',
    requestId: `audit_${Date.now().toString(36)}`,
  });
  await sceneService.waitForIdle();

  const scene = await sceneService.getScene(created.sceneId);
  const bootstrap = await sceneService.getBootstrap(scene.sceneId);
  const meta = await sceneService.getSceneMeta(scene.sceneId);
  const detail = await sceneService.getSceneDetail(scene.sceneId);
  const places = await sceneService.getPlaces(scene.sceneId);
  const weather = await resolveAuditStep(() =>
    sceneService.getWeather(scene.sceneId, {
      date: new Date().toISOString().slice(0, 10),
      timeOfDay: 'DAY',
    }),
  );
  const state = await resolveAuditStep(() =>
    sceneService.getState(scene.sceneId, {
      date: new Date().toISOString().slice(0, 10),
      timeOfDay: 'DAY',
    }),
  );
  const traffic = await resolveAuditStep(() =>
    sceneService.getTraffic(scene.sceneId),
  );

  const sceneDir = getSceneDataDir();
  const glbPath = join(sceneDir, `${scene.sceneId}.glb`);
  const sceneJsonPath = join(sceneDir, `${scene.sceneId}.json`);
  const metaPath = join(sceneDir, `${scene.sceneId}.meta.json`);
  const detailPath = join(sceneDir, `${scene.sceneId}.detail.json`);

  await Promise.all([
    access(glbPath),
    access(sceneJsonPath),
    access(metaPath),
    access(detailPath),
  ]);

  const glbInspection = await inspectGlb(glbPath);
  const checks = buildChecks({
    searchResults,
    scene,
    bootstrap,
    meta,
    detail,
    placesCount: places.pois.length,
    state,
    weather,
    traffic,
    glbInspection,
  });

  console.log(
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        sceneId: scene.sceneId,
        files: {
          glbPath,
          sceneJsonPath,
          metaPath,
          detailPath,
        },
        searchResultCount: searchResults.length,
        sceneStatus: scene.status,
        bootstrap,
        metaSummary: {
          stats: meta.stats,
          detailStatus: meta.detailStatus,
          roads: meta.roads.length,
          buildings: meta.buildings.length,
          walkways: meta.walkways.length,
          pois: meta.pois.length,
        },
        detailSummary: {
          crossings: detail.crossings.length,
          roadMarkings: detail.roadMarkings.length,
          streetFurniture: detail.streetFurniture.length,
          vegetation: detail.vegetation.length,
          landCovers: detail.landCovers.length,
          linearFeatures: detail.linearFeatures.length,
          facadeHints: detail.facadeHints.length,
          signageClusters: detail.signageClusters.length,
        },
        liveSummary: {
          state,
          weather,
          traffic,
          placesCount: places.pois.length,
        },
        glbInspection,
        checks,
      },
      null,
      2,
    ),
  );
}

function buildChecks(input: {
  searchResults: Awaited<ReturnType<PlacesService['searchExternalPlaces']>>;
  scene: Awaited<ReturnType<SceneService['getScene']>>;
  bootstrap: BootstrapResponse;
  meta: SceneMeta;
  detail: SceneDetail;
  placesCount: number;
  state: SceneStateResponse | AuditStepError;
  weather: SceneWeatherResponse | AuditStepError;
  traffic: SceneTrafficResponse | AuditStepError;
  glbInspection: GlbInspection;
}): AuditCheck[] {
  const checks: AuditCheck[] = [];

  checks.push({
    id: 'search',
    title: 'Google Places 장소 검색',
    status: input.searchResults.length > 0 ? 'PASS' : 'FAIL',
    evidence: [`searchResults=${input.searchResults.length}`],
  });

  checks.push({
    id: 'scene-pipeline',
    title: 'Scene 생성 파이프라인',
    status: input.scene.status === 'READY' ? 'PASS' : 'FAIL',
    evidence: [`scene.status=${input.scene.status}`],
  });

  checks.push({
    id: 'artifacts',
    title: 'scene/json/meta/detail/glb 산출물',
    status: input.scene.assetUrl && input.bootstrap.metaUrl && input.bootstrap.detailUrl ? 'PASS' : 'FAIL',
    evidence: [
      `assetUrl=${input.scene.assetUrl ?? 'null'}`,
      `metaUrl=${input.bootstrap.metaUrl}`,
      `detailUrl=${input.bootstrap.detailUrl}`,
    ],
  });

  checks.push({
    id: 'mvp-static',
    title: 'MVP 정적 요소(건물/도로/횡단보도/POI)',
    status:
      input.meta.buildings.length > 0 &&
      input.meta.roads.length > 0 &&
      input.detail.crossings.length > 0 &&
      input.meta.pois.length > 0
        ? 'PASS'
        : 'FAIL',
    evidence: [
      `buildings=${input.meta.buildings.length}`,
      `roads=${input.meta.roads.length}`,
      `crossings=${input.detail.crossings.length}`,
      `pois=${input.meta.pois.length}`,
    ],
  });

  checks.push({
    id: 'live-api',
    title: 'Live API(traffic/weather)',
    status:
      !('error' in input.state) &&
      !('error' in input.traffic) &&
      !('error' in input.weather) &&
      input.traffic.segments.length > 0 &&
      input.weather.source === 'OPEN_METEO_HISTORICAL'
        ? 'PASS'
        : 'PARTIAL',
    evidence: [
      `state=${'error' in input.state ? input.state.error : `crowd=${input.state.crowd.level},weather=${input.state.weather}`}`,
      `traffic=${'error' in input.traffic ? input.traffic.error : `segments=${input.traffic.segments.length}`}`,
      `weather=${'error' in input.weather ? input.weather.error : `source=${input.weather.source}`}`,
      `liveEndpoints=${Object.keys(input.bootstrap.liveEndpoints).join(',')}`,
    ],
  });

  checks.push({
    id: 'fe-contract',
    title: 'FE 소비 최소 계약',
    status:
      input.scene.assetUrl &&
      input.bootstrap.metaUrl &&
      input.bootstrap.detailUrl &&
      input.meta.camera &&
      input.meta.roads.length > 0
        ? 'PASS'
        : 'FAIL',
    evidence: [
      `assetUrl=${input.scene.assetUrl ?? 'null'}`,
      `camera.topView=${JSON.stringify(input.meta.camera.topView)}`,
      `placesCount=${input.placesCount}`,
    ],
  });

  checks.push({
    id: 'glb-static-inclusion',
    title: '.glb MVP 포함 여부',
    status:
      input.glbInspection.categories.buildings &&
      input.glbInspection.categories.roads &&
      input.glbInspection.categories.crosswalks &&
      input.glbInspection.categories.walkways
        ? input.glbInspection.categories.pois
          ? 'PASS'
          : 'PARTIAL'
        : 'FAIL',
    evidence: [
      `glb.buildings=${input.glbInspection.categories.buildings}`,
      `glb.roads=${input.glbInspection.categories.roads}`,
      `glb.crosswalks=${input.glbInspection.categories.crosswalks}`,
      `glb.walkways=${input.glbInspection.categories.walkways}`,
      `glb.pois=${input.glbInspection.categories.pois}`,
    ],
  });

  checks.push({
    id: 'meta-vs-glb-gap',
    title: 'meta/detail 대비 glb 누락 요소',
    status:
      (input.meta.pois.length > 0 && !input.glbInspection.categories.pois) ||
      (input.detail.landCovers.length > 0 &&
        !input.glbInspection.categories.landCovers) ||
      (input.detail.linearFeatures.length > 0 &&
        !input.glbInspection.categories.linearFeatures)
        ? 'FAIL'
        : 'PASS',
    evidence: [
      `metaPois=${input.meta.pois.length}`,
      `detailLandCovers=${input.detail.landCovers.length}`,
      `detailLinearFeatures=${input.detail.linearFeatures.length}`,
      `glb.pois=${input.glbInspection.categories.pois}`,
      `glb.landCovers=${input.glbInspection.categories.landCovers}`,
      `glb.linearFeatures=${input.glbInspection.categories.linearFeatures}`,
    ],
  });

  checks.push({
    id: 'synthetic-live-gap',
    title: '합성 crowd/lighting 상태의 scene live 연결',
    status:
      input.bootstrap.liveEndpoints.state &&
      !('error' in input.state) &&
      input.state.source === 'MVP_SYNTHETIC_RULES'
        ? 'PASS'
        : 'FAIL',
    evidence: [
      `stateEndpoint=${input.bootstrap.liveEndpoints.state ?? 'missing'}`,
      'error' in input.state
        ? input.state.error
        : `crowd=${input.state.crowd.level},lighting=${input.state.lighting.ambient}`,
    ],
  });

  return checks;
}

async function resolveAuditStep<T>(
  fn: () => Promise<T>,
): Promise<T | { error: string }> {
  try {
    return await fn();
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function inspectGlb(glbPath: string): Promise<GlbInspection> {
  const gltf = await import('@gltf-transform/core');
  const io = new gltf.NodeIO();
  const doc = await io.read(glbPath);
  const root = doc.getRoot();
  const nodeNames = root
    .listNodes()
    .map((node) => node.getName())
    .filter((value): value is string => Boolean(value));

  return {
    nodeNames,
    categories: {
      buildings: nodeNames.some((name) => name.startsWith('building_shells_')),
      roads: nodeNames.includes('road_base'),
      crosswalks: nodeNames.includes('crosswalk_decals'),
      walkways: nodeNames.includes('sidewalk'),
      streetFurniture:
        nodeNames.includes('traffic_lights') ||
        nodeNames.includes('street_lights') ||
        nodeNames.includes('sign_poles'),
      vegetation: nodeNames.includes('trees_planters'),
      pois: nodeNames.some((name) => name.includes('poi')),
      landCovers: nodeNames.some((name) => name.includes('park') || name.includes('landcover')),
      linearFeatures: nodeNames.some(
        (name) => name.includes('rail') || name.includes('bridge') || name.includes('linear'),
      ),
      billboards: nodeNames.includes('billboards'),
    },
  };
}

void main().catch((error: Error) => {
  console.error(error.stack ?? error.message);
  process.exit(1);
});
