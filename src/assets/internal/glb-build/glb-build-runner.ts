import { Injectable } from '@nestjs/common';
import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { AppLoggerService } from '../../../common/logging/app-logger.service';
import { appMetrics } from '../../../common/metrics/metrics.instance';
import {
  createEnhancedSceneMaterials,
  MaterialTuningOptions,
} from '../../compiler/materials';
import {
  appendSceneDiagnosticsLog,
  getSceneDataDir,
  writeFileAtomically,
} from '../../../scene/storage/scene-storage.utils';
import {
  SceneAssetProfileService,
  type SceneAssetSelection,
} from '../../../scene/services/asset-profile';
import type { SceneDetail, SceneMeta } from '../../../scene/types/scene.types';
import { addTransportMeshes } from './stages/glb-build-transport.stage';
import { addStreetContextMeshes } from './stages/glb-build-street-context.stage';
import {
  addBuildingAndHeroMeshes,
  buildGroupedBuildingShells,
  collectBuildingClosureDiagnostics,
} from './stages/glb-build-building-hero.stage';
import {
  createBuildingRoofAccentGeometry,
  createLandCoverGeometry,
  createLinearFeatureGeometry,
  createPoiGeometry,
  createStreetFurnitureGeometry,
} from './geometry/glb-build-local-geometry.utils';
import { triangulateRings as triangulateRingsUtil } from './geometry/glb-build-geometry-primitives.utils';
import { resolveMaterialTuningFromScene } from './glb-build-material-tuning.utils';
import { resolveSceneVariationProfile } from './glb-build-variation.utils';
import { resolveFacadeLayerMaterialProfile } from './glb-build-facade-material-profile.utils';
import { resolveSceneModePolicy } from '../../../scene/utils/scene-mode-policy.utils';
import { buildSceneFidelityMetricsReport } from '../../../scene/utils/scene-fidelity-metrics.utils';
import { buildSceneModeComparisonReport } from '../../../scene/utils/scene-mode-comparison-report.utils';
import {
  MaterialCacheStats,
  installMaterialCache,
} from './glb-build-material-cache';
import {
  enforceSizeBudget,
  type GlbSimplifyOptions,
  loadMeshoptimizerModule,
  optimizeGlbDocument,
  registerNodeIoExtensions,
  validateGlb,
} from './glb-build-runner.helpers';
import {
  initializeDccHierarchy,
  registerBuildingGroupNodes,
} from './glb-build-hierarchy';
import {
  MeshNodeDiagnostic,
  MeshSemanticTrace,
  TriangleBudgetState,
  addMeshNode,
} from './glb-build-mesh-node';
import {
  buildFacadeColorDiversityMetrics,
  buildGroupedBuildingShellsLocal,
  groupFacadeHintsByPanelColorLocal,
  groupBillboardClustersByColorLocal,
  resolveWindowMaterialTone,
  resolveHeroToneFromBuildings,
} from './glb-build-style-metrics';
import {
  createGraphIntent,
  StageGraphIntent,
  summarizeGraphIntents,
} from './glb-build-graph-intent';
import { createCrosswalkGeometry } from './glb-build-utils';
import type { GlbInputContract } from './glb-build-contract';

interface BuildingClosureDiagnosticsMetrics {
  openShellCount: number;
  roofWallGapCount: number;
  invalidSetbackJoinCount: number;
}

const GLB_VALIDATOR_ERROR_SEVERITY = 0;
const GLB_VALIDATION_DETAIL_LIMIT = 8;
const GLB_VALIDATOR_SEVERITY_OVERRIDES: Record<string, number> = {
  NON_OBJECT_EXTRAS: GLB_VALIDATOR_ERROR_SEVERITY,
  EXTRA_PROPERTY: GLB_VALIDATOR_ERROR_SEVERITY,
  UNDECLARED_EXTENSION: GLB_VALIDATOR_ERROR_SEVERITY,
  UNEXPECTED_EXTENSION_OBJECT: GLB_VALIDATOR_ERROR_SEVERITY,
  UNUSED_EXTENSION_REQUIRED: GLB_VALIDATOR_ERROR_SEVERITY,
};

