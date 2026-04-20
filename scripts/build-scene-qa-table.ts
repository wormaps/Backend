import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getSceneDataDir } from '../src/scene/storage/scene-storage.utils';

type SceneStatus = 'READY' | 'PENDING' | 'FAILED';
type Confidence = 'high' | 'medium' | 'low' | 'very_low';

interface ChecklistScore {
  structure: number;
  silhouette: number;
  facadeMaterial: number;
  roadSurface: number;
  streetFurniture: number;
  placeIdentity: number;
  atmosphere: number;
}

interface SceneQaRow {
  placeId: string;
  query: string;
  sceneId: string | null;
  status: SceneStatus;
  confidence: Confidence;
  files: {
    scene: boolean;
    meta: boolean;
    detail: boolean;
    modeComparison: boolean;
  };
  score: {
    totalRaw: number;
    totalReported: number;
    provisional: boolean;
    confidenceBand: {
      lower: number;
      upper: number;
    };
    checklist: ChecklistScore;
  };
  readyGate: {
    passed: boolean;
    checks: {
      hasMeta: boolean;
      hasDetail: boolean;
      hasModeComparison: boolean;
      hasAssetUrl: boolean;
      hasPlaceId: boolean;
      nonZeroStats: boolean;
    };
  };
  evidence: {
    buildingCount: number;
    roadCount: number;
    walkwayCount: number;
    crossingCount: number;
    roadMarkingCount: number;
    streetFurnitureCount: number;
    materialClassCount: number;
    landmarkAnchorCount: number;
    districtProfileCount: number;
    fallbackMassingRate: number;
    selectedBuildingCoverage: number;
    coreAreaBuildingCoverage: number;
    heroLandmarkCoverage: number;
  };
  notes: string[];
}

interface SceneQaReport {
  generatedAt: string;
  sceneDataDir: string;
  readyCount: number;
  pendingCount: number;
  failedCount: number;
  averageTotalScore: number;
  rows: SceneQaRow[];
  recommendations: string[];
}

interface TestPlace {
  id: string;
  query: string;
}

const TEST_PLACES: TestPlace[] = [
  { id: 'shibuya', query: 'Shibuya Scramble Crossing, Tokyo' },
  { id: 'gangnam', query: 'Gangnam Station Intersection, Seoul' },
  { id: 'seoul-tower', query: 'N Seoul Tower, Seoul' },
  { id: 'residential-lowrise', query: 'Yeoksam-dong Residential Area, Seoul' },
  { id: 'industrial', query: 'Incheon Industrial Complex, Incheon' },
  { id: 'riverside-park', query: 'Han River Banpo Hangang Park, Seoul' },
  { id: 'coastal', query: 'Haeundae Beach, Busan' },
  { id: 'mountain-temple', query: 'Bulguksa Temple, Gyeongju' },
];

async function main() {
  const sceneDataDir = getSceneDataDir();
  const files = await readdir(sceneDataDir);

  const rows: SceneQaRow[] = [];
  for (const place of TEST_PLACES) {
    rows.push(await buildRow(sceneDataDir, files, place));
  }

  const readyCount = rows.filter((row) => row.status === 'READY').length;
  const pendingCount = rows.filter((row) => row.status === 'PENDING').length;
  const failedCount = rows.filter((row) => row.status === 'FAILED').length;
  const averageTotalScore = round(
    rows.reduce((sum, row) => sum + row.score.totalReported, 0) /
      Math.max(1, rows.length),
  );

  const recommendations = buildRecommendations(rows);
  const report: SceneQaReport = {
    generatedAt: new Date().toISOString(),
    sceneDataDir,
    readyCount,
    pendingCount,
    failedCount,
    averageTotalScore,
    rows,
    recommendations,
  };

  const outputPath = join(sceneDataDir, 'scene-qa-8-table.json');
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  printSummary(report, outputPath);
}

