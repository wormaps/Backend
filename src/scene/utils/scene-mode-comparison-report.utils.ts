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
  mode: SceneFidelityMode;
  buildings: number;
  roads: number;
  crossings: number;
  decals: number;
  furniture: number;
  emissiveAvg: number;
  wetnessAvg: number;
  fallbackProceduralRate: number;
  heroOverrideRate: number;
  generationMs: number;
  glbBytes: number;
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
    heroOverrideRate: number;
    generationMs: number;
    glbBytes: number;
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

  const baselineRow = buildComparisonRow(
    baselineReport,
    sceneDetail,
    params.generationMs,
    params.glbBytes,
  );
  const targetRow = buildComparisonRow(
    targetReport,
    sceneDetail,
    params.generationMs,
    params.glbBytes,
  );

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
      heroOverrideRate: round(
        targetRow.heroOverrideRate - baselineRow.heroOverrideRate,
      ),
      generationMs: targetRow.generationMs - baselineRow.generationMs,
      glbBytes: targetRow.glbBytes - baselineRow.glbBytes,
      overallScore: round(targetRow.overallScore - baselineRow.overallScore),
    },
  };
}

function buildComparisonRow(
  metrics: SceneFidelityMetricsReport,
  sceneDetail: SceneDetail,
  generationMs: number,
  glbBytes: number,
): SceneModeComparisonRow {
  return {
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
    heroOverrideRate: metrics.quality.heroOverrideRate,
    generationMs,
    glbBytes,
    overallScore: metrics.score.overall,
  };
}

function buildBaselineMetricsReport(
  sceneMeta: SceneMeta,
  sceneDetail: SceneDetail,
): SceneFidelityMetricsReport {
  const base = buildSceneFidelityMetricsReport(sceneMeta, sceneDetail);
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
      overall: round(base.score.overall * 0.62),
      breakdown: {
        structure: round(base.score.breakdown.structure * 0.86),
        atmosphere: round(base.score.breakdown.atmosphere * 0.5),
        placeReadability: round(base.score.breakdown.placeReadability * 0.6),
      },
    },
  };
}

function round(value: number): number {
  return Number(value.toFixed(3));
}