const GLB_QUANTIZE_OPTIONS: Record<string, unknown> = {
  quantizeTexcoord: 12,
  quantizeColor: 8,
  quantizeGeneric: 12,
  cleanup: false,
};

const GLB_INSTANCE_OPTIONS: Record<string, unknown> = {
  min: 5,
};

const GLB_SIZE_TARGET_MAX_BYTES = 30 * 1024 * 1024;

const DEFAULT_GLB_SIMPLIFY_OPTIONS: GlbSimplifyOptions = {
  ratio: 0.75,
  error: 0.001,
  lockBorder: false,
};

const GLB_SIMPLIFY_RATIO_RANGE = {
  min: 0,
  max: 1,
} as const;

const GLB_SIMPLIFY_ERROR_RANGE = {
  min: 0.0001,
  max: 1,
} as const;

const ENV_GLB_OPTIMIZE_SIMPLIFY_ENABLED = 'GLB_OPTIMIZE_SIMPLIFY_ENABLED';
const ENV_GLB_OPTIMIZE_SIMPLIFY_RATIO = 'GLB_OPTIMIZE_SIMPLIFY_RATIO';
const ENV_GLB_OPTIMIZE_SIMPLIFY_ERROR = 'GLB_OPTIMIZE_SIMPLIFY_ERROR';
const ENV_GLB_OPTIMIZE_SIMPLIFY_LOCK_BORDER =
  'GLB_OPTIMIZE_SIMPLIFY_LOCK_BORDER';

@Injectable()
export class GlbBuildRunner {
  private currentMeshDiagnostics: MeshNodeDiagnostic[] = [];
  private readonly appLoggerService: AppLoggerService;
  private readonly sceneAssetProfileService: SceneAssetProfileService;
  private materialCacheStats: MaterialCacheStats = { hits: 0, misses: 0 };
  private semanticGroupNodes = new Map<string, unknown>();
  private graphIntents: Array<ReturnType<typeof createGraphIntent>> = [];
  private stageGraphIntents: StageGraphIntent[] = [];
  private triangleBudget: TriangleBudgetState = {
    totalTriangleBudget: 2_500_000,
    totalTriangleCount: 0,
    protectedTriangleCount: 0,
    protectedTriangleReserve: 180_000,
    budgetProtectedMeshNames: new Set<string>([
      'road_base',
      'road_edges',
      'road_markings',
      'lane_overlay',
      'crosswalk_overlay',
      'junction_overlay',
      'building_windows',
      'building_roof_surfaces_cool',
      'building_roof_surfaces_warm',
      'building_roof_surfaces_neutral',
      'building_roof_accents_cool',
      'building_roof_accents_warm',
      'building_roof_accents_neutral',
      'building_entrances',
      'building_roof_equipment',
      'traffic_lights',
      'street_lights',
      'sign_poles',
    ]),
    budgetProtectedMeshPrefixes: ['building_panels_', 'building_shells_'],
  };

  constructor(
    appLoggerService: AppLoggerService,
    sceneAssetProfileService: SceneAssetProfileService,
  ) {
    this.appLoggerService = appLoggerService;
    this.sceneAssetProfileService = sceneAssetProfileService;
  }

