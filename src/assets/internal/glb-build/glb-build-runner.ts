import { Injectable } from '@nestjs/common';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { AppLoggerService } from '../../../common/logging/app-logger.service';
import {
  createEnhancedSceneMaterials,
  MaterialTuningOptions,
} from '../../compiler/materials';
import {
  appendSceneDiagnosticsLog,
  getSceneDataDir,
} from '../../../scene/storage/scene-storage.utils';
import { SceneAssetProfileService } from '../../../scene/services/asset-profile';
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
import { createPrototypeRegistry } from './glb-build-prototype.registry';
import { createCrosswalkGeometry } from './glb-build-utils';
import type { GlbInputContract } from './glb-build-contract';

interface BuildingClosureDiagnosticsMetrics {
  openShellCount: number;
  roofWallGapCount: number;
  invalidSetbackJoinCount: number;
}

interface GlbSimplifyOptions {
  ratio: number;
  error: number;
  lockBorder: boolean;
}

interface GlbTransformFunctionsModule {
  prune: (options?: Record<string, unknown>) => unknown;
  dedup: (options?: Record<string, unknown>) => unknown;
  instance?: (options?: Record<string, unknown>) => unknown;
  simplify?: (options: {
    simplifier: unknown;
    ratio?: number;
    error?: number;
    lockBorder?: boolean;
  }) => unknown;
  weld: (options?: Record<string, unknown>) => unknown;
  quantize: (options?: Record<string, unknown>) => unknown;
}

interface TransformableGlbDocument {
  transform: (...transforms: unknown[]) => Promise<void>;
}

interface GlbValidatorIssue {
  code?: string;
  message?: string;
  pointer?: string;
}

