import { join } from 'node:path';
import { AppLoggerService } from '../../../common/logging/app-logger.service';
import { appendSceneDiagnosticsLog, getSceneDataDir, writeFileAtomically } from '../../../scene/storage/scene-storage.utils';
import { buildSceneFidelityMetricsReport } from '../../../scene/utils/scene-fidelity-metrics.utils';
import { buildSceneModeComparisonReport } from '../../../scene/utils/scene-mode-comparison-report.utils';
import type { SceneAssetSelection } from '../../../scene/services/asset-profile';
import type { GlbInputContract } from './glb-build-contract';
import type { GlbGraphIntent, StageGraphIntent } from './glb-build-graph-intent';
import { buildFacadeColorDiversityMetrics } from './glb-build-style-metrics';
import { summarizeGraphIntents } from './glb-build-graph-intent';
import type { GroupedBuildings } from './glb-build-stage.types';
import type { SceneMeta } from '../../../scene/types/scene.types';
import type { MaterialReuseDiagnostics } from './glb-build-material-cache';

export interface FinalizeGlbBuildArgs {
  contract: GlbInputContract;
  adaptiveMeta: SceneMeta;
  outputPath: string;
  glbBinary: Uint8Array;
  buildStartedAt: number;
  runMetrics?: {
    pipelineMs?: number;
  };
  appLoggerService: AppLoggerService;
  assetSelection: SceneAssetSelection;
  groupedBuildings: GroupedBuildings;
  currentMeshDiagnostics: Array<Record<string, unknown>>;
  graphIntents: GlbGraphIntent[];
  stageGraphIntents: StageGraphIntent[];
  buildingClosureDiagnostics: unknown;
  materialTuning: Record<string, unknown>;
  facadeMaterialProfile: Record<string, unknown>;
  variationProfile: Record<string, unknown>;
  materialReuseDiagnostics?: MaterialReuseDiagnostics;
}

export async function finalizeGlbBuildArtifacts(
  args: FinalizeGlbBuildArgs,
): Promise<void> {
  const comparisonReport = buildSceneModeComparisonReport(
    args.adaptiveMeta,
    args.contract,
    {
      generationMs:
        (args.runMetrics?.pipelineMs ?? 0) +
        (Date.now() - args.buildStartedAt),
      glbBytes: args.glbBinary.byteLength,
    },
  );
  const facadeColorDiversity = buildFacadeColorDiversityMetrics(
    args.contract,
    args.groupedBuildings,
  );
  const strategyDistribution = resolveGeometryStrategyDistribution(
    args.contract.buildings,
  );
  const diagnosticsPayload = {
    sceneScoreReport: buildSceneFidelityMetricsReport(
      args.adaptiveMeta,
      args.contract,
    ),
    sceneModeComparisonReport: comparisonReport,
    assetSelection: {
      selected: args.assetSelection.selected,
      budget: args.assetSelection.budget,
    },
    structuralCoverage: args.adaptiveMeta.structuralCoverage,
    sourceDetail: {
      crossings: args.contract.crossings.length,
      roadMarkings: args.contract.roadMarkings.length,
      roadDecals: args.contract.roadDecals?.length ?? 0,
      facadeHints: args.contract.facadeHints.length,
      signageClusters: args.contract.signageClusters.length,
    },
    facadeContextDiagnostics: args.contract.facadeContextDiagnostics,
    groupedBuildingShells: [...args.groupedBuildings.entries()].map(
      ([groupKey, group]: [string, any]) => ({
        groupKey,
        materialClass: group.materialClass,
        bucket: group.bucket,
        colorHex: group.colorHex,
        count: group.buildings.length,
      }),
    ),
    buildingClosureDiagnostics: args.buildingClosureDiagnostics,
    geometryStrategyDistribution: strategyDistribution,
    meshNodes: args.currentMeshDiagnostics,
    facadeColorDiversity,
    graphIntentSummary: summarizeGraphIntents(
      args.graphIntents,
      args.stageGraphIntents,
    ),
    materialTuning: args.materialTuning,
    facadeMaterialProfile: args.facadeMaterialProfile,
    variationProfile: args.variationProfile,
    materialReuseDiagnostics: args.materialReuseDiagnostics,
    staticAtmosphere: args.contract.staticAtmosphere,
    sceneWideAtmosphereProfile: args.contract.sceneWideAtmosphereProfile,
    districtAtmosphereProfiles: args.contract.districtAtmosphereProfiles,
    extensionIntents: args.contract.extensionIntents,
    loadingHints: args.contract.loadingHints,
  };

  args.appLoggerService.info('scene.glb_build.diagnostics', {
    sceneId: args.contract.sceneId,
    step: 'glb_build',
    ...diagnosticsPayload,
  });
  await appendSceneDiagnosticsLog(
    args.contract.sceneId,
    'glb_build',
    diagnosticsPayload,
  );
  await appendSceneDiagnosticsLog(
    args.contract.sceneId,
    'mode_comparison',
    comparisonReport as unknown as Record<string, unknown>,
  );
  await writeFileAtomically(
    join(getSceneDataDir(), `${args.contract.sceneId}.mode-comparison.json`),
    JSON.stringify(comparisonReport, null, 2),
    'utf8',
  );
}

function resolveGeometryStrategyDistribution(
  buildings: GlbInputContract['buildings'],
): Record<string, { count: number; ratio: number }> {
  const total = Math.max(1, buildings.length);
  const counts: Record<string, number> = {};
  for (const building of buildings) {
    const strategy = building.geometryStrategy ?? 'simple_extrude';
    counts[strategy] = (counts[strategy] ?? 0) + 1;
  }
  const result: Record<string, { count: number; ratio: number }> = {};
  for (const [strategy, count] of Object.entries(counts)) {
    result[strategy] = {
      count,
      ratio: Number((count / total).toFixed(3)),
    };
  }
  return result;
}