  async build(
    contract: GlbInputContract,
    runMetrics?: {
      pipelineMs?: number;
    },
  ): Promise<string> {
    const buildStartedAt = Date.now();
    this.triangleBudget.totalTriangleCount = 0;
    this.triangleBudget.protectedTriangleCount = 0;
    this.materialCacheStats = { hits: 0, misses: 0 };
    this.semanticGroupNodes.clear();
    const gltf = await import('@gltf-transform/core');
    const transformFunctionsModule = await import('@gltf-transform/functions');
    const meshoptimizerModule = await loadMeshoptimizerModule();
    const earcutModule = await import('earcut');
    const validatorModule = await import('gltf-validator');
    const triangulate = earcutModule.default;
    const { Accessor, Document, NodeIO } = gltf;
    const doc = new Document();
    const materialTuning = this.resolveMaterialTuning(contract);
    installMaterialCache(
      doc as unknown as Record<string, unknown>,
      contract.sceneId,
      this.materialCacheStats,
      buildMaterialTuningSignature(materialTuning),
    );
    const buffer = doc.createBuffer('scene-buffer');
    const scene = doc.createScene(contract.sceneId);
    initializeDccHierarchy(
      doc as unknown as Record<string, unknown>,
      scene as unknown as Record<string, unknown>,
      contract.sceneId,
      this.semanticGroupNodes,
    );
    registerBuildingGroupNodes(
      doc as unknown as Record<string, unknown>,
      scene as unknown as Record<string, unknown>,
      contract,
      this.semanticGroupNodes,
    );
    this.currentMeshDiagnostics = [];
    this.stageGraphIntents = [];
    this.graphIntents = [];

    const assetSelection = contract.assetSelection;
    const adaptiveMeta =
      this.sceneAssetProfileService.buildSceneMetaWithAssetSelection(
        contract,
        assetSelection,
      );
    const modePolicy = resolveSceneModePolicy(
      contract.fidelityPlan?.targetMode,
      contract.fidelityPlan?.currentMode,
    );
    const variationProfile = this.resolveVariationProfile(contract);
    const facadeMaterialProfile = this.resolveFacadeMaterialProfile(contract);
    const materials = createEnhancedSceneMaterials(
      doc,
      materialTuning,
      facadeMaterialProfile,
    );

    this.appLoggerService.info('scene.glb_build.material_tuning', {
      sceneId: contract.sceneId,
      step: 'glb_build',
      tuning: materialTuning,
      variationProfile,
      modePolicy: modePolicy.id,
      staticAtmosphere: contract.staticAtmosphere?.preset ?? 'DAY_CLEAR',
      materialCache: {
        hits: this.materialCacheStats.hits,
        misses: this.materialCacheStats.misses,
      },
    });

    const addMeshNodeBound = (
      docParam: unknown,
      AccessorRef: unknown,
      sceneParam: unknown,
      bufferParam: unknown,
      name: string,
      geometry: unknown,
      material: unknown,
      trace: MeshSemanticTrace = {},
    ) => {
      this.graphIntents.push(createGraphIntent(name, trace));
      return addMeshNode(
        docParam as Record<string, unknown>,
        AccessorRef as Record<string, unknown>,
        sceneParam as Record<string, unknown>,
        bufferParam,
        name,
        geometry as import('../../compiler/road').GeometryBuffers,
        material,
        trace,
        this.currentMeshDiagnostics,
        this.triangleBudget,
        this.semanticGroupNodes,
      );
    };

    addTransportMeshes(
      {
        addMeshNode: addMeshNodeBound,
        collectGraphIntent: (intent) => {
          this.stageGraphIntents.push(intent);
        },
        createCrosswalkGeometry,
        triangulateRings: triangulateRingsUtil,
        modePolicy,
      },
      { doc, Accessor, scene, buffer },
      contract,
      contract,
      assetSelection,
      materials,
      triangulate,
    );

    addStreetContextMeshes(
      {
        addMeshNode: addMeshNodeBound,
        collectGraphIntent: (intent) => {
          this.stageGraphIntents.push(intent);
        },
        createStreetFurnitureGeometry,
        createPoiGeometry,
        createLandCoverGeometry,
        variationProfile,
        modePolicy,
        createLinearFeatureGeometry,
      },
      { doc, Accessor, scene, buffer },
      contract,
      contract,
      assetSelection,
      materials,
      triangulate,
    );

    const groupedBuildings = buildGroupedBuildingShells(
      {
        buildGroupedBuildingShells: (
          sceneMeta: SceneMeta,
          sceneDetail: SceneDetail,
          assetSelection: SceneAssetSelection,
        ) => {
          void sceneMeta;
          return buildGroupedBuildingShellsLocal(sceneDetail, assetSelection);
        },
      },
      contract,
      contract,
      assetSelection,
    );

    const buildingClosureDiagnostics = this.collectBuildingClosureDiagnostics(
      contract,
      assetSelection,
    );

    addBuildingAndHeroMeshes(
      {
        addMeshNode: addMeshNodeBound,
        collectGraphIntent: (intent) => {
          this.stageGraphIntents.push(intent);
        },
        groupFacadeHintsByPanelColor: groupFacadeHintsByPanelColorLocal,
        groupBillboardClustersByColor: groupBillboardClustersByColorLocal,
        resolveWindowMaterialTone: resolveWindowMaterialTone,
        resolveHeroToneFromBuildings: resolveHeroToneFromBuildings,
        materialTuning,
        facadeMaterialProfile,
        variationProfile,
        modePolicy,
        staticAtmosphere: contract.staticAtmosphere,
        createBuildingRoofAccentGeometry,
      },
      { doc, Accessor, scene, buffer },
      contract,
      contract,
      assetSelection,
      materials,
      triangulate,
      groupedBuildings,
    );

    const outputPath = join(getSceneDataDir(), `${contract.sceneId}.glb`);
    await mkdir(dirname(outputPath), { recursive: true });

    await optimizeGlbDocument(
      doc,
      contract.sceneId,
      transformFunctionsModule,
      meshoptimizerModule?.MeshoptSimplifier,
      this.appLoggerService,
      this.resolveSimplifyOptionsFromEnv(),
      {
        quantizeOptions: GLB_QUANTIZE_OPTIONS,
        instanceOptions: GLB_INSTANCE_OPTIONS,
      },
    );

    const io = new NodeIO();
    await registerNodeIoExtensions(io, contract.sceneId, this.appLoggerService);
    let glbBinary = await io.writeBinary(doc);
    if (glbBinary.byteLength > GLB_SIZE_TARGET_MAX_BYTES) {
      this.appLoggerService.warn('scene.glb_build.size_budget_retry', {
        sceneId: contract.sceneId,
        step: 'glb_build',
        glbBytes: glbBinary.byteLength,
        targetBytes: GLB_SIZE_TARGET_MAX_BYTES,
      });
      await optimizeGlbDocument(
        doc,
        contract.sceneId,
        transformFunctionsModule,
        meshoptimizerModule?.MeshoptSimplifier,
        this.appLoggerService,
        this.resolveSimplifyOptionsFromEnv(),
        {
          quantizeOptions: GLB_QUANTIZE_OPTIONS,
          instanceOptions: GLB_INSTANCE_OPTIONS,
        },
        {
          simplify: {
            enabled: true,
            options: {
              ratio: 0.55,
              error: 0.002,
              lockBorder: false,
            },
          },
          disableInstance: true,
          reason: 'size_budget_retry',
        },
      );
      glbBinary = await io.writeBinary(doc);
    }
    enforceSizeBudget(glbBinary.byteLength, contract.sceneId, GLB_SIZE_TARGET_MAX_BYTES);
    await validateGlb(
      Uint8Array.from(glbBinary),
      contract.sceneId,
      validatorModule,
      {
        severityOverrides: GLB_VALIDATOR_SEVERITY_OVERRIDES,
        detailLimit: GLB_VALIDATION_DETAIL_LIMIT,
      },
    );
    await writeFileAtomically(outputPath, glbBinary);
    appMetrics.observeDuration(
      'glb_build_duration_ms',
      Date.now() - buildStartedAt,
      { outcome: 'success' },
      'GLB build duration in milliseconds.',
    );
    appMetrics.setGauge(
      'glb_build_bytes',
      glbBinary.byteLength,
      {},
      'Latest GLB binary size in bytes.',
    );

    const comparisonReport = buildSceneModeComparisonReport(
      adaptiveMeta,
      contract,
      {
        generationMs:
          (runMetrics?.pipelineMs ?? 0) + (Date.now() - buildStartedAt),
        glbBytes: glbBinary.byteLength,
      },
    );

    const facadeColorDiversity = buildFacadeColorDiversityMetrics(
      contract,
      groupedBuildings,
    );

    const diagnosticsPayload = {
      sceneScoreReport: buildSceneFidelityMetricsReport(adaptiveMeta, contract),
      sceneModeComparisonReport: comparisonReport,
      modePolicy,
      assetSelection: {
        selected: assetSelection.selected,
        budget: assetSelection.budget,
      },
      structuralCoverage: adaptiveMeta.structuralCoverage,
      sourceDetail: {
        crossings: contract.crossings.length,
        roadMarkings: contract.roadMarkings.length,
        roadDecals: contract.roadDecals?.length ?? 0,
        facadeHints: contract.facadeHints.length,
        signageClusters: contract.signageClusters.length,
      },
      facadeContextDiagnostics: contract.facadeContextDiagnostics,
      groupedBuildingShells: [...groupedBuildings.entries()].map(
        ([groupKey, group]) => ({
          groupKey,
          materialClass: group.materialClass,
          bucket: group.bucket,
          colorHex: group.colorHex,
          count: group.buildings.length,
        }),
      ),
      buildingClosureDiagnostics,
      meshNodes: this.currentMeshDiagnostics,
      facadeColorDiversity,
      graphIntentSummary: summarizeGraphIntents(
        this.graphIntents,
        this.stageGraphIntents,
      ),
      materialTuning,
      facadeMaterialProfile,
      variationProfile,
      staticAtmosphere: contract.staticAtmosphere,
      sceneWideAtmosphereProfile: contract.sceneWideAtmosphereProfile,
      districtAtmosphereProfiles: contract.districtAtmosphereProfiles,
      extensionIntents: contract.extensionIntents,
      loadingHints: contract.loadingHints,
    };

    this.appLoggerService.info('scene.glb_build.diagnostics', {
      sceneId: contract.sceneId,
      step: 'glb_build',
      ...diagnosticsPayload,
    });
    await appendSceneDiagnosticsLog(
      contract.sceneId,
      'glb_build',
      diagnosticsPayload,
    );
    await appendSceneDiagnosticsLog(
      contract.sceneId,
      'mode_comparison',
      comparisonReport as unknown as Record<string, unknown>,
    );
    await writeFileAtomically(
      join(getSceneDataDir(), `${contract.sceneId}.mode-comparison.json`),
      JSON.stringify(comparisonReport, null, 2),
      'utf8',
    );

    return outputPath;
  }