async function buildRow(
  sceneDataDir: string,
  files: string[],
  place: TestPlace,
): Promise<SceneQaRow> {
  const slug = slugify(place.query);
  const latestSceneBase = selectLatestSceneBase(files, slug);
  if (!latestSceneBase) {
    return {
      placeId: place.id,
      query: place.query,
      sceneId: null,
      status: 'FAILED',
      confidence: 'very_low',
      files: {
        scene: false,
        meta: false,
        detail: false,
        modeComparison: false,
      },
      score: {
        totalRaw: 0,
        totalReported: 0,
        provisional: true,
        confidenceBand: { lower: 0, upper: 0 },
        checklist: {
          structure: 0,
          silhouette: 0,
          facadeMaterial: 0,
          roadSurface: 0,
          streetFurniture: 0,
          placeIdentity: 0,
          atmosphere: 0,
        },
      },
      readyGate: {
        passed: false,
        checks: {
          hasMeta: false,
          hasDetail: false,
          hasModeComparison: false,
          hasAssetUrl: false,
          hasPlaceId: false,
          nonZeroStats: false,
        },
      },
      evidence: emptyEvidence(),
      notes: ['scene file missing'],
    };
  }

  const scenePath = join(sceneDataDir, `${latestSceneBase}.json`);
  const metaPath = join(sceneDataDir, `${latestSceneBase}.meta.json`);
  const detailPath = join(sceneDataDir, `${latestSceneBase}.detail.json`);
  const modePath = join(
    sceneDataDir,
    `${latestSceneBase}.mode-comparison.json`,
  );

  const sceneJson = await readJson(scenePath);
  const metaJson = await readJson(metaPath, true);
  const detailJson = await readJson(detailPath, true);
  const modeJson = await readJson(modePath, true);

  const sceneId = (sceneJson?.scene?.sceneId ?? latestSceneBase) as string;
  const status = (sceneJson?.scene?.status ?? 'FAILED') as SceneStatus;
  const hasMeta = metaJson !== null;
  const hasDetail = detailJson !== null;

  const evidence = extractEvidence(sceneJson, metaJson, detailJson);
  const checklist = computeChecklist(evidence, status);
  const withGates = applyGates(checklist);
  const totalRaw = round(withGates.total);

  const confidence = resolveConfidence({
    status,
    hasMeta,
    hasDetail,
    hasModeComparison: modeJson !== null,
  });
  const readyGate = resolveReadyGate({
    status,
    sceneJson,
    hasMeta,
    hasDetail,
    hasModeComparison: modeJson !== null,
    evidence,
  });
  const confidenceBand = resolveConfidenceBand(totalRaw, confidence);

  const notes: string[] = [];
  if (!readyGate.passed) {
    notes.push('provisional score (ready gate not fully passed)');
  }
  if (evidence.fallbackMassingRate > 0.08) {
    notes.push('fallback massing rate is high');
  }
  if (evidence.heroLandmarkCoverage < 0.6) {
    notes.push('landmark coverage is low');
  }

  return {
    placeId: place.id,
    query: place.query,
    sceneId,
    status,
    confidence,
    files: {
      scene: true,
      meta: hasMeta,
      detail: hasDetail,
      modeComparison: modeJson !== null,
    },
    score: {
      totalRaw,
      totalReported: totalRaw,
      provisional: !readyGate.passed,
      confidenceBand,
      checklist: withGates.checklist,
    },
    readyGate,
    evidence,
    notes,
  };
}

function computeChecklist(
  evidence: SceneQaRow['evidence'],
  _status: SceneStatus,
): { checklist: ChecklistScore; total: number } {
  const structure = round(
    20 *
      (0.45 * evidence.selectedBuildingCoverage +
        0.35 * evidence.coreAreaBuildingCoverage +
        0.2 * (1 - evidence.fallbackMassingRate)),
  );
  const silhouette = round(
    15 *
      clamp01(
        0.45 * normalizeCount(evidence.materialClassCount, 5) +
          0.25 * (1 - evidence.fallbackMassingRate) +
          0.3 * normalizeCount(evidence.buildingCount, 450),
      ),
  );
  const facadeMaterial = round(
    15 *
      clamp01(
        0.45 * normalizeCount(evidence.materialClassCount, 5) +
          0.25 * normalizeCount(evidence.districtProfileCount, 5) +
          0.3 * (1 - evidence.fallbackMassingRate),
      ),
  );
  const roadSurface = round(
    15 *
      clamp01(
        0.3 * normalizeCount(evidence.roadCount, 180) +
          0.25 * normalizeCount(evidence.walkwayCount, 140) +
          0.25 * normalizeCount(evidence.crossingCount, 40) +
          0.2 * normalizeCount(evidence.roadMarkingCount, 120),
      ),
  );
  const streetFurniture = round(
    10 *
      clamp01(
        0.65 * normalizeCount(evidence.streetFurnitureCount, 80) +
          0.35 * normalizeCount(evidence.roadCount, 200),
      ),
  );
  const placeIdentity = round(
    15 *
      clamp01(
        0.45 * evidence.heroLandmarkCoverage +
          0.3 * normalizeCount(evidence.landmarkAnchorCount, 12) +
          0.25 * normalizeCount(evidence.crossingCount, 30),
      ),
  );
  const atmosphere = round(
    10 *
      clamp01(
        0.45 * normalizeCount(evidence.districtProfileCount, 5) +
          0.3 * normalizeCount(evidence.materialClassCount, 5) +
          0.25 * normalizeCount(evidence.roadMarkingCount, 120),
      ),
  );

  const checklist: ChecklistScore = {
    structure,
    silhouette,
    facadeMaterial,
    roadSurface,
    streetFurniture,
    placeIdentity,
    atmosphere,
  };

  const total =
    checklist.structure +
    checklist.silhouette +
    checklist.facadeMaterial +
    checklist.roadSurface +
    checklist.streetFurniture +
    checklist.placeIdentity +
    checklist.atmosphere;

  return { checklist, total };
}

