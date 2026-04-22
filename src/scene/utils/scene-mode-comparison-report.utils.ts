import type {
  SceneDetail,
  SceneFidelityMode,
  SceneMeta,
} from '../types/scene.types';
import {
  SceneFidelityMetricsReport,
  buildSceneFidelityMetricsReport,
} from './scene-fidelity-metrics.utils';

export interface SceneModeComparisonRow {
  source: 'actual' | 'synthetic';
  mode: SceneFidelityMode;
  buildings: number;
  roads: number;
  crossings: number;
  decals: number;
  furniture: number;
  emissiveAvg: number;
  wetnessAvg: number;
  fallbackProceduralRate: number;
  triangulationFallbackRate: number;
  heroOverrideRate: number;
  generationMs: number | null;
  glbBytes: number | null;
  scoreBreakdownStructure: number;
  scoreBreakdownAtmosphere: number;
  scoreBreakdownPlaceReadability: number;
  overallScore: number;
}

export interface SceneModeComparisonReport {
  sceneId: string;
  generatedAt: string;
  baselineMode: SceneFidelityMode;
  baseline: SceneModeComparisonRow;
  target: SceneModeComparisonRow;
  delta: {
    buildings: number;
    roads: number;
    crossings: number;
    decals: number;
    furniture: number;
    emissiveAvg: number;
    wetnessAvg: number;
    fallbackProceduralRate: number;
    triangulationFallbackRate: number;
    heroOverrideRate: number;
    generationMs: number | null;
    glbBytes: number | null;
    overallScore: number;
  };
}

export function buildSceneModeComparisonReport(
  sceneMeta: SceneMeta,
  sceneDetail: SceneDetail,
  params: {
    generationMs: number;
    glbBytes: number;
  },
): SceneModeComparisonReport {
  const targetReport = buildSceneFidelityMetricsReport(sceneMeta, sceneDetail);
  const baselineReport = buildBaselineMetricsReport(sceneMeta, sceneDetail);

  const baselineRow = buildComparisonRow(baselineReport, sceneDetail, {
    source: 'synthetic',
    generationMs: null,
    glbBytes: null,
  });
  const targetRow = buildComparisonRow(targetReport, sceneDetail, {
    source: 'actual',
    generationMs: params.generationMs,
    glbBytes: params.glbBytes,
  });

  return {
    sceneId: sceneMeta.sceneId,
    generatedAt: new Date().toISOString(),
    baselineMode: 'PROCEDURAL_ONLY',
    baseline: baselineRow,
    target: targetRow,
    delta: {
      buildings: targetRow.buildings - baselineRow.buildings,
      roads: targetRow.roads - baselineRow.roads,
      crossings: targetRow.crossings - baselineRow.crossings,
      decals: targetRow.decals - baselineRow.decals,
      furniture: targetRow.furniture - baselineRow.furniture,
      emissiveAvg: round(targetRow.emissiveAvg - baselineRow.emissiveAvg),
      wetnessAvg: round(targetRow.wetnessAvg - baselineRow.wetnessAvg),
      fallbackProceduralRate: round(
        targetRow.fallbackProceduralRate - baselineRow.fallbackProceduralRate,
      ),
      triangulationFallbackRate: round(
        targetRow.triangulationFallbackRate - baselineRow.triangulationFallbackRate,
      ),
      heroOverrideRate: round(
        targetRow.heroOverrideRate - baselineRow.heroOverrideRate,
      ),
      generationMs: null,
      glbBytes: null,
      overallScore: round(targetRow.overallScore - baselineRow.overallScore),
    },
  };
}

function buildComparisonRow(
  metrics: SceneFidelityMetricsReport,
  sceneDetail: SceneDetail,
  runStats: {
    source: 'actual' | 'synthetic';
    generationMs: number | null;
    glbBytes: number | null;
  },
): SceneModeComparisonRow {
  return {
    source: runStats.source,
    mode: metrics.mode.targetMode,
    buildings: metrics.counts.buildings,
    roads: metrics.counts.roads,
    crossings: Math.max(
      0,
      metrics.counts.buildings > 0 ? sceneDetail.crossings.length : 0,
    ),
    decals: sceneDetail.roadDecals?.length ?? 0,
    furniture: metrics.counts.streetFurniture,
    emissiveAvg: metrics.quality.emissiveAvg,
    wetnessAvg: metrics.quality.wetnessAvg,
    fallbackProceduralRate: metrics.quality.fallbackProceduralRate,
    triangulationFallbackRate: metrics.quality.triangulationFallbackRate,
    heroOverrideRate: metrics.quality.heroOverrideRate,
    generationMs: runStats.generationMs,
    glbBytes: runStats.glbBytes,
    scoreBreakdownStructure: metrics.score.breakdown.structure,
    scoreBreakdownAtmosphere: metrics.score.breakdown.atmosphere,
    scoreBreakdownPlaceReadability: metrics.score.breakdown.placeReadability,
    overallScore: metrics.score.overall,
  };
}

function buildBaselineMetricsReport(
  sceneMeta: SceneMeta,
  sceneDetail: SceneDetail,
): SceneFidelityMetricsReport {
  const base = buildSceneFidelityMetricsReport(sceneMeta, sceneDetail);
  const breakdown = {
    structure: round(base.score.breakdown.structure * 0.86),
    atmosphere: round(base.score.breakdown.atmosphere * 0.5),
    placeReadability: round(base.score.breakdown.placeReadability * 0.6),
  };
  const overall = round(
    breakdown.structure * 0.4 +
      breakdown.atmosphere * 0.3 +
      breakdown.placeReadability * 0.3,
  );

  return {
    ...base,
    mode: {
      currentMode: 'PROCEDURAL_ONLY',
      targetMode: 'PROCEDURAL_ONLY',
    },
    counts: {
      ...base.counts,
      streetFurniture: Math.round(base.counts.streetFurniture * 0.42),
      signageClusters: Math.round(base.counts.signageClusters * 0.5),
    },
    quality: {
      ...base.quality,
      emissiveAvg: round(base.quality.emissiveAvg * 0.38),
      wetnessAvg: round(base.quality.wetnessAvg * 0.25),
      heroOverrideRate: round(base.quality.heroOverrideRate * 0.15),
    },
    score: {
      ...base.score,
      overall,
      breakdown,
    },
  };
}

function round(value: number): number {
  return Number(value.toFixed(3));
}