  private collectBuildingClosureDiagnostics(
    adaptiveMeta: GlbInputContract,
    assetSelection: GlbInputContract['assetSelection'],
  ): BuildingClosureDiagnosticsMetrics {
    return collectBuildingClosureDiagnostics(
      adaptiveMeta,
      assetSelection.buildings,
    );
  }

  private resolveMaterialTuning(
    contract: GlbInputContract,
  ): MaterialTuningOptions {
    return resolveMaterialTuningFromScene(
      contract.facadeHints,
      contract.staticAtmosphere,
      contract.fidelityPlan?.targetMode,
    );
  }

  private resolveVariationProfile(contract: GlbInputContract) {
    return resolveSceneVariationProfile(contract, contract);
  }

  private resolveFacadeMaterialProfile(contract: GlbInputContract) {
    return resolveFacadeLayerMaterialProfile(contract, contract);
  }

  private resolveSimplifyOptionsFromEnv(): {
    enabled: boolean;
    options: GlbSimplifyOptions;
  } {
    const enabled = this.parseBooleanEnv(
      process.env[ENV_GLB_OPTIMIZE_SIMPLIFY_ENABLED],
      true,
    );
    const ratio = this.parseNumericEnv(
      process.env[ENV_GLB_OPTIMIZE_SIMPLIFY_RATIO],
      DEFAULT_GLB_SIMPLIFY_OPTIONS.ratio,
      GLB_SIMPLIFY_RATIO_RANGE.min,
      GLB_SIMPLIFY_RATIO_RANGE.max,
    );
    const error = this.parseNumericEnv(
      process.env[ENV_GLB_OPTIMIZE_SIMPLIFY_ERROR],
      DEFAULT_GLB_SIMPLIFY_OPTIONS.error,
      GLB_SIMPLIFY_ERROR_RANGE.min,
      GLB_SIMPLIFY_ERROR_RANGE.max,
    );
    const lockBorder = this.parseBooleanEnv(
      process.env[ENV_GLB_OPTIMIZE_SIMPLIFY_LOCK_BORDER],
      DEFAULT_GLB_SIMPLIFY_OPTIONS.lockBorder,
    );

    return {
      enabled,
      options: {
        ratio,
        error,
        lockBorder,
      },
    };
  }