function applyGates(result: { checklist: ChecklistScore; total: number }): {
  checklist: ChecklistScore;
  total: number;
} {
  const checklist = { ...result.checklist };

  if (checklist.structure < 12) {
    checklist.facadeMaterial = Math.min(checklist.facadeMaterial, 10);
    checklist.placeIdentity = Math.min(checklist.placeIdentity, 10);
  }

  const total =
    checklist.structure +
    checklist.silhouette +
    checklist.facadeMaterial +
    checklist.roadSurface +
    checklist.streetFurniture +
    checklist.placeIdentity +
    checklist.atmosphere;

  return {
    checklist,
    total,
  };
}

function extractEvidence(
  sceneJson: any,
  metaJson: any,
  detailJson: any,
): SceneQaRow['evidence'] {
  const meta = metaJson ?? sceneJson?.meta ?? {};
  const detail = detailJson ?? sceneJson?.detail ?? {};
  const stats = meta.stats ?? {};
  const structural = meta.structuralCoverage ?? {};
  const assetSelected = meta.assetProfile?.selected ?? {};

  const materialClassCount = Array.isArray(meta.materialClasses)
    ? meta.materialClasses.length
    : 0;
  const districtProfileCount = Array.isArray(detail.districtAtmosphereProfiles)
    ? detail.districtAtmosphereProfiles.length
    : 0;

  return {
    buildingCount: toNumber(stats.buildingCount),
    roadCount: toNumber(stats.roadCount),
    walkwayCount: toNumber(stats.walkwayCount),
    crossingCount:
      toNumber(assetSelected.crossingCount) ||
      (Array.isArray(detail.crossings) ? detail.crossings.length : 0),
    roadMarkingCount: Array.isArray(detail.roadMarkings)
      ? detail.roadMarkings.length
      : 0,
    streetFurnitureCount:
      toNumber(assetSelected.trafficLightCount) +
      toNumber(assetSelected.streetLightCount) +
      toNumber(assetSelected.signPoleCount),
    materialClassCount,
    landmarkAnchorCount: Array.isArray(meta.landmarkAnchors)
      ? meta.landmarkAnchors.length
      : 0,
    districtProfileCount,
    fallbackMassingRate: clamp01(toNumber(structural.fallbackMassingRate)),
    selectedBuildingCoverage: clamp01(
      toNumber(structural.selectedBuildingCoverage),
    ),
    coreAreaBuildingCoverage: clamp01(
      toNumber(structural.coreAreaBuildingCoverage),
    ),
    heroLandmarkCoverage: clamp01(toNumber(structural.heroLandmarkCoverage)),
  };
}

function resolveConfidence(input: {
  status: SceneStatus;
  hasMeta: boolean;
  hasDetail: boolean;
  hasModeComparison: boolean;
}): Confidence {
  if (
    input.status === 'READY' &&
    input.hasMeta &&
    input.hasDetail &&
    input.hasModeComparison
  ) {
    return 'high';
  }
  if (input.status === 'READY' && input.hasMeta && input.hasDetail) {
    return 'medium';
  }
  if (input.status === 'PENDING') {
    return 'low';
  }
  return 'very_low';
}

function resolveReadyGate(input: {
  status: SceneStatus;
  sceneJson: any;
  hasMeta: boolean;
  hasDetail: boolean;
  hasModeComparison: boolean;
  evidence: SceneQaRow['evidence'];
}): SceneQaRow['readyGate'] {
  const checks = {
    hasMeta: input.hasMeta,
    hasDetail: input.hasDetail,
    hasModeComparison: input.hasModeComparison,
    hasAssetUrl: Boolean(input.sceneJson?.scene?.assetUrl),
    hasPlaceId: Boolean(input.sceneJson?.scene?.placeId),
    nonZeroStats:
      input.evidence.buildingCount > 0 ||
      input.evidence.roadCount > 0 ||
      input.evidence.walkwayCount > 0,
  };

  return {
    passed:
      input.status === 'READY' &&
      checks.hasMeta &&
      checks.hasDetail &&
      checks.hasModeComparison &&
      checks.hasAssetUrl &&
      checks.hasPlaceId &&
      checks.nonZeroStats,
    checks,
  };
}