interface GlbValidatorReport {
  truncated?: boolean;
  issues?: {
    truncated?: boolean;
    numErrors?: number;
    numWarnings?: number;
    numInfos?: number;
    numHints?: number;
    messages?: GlbValidatorIssue[];
  };
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
  pattern: /^(?!POSITION$|NORMAL$)/,
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
  private readonly sceneAssetProfileService = new SceneAssetProfileService();
  private materialCacheStats: MaterialCacheStats = { hits: 0, misses: 0 };
  private semanticGroupNodes = new Map<string, unknown>();
  private graphIntents: Array<ReturnType<typeof createGraphIntent>> = [];
  private stageGraphIntents: StageGraphIntent[] = [];
  private prototypeRegistry = createPrototypeRegistry();
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
    private readonly appLoggerService: AppLoggerService = new AppLoggerService(),
  ) {}

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
    const meshoptimizerModule = await this.loadMeshoptimizerModule();
    const earcutModule = await import('earcut');
    const validatorModule = await import('gltf-validator');
    const triangulate = earcutModule.default;
    const { Accessor, Document, NodeIO } = gltf;
    const doc = new Document();
    installMaterialCache(
      doc as unknown as Record<string, unknown>,
      contract.sceneId,
      this.materialCacheStats,
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
    this.prototypeRegistry = createPrototypeRegistry();

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
    const materialTuning = this.resolveMaterialTuning(contract);
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
        prototypeRegistry: this.prototypeRegistry,
        createCrosswalkGeometry: createCrosswalkGeometry.bind(this),
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
        prototypeRegistry: this.prototypeRegistry,
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
          assetSelection: GlbInputContract['assetSelection'],
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
        prototypeRegistry: this.prototypeRegistry,
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

    await this.optimizeGlbDocument(
      doc,
      contract.sceneId,
      transformFunctionsModule,
      meshoptimizerModule?.MeshoptSimplifier,
    );

    const io = new NodeIO();
    await this.registerNodeIoExtensions(io, contract.sceneId);
    let glbBinary = await io.writeBinary(doc);
    if (glbBinary.byteLength > GLB_SIZE_TARGET_MAX_BYTES) {
      this.appLoggerService.warn('scene.glb_build.size_budget_retry', {
        sceneId: contract.sceneId,
        step: 'glb_build',
        glbBytes: glbBinary.byteLength,
        targetBytes: GLB_SIZE_TARGET_MAX_BYTES,
      });
      await this.optimizeGlbDocument(
        doc,
        contract.sceneId,
        transformFunctionsModule,
        meshoptimizerModule?.MeshoptSimplifier,
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
    this.enforceSizeBudget(glbBinary.byteLength, contract.sceneId);
    await this.validateGlb(
      Uint8Array.from(glbBinary),
      contract.sceneId,
      validatorModule,
    );
    await writeFile(outputPath, glbBinary);

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
      prototypeSummary: this.prototypeRegistry.snapshot(),
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
    await writeFile(
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

  private async optimizeGlbDocument(
    doc: unknown,
    sceneId: string,
    transformModule: GlbTransformFunctionsModule,
    simplifyMeshoptSimplifier?: unknown,
    controls?: {
      simplify?: {
        enabled: boolean;
        options: GlbSimplifyOptions;
      };
      disableInstance?: boolean;
      reason?: string;
    },
  ): Promise<void> {
    const transformableDoc = doc as TransformableGlbDocument;
    if (typeof transformableDoc.transform !== 'function') {
      return;
    }

    const baseTransforms: unknown[] = [
      transformModule.prune({
        keepExtras: true,
        keepLeaves: true,
        keepAttributes: true,
      }),
      transformModule.dedup({
        keepUniqueNames: true,
      }),
    ];
    const tailTransforms: unknown[] = [
      transformModule.weld(),
      transformModule.quantize(GLB_QUANTIZE_OPTIONS),
    ];
    const simplifyConfig =
      controls?.simplify ?? this.resolveSimplifyOptionsFromEnv();
    let supportsInstance = false;
    let supportsSimplify = false;
    let simplifyTransform: unknown;
    let transforms = [...baseTransforms, ...tailTransforms];
    if (
      !controls?.disableInstance &&
      typeof transformModule.instance === 'function'
    ) {
      try {
        const instanceTransform =
          transformModule.instance(GLB_INSTANCE_OPTIONS);
        if (instanceTransform) {
          supportsInstance = true;
          transforms = [
            ...baseTransforms,
            instanceTransform,
            ...tailTransforms,
          ];
        }
      } catch (instanceFactoryError) {
        this.appLoggerService.warn(
          'scene.glb_build.optimize_instance_skipped',
          {
            sceneId,
            step: 'glb_build',
            reason:
              instanceFactoryError instanceof Error
                ? instanceFactoryError.message
                : String(instanceFactoryError),
            fallbackTransforms: ['prune', 'dedup', 'weld', 'quantize'],
            phase: 'instance_factory',
          },
        );
      }
    }
    if (!simplifyConfig.enabled) {
      this.appLoggerService.info('scene.glb_build.optimize_simplify_disabled', {
        sceneId,
        step: 'glb_build',
        env: ENV_GLB_OPTIMIZE_SIMPLIFY_ENABLED,
      });
    } else if (typeof transformModule.simplify === 'function') {
      if (!simplifyMeshoptSimplifier) {
        this.appLoggerService.warn(
          'scene.glb_build.optimize_simplify_skipped',
          {
            sceneId,
            step: 'glb_build',
            reason: 'meshopt_simplifier_unavailable',
            fallbackTransforms: [
              'prune',
              'dedup',
              'instance?',
              'weld',
              'quantize',
            ],
            phase: 'simplify_factory',
          },
        );
      } else {
        try {
          simplifyTransform = transformModule.simplify({
            simplifier: simplifyMeshoptSimplifier,
            ratio: simplifyConfig.options.ratio,
            error: simplifyConfig.options.error,
            lockBorder: simplifyConfig.options.lockBorder,
          });
          supportsSimplify = Boolean(simplifyTransform);
        } catch (simplifyFactoryError) {
          this.appLoggerService.warn(
            'scene.glb_build.optimize_simplify_skipped',
            {
              sceneId,
              step: 'glb_build',
              reason:
                simplifyFactoryError instanceof Error
                  ? simplifyFactoryError.message
                  : String(simplifyFactoryError),
              fallbackTransforms: [
                'prune',
                'dedup',
                'instance?',
                'weld',
                'quantize',
              ],
              phase: 'simplify_factory',
            },
          );
        }
      }
    }
    if (supportsSimplify) {
      transforms = [
        ...transforms.slice(0, -2),
        simplifyTransform,
        ...transforms.slice(-2),
      ];
    }

    try {
      await transformableDoc.transform(...transforms);

      const transformSteps = supportsInstance
        ? ['prune', 'dedup', 'instance']
        : ['prune', 'dedup'];
      if (supportsSimplify) {
        transformSteps.push('simplify');
      }
      transformSteps.push('weld', 'quantize');

      this.appLoggerService.info('scene.glb_build.optimize', {
        sceneId,
        step: 'glb_build',
        reason: controls?.reason,
        transforms: transformSteps,
        instance: supportsInstance ? GLB_INSTANCE_OPTIONS : undefined,
        simplify: supportsSimplify ? simplifyConfig.options : undefined,
        quantize: GLB_QUANTIZE_OPTIONS,
      });
    } catch (error) {
      if (supportsInstance) {
        try {
          const fallbackTransforms = supportsSimplify
            ? [...baseTransforms, simplifyTransform, ...tailTransforms]
            : [...baseTransforms, ...tailTransforms];
          await transformableDoc.transform(...fallbackTransforms);
          const fallbackTransformSteps = supportsSimplify
            ? ['prune', 'dedup', 'simplify', 'weld', 'quantize']
            : ['prune', 'dedup', 'weld', 'quantize'];
          this.appLoggerService.info('scene.glb_build.optimize', {
            sceneId,
            step: 'glb_build',
            transforms: fallbackTransformSteps,
            simplify: supportsSimplify ? simplifyConfig.options : undefined,
            quantize: GLB_QUANTIZE_OPTIONS,
            fallbackFromInstance: true,
          });
          this.appLoggerService.warn(
            'scene.glb_build.optimize_instance_skipped',
            {
              sceneId,
              step: 'glb_build',
              reason: error instanceof Error ? error.message : String(error),
              fallbackTransforms: fallbackTransformSteps,
            },
          );
          return;
        } catch (fallbackError) {
          if (supportsSimplify) {
            try {
              await transformableDoc.transform(
                ...baseTransforms,
                ...tailTransforms,
              );
              this.appLoggerService.info('scene.glb_build.optimize', {
                sceneId,
                step: 'glb_build',
                transforms: ['prune', 'dedup', 'weld', 'quantize'],
                quantize: GLB_QUANTIZE_OPTIONS,
                fallbackFromInstanceAndSimplify: true,
              });
              this.appLoggerService.warn(
                'scene.glb_build.optimize_simplify_skipped',
                {
                  sceneId,
                  step: 'glb_build',
                  reason:
                    fallbackError instanceof Error
                      ? fallbackError.message
                      : String(fallbackError),
                  fallbackTransforms: ['prune', 'dedup', 'weld', 'quantize'],
                  triggeredBy: 'instance_fallback',
                },
              );
              this.appLoggerService.warn(
                'scene.glb_build.optimize_instance_skipped',
                {
                  sceneId,
                  step: 'glb_build',
                  reason:
                    error instanceof Error ? error.message : String(error),
                  fallbackTransforms: ['prune', 'dedup', 'weld', 'quantize'],
                  triggeredBy: 'simplify_fallback',
                },
              );
              return;
            } catch (baseFallbackError) {
              this.appLoggerService.warn('scene.glb_build.optimize_skipped', {
                sceneId,
                step: 'glb_build',
                reason:
                  baseFallbackError instanceof Error
                    ? baseFallbackError.message
                    : String(baseFallbackError),
                initialReason:
                  error instanceof Error ? error.message : String(error),
              });
              return;
            }
          }

          this.appLoggerService.warn('scene.glb_build.optimize_skipped', {
            sceneId,
            step: 'glb_build',
            reason:
              fallbackError instanceof Error
                ? fallbackError.message
                : String(fallbackError),
            initialReason:
              error instanceof Error ? error.message : String(error),
          });
          return;
        }
      }

      if (supportsSimplify) {
        try {
          await transformableDoc.transform(
            ...baseTransforms,
            ...tailTransforms,
          );
          this.appLoggerService.info('scene.glb_build.optimize', {
            sceneId,
            step: 'glb_build',
            transforms: supportsInstance
              ? ['prune', 'dedup', 'instance', 'weld', 'quantize']
              : ['prune', 'dedup', 'weld', 'quantize'],
            instance: supportsInstance ? GLB_INSTANCE_OPTIONS : undefined,
            quantize: GLB_QUANTIZE_OPTIONS,
            fallbackFromSimplify: true,
          });
          this.appLoggerService.warn(
            'scene.glb_build.optimize_simplify_skipped',
            {
              sceneId,
              step: 'glb_build',
              reason: error instanceof Error ? error.message : String(error),
              fallbackTransforms: supportsInstance
                ? ['prune', 'dedup', 'instance', 'weld', 'quantize']
                : ['prune', 'dedup', 'weld', 'quantize'],
            },
          );
          return;
        } catch (fallbackError) {
          this.appLoggerService.warn('scene.glb_build.optimize_skipped', {
            sceneId,
            step: 'glb_build',
            reason:
              fallbackError instanceof Error
                ? fallbackError.message
                : String(fallbackError),
            initialReason:
              error instanceof Error ? error.message : String(error),
          });
          return;
        }
      }

      this.appLoggerService.warn('scene.glb_build.optimize_skipped', {
        sceneId,
        step: 'glb_build',
        reason: error instanceof Error ? error.message : String(error),
      });
    }
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

  private async validateGlb(
    glbBinary: Uint8Array,
    sceneId: string,
    validatorModule: {
      validateBytes: (
        data: Uint8Array,
        options?: Record<string, unknown>,
      ) => Promise<unknown>;
    },
  ): Promise<void> {
    const report = (await validatorModule.validateBytes(glbBinary, {
      uri: `${sceneId}.glb`,
      format: 'glb',
      maxIssues: 0,
      writeTimestamp: false,
      severityOverrides: GLB_VALIDATOR_SEVERITY_OVERRIDES,
    })) as GlbValidatorReport;

    const isTruncated = Boolean(report.truncated || report.issues?.truncated);
    if (isTruncated) {
      throw new Error(
        'GLB validation report was truncated. Increase observability or split diagnostics payload.',
      );
    }

    const numErrors = report.issues?.numErrors ?? 0;
    if (numErrors > 0) {
      const detail = report.issues?.messages
        ?.slice(0, GLB_VALIDATION_DETAIL_LIMIT)
        .map(
          (issue) =>
            `${issue.code ?? 'UNKNOWN'}:${issue.pointer ?? '-'}:${issue.message ?? ''}`,
        )
        .join(' | ');
      const warningSummary = `warnings=${report.issues?.numWarnings ?? 0}, infos=${report.issues?.numInfos ?? 0}, hints=${report.issues?.numHints ?? 0}`;
      throw new Error(
        `GLB validation failed with ${numErrors} error(s) (${warningSummary}).${detail ? ` ${detail}` : ''}`,
      );
    }
  }

  private async loadMeshoptimizerModule(): Promise<
    | {
        MeshoptSimplifier?: unknown;
      }
    | undefined
  > {
    try {
      return (await import('meshoptimizer/simplifier')) as {
        MeshoptSimplifier?: unknown;
      };
    } catch {
      return undefined;
    }
  }

  private async registerNodeIoExtensions(
    io: unknown,
    sceneId: string,
  ): Promise<void> {
    const candidateIo = io as {
      registerExtensions?: (extensions: unknown[]) => unknown;
    };
    if (typeof candidateIo.registerExtensions !== 'function') {
      return;
    }

    try {
      const extensionsModule = await import('@gltf-transform/extensions');
      const exportedAllExtensions = (
        extensionsModule as {
          ALL_EXTENSIONS?: unknown;
        }
      ).ALL_EXTENSIONS;
      const allExtensions = Array.isArray(exportedAllExtensions)
        ? exportedAllExtensions
        : Object.values(extensionsModule).filter((extension) => {
            if (typeof extension !== 'function') {
              return false;
            }
            const extensionClass = extension as {
              EXTENSION_NAME?: string;
              prototype?: { EXTENSION_NAME?: string };
            };
            return Boolean(
              extensionClass.EXTENSION_NAME ??
              extensionClass.prototype?.EXTENSION_NAME,
            );
          });
      if (allExtensions.length > 0) {
        candidateIo.registerExtensions(allExtensions);
      }
    } catch (extensionImportError) {
      this.appLoggerService.warn(
        'scene.glb_build.extension_registration_skipped',
        {
          sceneId,
          step: 'glb_build',
          reason:
            extensionImportError instanceof Error
              ? extensionImportError.message
              : String(extensionImportError),
        },
      );
    }
  }

  private enforceSizeBudget(glbBytes: number, sceneId: string): void {
    if (glbBytes <= GLB_SIZE_TARGET_MAX_BYTES) {
      return;
    }
    throw new Error(
      `GLB size budget exceeded: ${glbBytes} bytes > ${GLB_SIZE_TARGET_MAX_BYTES} bytes (sceneId=${sceneId})`,
    );
  }
}

function clampRange(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