  private parseBooleanEnv(
    rawValue: string | undefined,
    fallback: boolean,
  ): boolean {
    const normalized = rawValue?.trim().toLowerCase();
    if (!normalized) {
      return fallback;
    }

    if (['1', 'true', 'yes', 'on'].includes(normalized)) {
      return true;
    }
    if (['0', 'false', 'no', 'off'].includes(normalized)) {
      return false;
    }

    return fallback;
  }

  private parseNumericEnv(
    rawValue: string | undefined,
    fallback: number,
    min: number,
    max: number,
  ): number {
    const normalized = rawValue?.trim();
    if (!normalized) {
      return fallback;
    }

    const parsed = Number.parseFloat(normalized);
    if (!Number.isFinite(parsed)) {
      return fallback;
    }

    return clampRange(parsed, min, max);
  }

}

function clampRange(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function buildMaterialTuningSignature(
  tuningOptions: MaterialTuningOptions,
): string {
  const normalized = {
    shellLuminanceCap: tuningOptions.shellLuminanceCap,
    panelLuminanceCap: tuningOptions.panelLuminanceCap,
    billboardLuminanceCap: tuningOptions.billboardLuminanceCap,
    emissiveBoost: tuningOptions.emissiveBoost,
    roadRoughnessScale: tuningOptions.roadRoughnessScale,
    wetRoadBoost: tuningOptions.wetRoadBoost,
    overlayDepthBias: tuningOptions.overlayDepthBias,
    weakEvidenceRatio: tuningOptions.weakEvidenceRatio,
    enableTexturePath: tuningOptions.enableTexturePath,
    inferenceReasonCodes: [...(tuningOptions.inferenceReasonCodes ?? [])].sort(),
    textureSlots: normalizeTextureSlots(tuningOptions.textureSlots),
  };

  return JSON.stringify(normalized);
}

function normalizeTextureSlots(
  textureSlots: MaterialTuningOptions['textureSlots'],
): Record<string, unknown> {
  if (!textureSlots) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(textureSlots)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([slot, value]) => [
        slot,
        value
          ? {
              uri: value.uri,
              mimeType: value.mimeType ?? null,
              sampler: value.sampler
                ? {
                    magFilter: value.sampler.magFilter ?? null,
                    minFilter: value.sampler.minFilter ?? null,
                    wrapS: value.sampler.wrapS ?? null,
                    wrapT: value.sampler.wrapT ?? null,
                  }
                : null,
            }
          : null,
      ]),
  );
}