function resolveConfidenceBand(
  total: number,
  confidence: Confidence,
): { lower: number; upper: number } {
  const delta =
    confidence === 'high'
      ? 5
      : confidence === 'medium'
        ? 10
        : confidence === 'low'
          ? 20
          : 30;
  return {
    lower: round(Math.max(0, total - delta)),
    upper: round(Math.min(100, total + delta)),
  };
}

function buildRecommendations(rows: SceneQaRow[]): string[] {
  const recommendations: string[] = [];
  const readyRows = rows.filter((row) => row.status === 'READY');
  if (readyRows.length < rows.length) {
    recommendations.push(
      'Complete all PENDING scenes first; keep scores as provisional with confidence bands.',
    );
  }

  const categoryAverages = {
    structure: avg(readyRows.map((row) => row.score.checklist.structure)),
    silhouette: avg(readyRows.map((row) => row.score.checklist.silhouette)),
    facadeMaterial: avg(
      readyRows.map((row) => row.score.checklist.facadeMaterial),
    ),
    roadSurface: avg(readyRows.map((row) => row.score.checklist.roadSurface)),
    streetFurniture: avg(
      readyRows.map((row) => row.score.checklist.streetFurniture),
    ),
    placeIdentity: avg(
      readyRows.map((row) => row.score.checklist.placeIdentity),
    ),
    atmosphere: avg(readyRows.map((row) => row.score.checklist.atmosphere)),
  };

  const sorted = [...Object.entries(categoryAverages)].sort(
    (a, b) => a[1] - b[1],
  );
  for (const [key, value] of sorted.slice(0, 2)) {
    recommendations.push(
      `Prioritize ${key} improvements first (current READY average: ${round(value)}).`,
    );
  }

  return recommendations;
}

function selectLatestSceneBase(files: string[], slug: string): string | null {
  const candidates = files
    .filter(
      (file) =>
        file.startsWith(`scene-${slug}-`) &&
        file.endsWith('.json') &&
        !file.endsWith('.meta.json') &&
        !file.endsWith('.detail.json') &&
        !file.endsWith('.mode-comparison.json'),
    )
    .sort();

  if (candidates.length === 0) {
    return null;
  }
  return candidates[candidates.length - 1]!.replace(/\.json$/, '');
}

async function readJson(path: string, optional = false): Promise<any | null> {
  try {
    const raw = await readFile(path, 'utf8');
    return JSON.parse(raw);
  } catch {
    if (optional) {
      return null;
    }
    throw new Error(`Failed to read JSON: ${path}`);
  }
}

function slugify(query: string): string {
  return query
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeCount(value: number, fullScoreAt: number): number {
  if (fullScoreAt <= 0) {
    return 0;
  }
  return clamp01(value / fullScoreAt);
}

function toNumber(value: unknown): number {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function round(value: number): number {
  return Number(value.toFixed(2));
}

function avg(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function emptyEvidence(): SceneQaRow['evidence'] {
  return {
    buildingCount: 0,
    roadCount: 0,
    walkwayCount: 0,
    crossingCount: 0,
    roadMarkingCount: 0,
    streetFurnitureCount: 0,
    materialClassCount: 0,
    landmarkAnchorCount: 0,
    districtProfileCount: 0,
    fallbackMassingRate: 1,
    selectedBuildingCoverage: 0,
    coreAreaBuildingCoverage: 0,
    heroLandmarkCoverage: 0,
  };
}

function printSummary(report: SceneQaReport, outputPath: string): void {
  console.log('\n=== Scene QA 8-table ===');
  console.log(`Output: ${outputPath}`);
  console.log(
    `Ready=${report.readyCount}, Pending=${report.pendingCount}, Failed=${report.failedCount}`,
  );
  console.log(`Average total score=${report.averageTotalScore}`);
  for (const row of report.rows) {
    console.log(
      `- ${row.placeId}: ${row.status}, score=${row.score.totalReported} [${row.score.confidenceBand.lower}-${row.score.confidenceBand.upper}], confidence=${row.confidence}`,
    );
  }
}

void main().catch((error: Error) => {
  console.error(error.stack ?? error.message);
  process.exit(1);
});
