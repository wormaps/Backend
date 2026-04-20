import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { AppLoggerService } from '../../../common/logging/app-logger.service';
import { appMetrics } from '../../../common/metrics/metrics.instance';
import { createEnhancedSceneMaterials } from '../../compiler/materials';
import { getSceneDataDir, writeFileAtomically } from '../../../scene/storage/scene-storage.utils';
import type { SceneAssetSelection, SceneAssetProfileService } from '../../../scene/services/asset-profile';
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
import {
  MaterialCacheStats,
  installMaterialCache,
  computeMaterialReuseDiagnostics,
} from './glb-build-material-cache';
import {
  loadMeshoptimizerModule,
  optimizeGlbDocument,
  registerNodeIoExtensions,
  validateGlb,
} from './glb-build-runner.helpers';
import {
  buildMaterialTuningSignature,
  resolveGlbBuildTimeoutMsFromEnv,
  resolveSimplifyOptionsFromEnv,
  resolveLodSimplifyProfile,
  type LodSimplifyProfile,
  type GlbSimplifyOptions,
} from './glb-build-runner.config';
import { finalizeGlbBuildArtifacts } from './glb-build-runner.output';
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
  buildGroupedBuildingShellsLocal,
  groupFacadeHintsByPanelColorLocal,
  groupBillboardClustersByColorLocal,
  resolveWindowMaterialTone,
  resolveHeroToneFromBuildings,
} from './glb-build-style-metrics';
import { createGraphIntent, StageGraphIntent } from './glb-build-graph-intent';
import { createCrosswalkGeometry } from './glb-build-utils';
import type { GlbInputContract } from './glb-build-contract';

export interface GlbBuildRunnerState {
  currentMeshDiagnostics: MeshNodeDiagnostic[];
  appLoggerService: AppLoggerService;
  sceneAssetProfileService: SceneAssetProfileService;
  materialCacheStats: MaterialCacheStats;
  semanticGroupNodes: Map<string, unknown>;
  graphIntents: Array<ReturnType<typeof createGraphIntent>>;
  stageGraphIntents: StageGraphIntent[];
  triangleBudget: TriangleBudgetState;
}

export function logGlbBuildStabilitySignals(args: {
  appLoggerService: AppLoggerService;
  sceneId: string;
  buildingCount: number;
  memoryStart: NodeJS.MemoryUsage;
  memoryEnd?: NodeJS.MemoryUsage;
}): void {
  if (args.buildingCount >= 4000) {
    args.appLoggerService.warn('scene.glb_build.large_scene_signal', {
      sceneId: args.sceneId,
      step: 'glb_build',
      buildingCount: args.buildingCount,
      memoryStart: args.memoryStart,
      retryPolicy: 'best_effort_large_scene',
    });
    return;
  }

  args.appLoggerService.info('scene.glb_build.memory_start', {
    sceneId: args.sceneId,
    step: 'glb_build',
    buildingCount: args.buildingCount,
    memory: args.memoryStart,
  });

  if (args.memoryEnd) {
    args.appLoggerService.info('scene.glb_build.memory_end', {
      sceneId: args.sceneId,
      step: 'glb_build',
      buildingCount: args.buildingCount,
      memoryStart: args.memoryStart,
      memoryEnd: args.memoryEnd,
    });
  }
}

export async function executeGlbBuild(
  state: GlbBuildRunnerState,
  contract: GlbInputContract,
  runMetrics?: {
    pipelineMs?: number;
  },
): Promise<string> {
  const buildStartedAt = Date.now();
  const buildMemoryStart = process.memoryUsage();
  const buildTimeoutMs = resolveGlbBuildTimeoutMsFromEnv();
  state.triangleBudget.totalTriangleCount = 0;
  state.triangleBudget.protectedTriangleCount = 0;
  state.materialCacheStats = { hits: 0, misses: 0 };
  state.semanticGroupNodes.clear();
  const gltf = await import('@gltf-transform/core');
  const transformFunctionsModule = await import('@gltf-transform/functions');
  const meshoptimizerModule = await loadMeshoptimizerModule();
  const earcutModule = await import('earcut');
  const validatorModule = await import('gltf-validator');
  const triangulate = earcutModule.default;
  const { Accessor, Document, NodeIO } = gltf;
  const doc = new Document();
  const materialTuning = resolveMaterialTuningFromScene(
    contract.facadeHints,
    contract.staticAtmosphere,
    contract.fidelityPlan?.targetMode,
  );
  installMaterialCache(
    doc as unknown as Record<string, unknown>,
    contract.sceneId,
    state.materialCacheStats,
    buildMaterialTuningSignature(materialTuning),
  );
  const buffer = doc.createBuffer('scene-buffer');
  const scene = doc.createScene(contract.sceneId);
  initializeDccHierarchy(
    doc as unknown as Record<string, unknown>,
    scene as unknown as Record<string, unknown>,
    contract.sceneId,
    state.semanticGroupNodes,
  );
  registerBuildingGroupNodes(
    doc as unknown as Record<string, unknown>,
    scene as unknown as Record<string, unknown>,
    contract,
    state.semanticGroupNodes,
  );
  state.currentMeshDiagnostics = [];
  state.stageGraphIntents = [];
  state.graphIntents = [];

  const assetSelection = contract.assetSelection;
  const largeSceneBuildingCount = contract.buildings.length;
  logGlbBuildStabilitySignals({
    appLoggerService: state.appLoggerService,
    sceneId: contract.sceneId,
    buildingCount: largeSceneBuildingCount,
    memoryStart: buildMemoryStart,
  });
  state.appLoggerService.info('scene.glb_build.timeout_configured', {
    sceneId: contract.sceneId,
    step: 'glb_build',
    timeoutMs: buildTimeoutMs,
  });
  const adaptiveMeta =
    state.sceneAssetProfileService.buildSceneMetaWithAssetSelection(
      contract,
      assetSelection,
      contract,
    );
  const modePolicy = resolveSceneModePolicy(
    contract.fidelityPlan?.targetMode,
    contract.fidelityPlan?.currentMode,
  );
  const variationProfile = resolveSceneVariationProfile(contract, contract);
  const facadeMaterialProfile = resolveFacadeLayerMaterialProfile(
    contract,
    contract,
  );
  const materials = createEnhancedSceneMaterials(
    doc,
    materialTuning,
    facadeMaterialProfile,
    contract.landCovers ?? [],
  );

  state.appLoggerService.info('scene.glb_build.material_tuning', {
    sceneId: contract.sceneId,
    step: 'glb_build',
    tuning: materialTuning,
    variationProfile,
    modePolicy: modePolicy.id,
    staticAtmosphere: contract.staticAtmosphere?.preset ?? 'DAY_CLEAR',
    materialCache: {
      hits: state.materialCacheStats.hits,
      misses: state.materialCacheStats.misses,
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
    state.graphIntents.push(createGraphIntent(name, trace));
    return addMeshNode(
      docParam as Record<string, unknown>,
      AccessorRef as Record<string, unknown>,
      sceneParam as Record<string, unknown>,
      bufferParam,
      name,
      geometry as import('../../compiler/road').GeometryBuffers,
      material,
      trace,
      state.currentMeshDiagnostics,
      state.triangleBudget,
      state.semanticGroupNodes,
      state.appLoggerService,
    );
  };

  addTransportMeshes(
    {
      addMeshNode: addMeshNodeBound,
      collectGraphIntent: (intent) => {
        state.stageGraphIntents.push(intent);
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
        state.stageGraphIntents.push(intent);
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

  const buildingClosureDiagnostics = collectBuildingClosureDiagnostics(
    contract,
    assetSelection.buildings,
  );

  addBuildingAndHeroMeshes(
    {
      addMeshNode: addMeshNodeBound,
      collectGraphIntent: (intent) => {
        state.stageGraphIntents.push(intent);
      },
      groupFacadeHintsByPanelColor: groupFacadeHintsByPanelColorLocal,
      groupBillboardClustersByColor: groupBillboardClustersByColorLocal,
      resolveWindowMaterialTone,
      resolveHeroToneFromBuildings,
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

  const preOptimizeTriangles = countDocumentTriangles(doc);
  state.appLoggerService.info('scene.glb_build.pre_optimize_triangles', {
    sceneId: contract.sceneId,
    step: 'glb_build',
    triangleCount: preOptimizeTriangles,
  });

  const lodProfile = resolveLodSimplifyProfile();
  const baseSimplifyConfig = resolveSimplifyOptionsFromEnv();
  const adaptiveSimplifyOptions = selectLodSimplifyOptions(
    lodProfile,
    preOptimizeTriangles,
    baseSimplifyConfig.options,
  );

  await optimizeGlbDocument(
    doc,
    contract.sceneId,
    transformFunctionsModule,
    meshoptimizerModule?.MeshoptSimplifier,
    state.appLoggerService,
    {
      enabled: baseSimplifyConfig.enabled,
      options: adaptiveSimplifyOptions,
    },
    {
      quantizeOptions: {
        quantizeTexcoord: 12,
        quantizeColor: 8,
        quantizeGeneric: 12,
        cleanup: false,
      },
      instanceOptions: { min: 3, mode: 1 },
    },
  );

  const io = new NodeIO();
  await registerNodeIoExtensions(io, contract.sceneId, state.appLoggerService);
  let glbBinary = await io.writeBinary(doc);
  if (glbBinary.byteLength > 30 * 1024 * 1024) {
    state.appLoggerService.warn('scene.glb_build.size_budget_retry', {
      sceneId: contract.sceneId,
      step: 'glb_build',
      glbBytes: glbBinary.byteLength,
      targetBytes: 30 * 1024 * 1024,
    });
    await optimizeGlbDocument(
      doc,
      contract.sceneId,
      transformFunctionsModule,
      meshoptimizerModule?.MeshoptSimplifier,
      state.appLoggerService,
      {
        enabled: true,
        options: adaptiveSimplifyOptions,
      },
      {
        quantizeOptions: {
          quantizeTexcoord: 12,
          quantizeColor: 8,
          quantizeGeneric: 12,
          cleanup: false,
        },
        instanceOptions: { min: 3, mode: 1 },
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
  const buildMemoryEnd = process.memoryUsage();
  logGlbBuildStabilitySignals({
    appLoggerService: state.appLoggerService,
    sceneId: contract.sceneId,
    buildingCount: largeSceneBuildingCount,
    memoryStart: buildMemoryStart,
    memoryEnd: buildMemoryEnd,
  });
  await validateGlb(Uint8Array.from(glbBinary), contract.sceneId, validatorModule, {
    severityOverrides: {
      NON_OBJECT_EXTRAS: 0,
      EXTRA_PROPERTY: 0,
      UNDECLARED_EXTENSION: 0,
      UNEXPECTED_EXTENSION_OBJECT: 0,
      UNUSED_EXTENSION_REQUIRED: 0,
    },
    detailLimit: 8,
    logger: state.appLoggerService,
  });
  state.appLoggerService.info('scene.glb_build.validation_passed', {
    sceneId: contract.sceneId,
    step: 'glb_build',
    glbBytes: glbBinary.byteLength,
  });
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

  const materialReuseDiagnostics = computeMaterialReuseDiagnostics(
    state.materialCacheStats,
    groupedBuildings.size,
    [...groupedBuildings.values()].reduce(
      (sum, g) => sum + g.buildings.length,
      0,
    ),
  );

  await finalizeGlbBuildArtifacts({
    contract,
    adaptiveMeta,
    outputPath,
    glbBinary: Uint8Array.from(glbBinary),
    buildStartedAt,
    runMetrics,
    appLoggerService: state.appLoggerService,
    assetSelection,
    groupedBuildings,
    currentMeshDiagnostics: state.currentMeshDiagnostics as unknown as Array<
      Record<string, unknown>
    >,
    graphIntents: state.graphIntents,
    stageGraphIntents: state.stageGraphIntents,
    buildingClosureDiagnostics,
    materialTuning: materialTuning as Record<string, unknown>,
    facadeMaterialProfile: facadeMaterialProfile as Record<string, unknown>,
    variationProfile: variationProfile as unknown as Record<string, unknown>,
    materialReuseDiagnostics,
  });

  return outputPath;
}

function countDocumentTriangles(doc: unknown): number {
  let total = 0;
  try {
    const docRecord = doc as Record<string, unknown>;
    const getRoot = docRecord.getRoot as (() => unknown) | undefined;
    if (typeof getRoot !== 'function') return total;
    const root = getRoot() as Record<string, unknown>;
    const listMeshes = root.listMeshes as (() => unknown[]) | undefined;
    if (typeof listMeshes !== 'function') return total;
    const meshes = listMeshes();
    if (!Array.isArray(meshes)) return total;
    for (const mesh of meshes) {
      const meshRecord = mesh as Record<string, unknown>;
      const listPrimitives = meshRecord.listPrimitives as (() => unknown[]) | undefined;
      if (typeof listPrimitives !== 'function') continue;
      const primitives = listPrimitives();
      if (!Array.isArray(primitives)) continue;
      for (const prim of primitives) {
        const primRecord = prim as Record<string, unknown>;
        const getIndices = primRecord.getIndices as (() => unknown) | undefined;
        if (typeof getIndices !== 'function') continue;
        const indices = getIndices();
        if (!indices) continue;
        const indicesRecord = indices as Record<string, unknown>;
        const getCount = indicesRecord.getCount as (() => number) | undefined;
        if (typeof getCount !== 'function') continue;
        const count = getCount();
        if (typeof count === 'number') {
          total += Math.floor(count / 3);
        }
      }
    }
  } catch {
    void 0;
  }
  return total;
}

function selectLodSimplifyOptions(
  lodProfile: LodSimplifyProfile,
  triangleCount: number,
  envOptions: GlbSimplifyOptions,
): GlbSimplifyOptions {
  const lodProfileOptions =
    triangleCount >= 100_000
      ? lodProfile.low
      : triangleCount >= 30_000
        ? lodProfile.medium
        : lodProfile.high;

  return {
    ratio: envOptions.ratio !== 0.75 ? envOptions.ratio : lodProfileOptions.ratio,
    error: envOptions.error !== 0.001 ? envOptions.error : lodProfileOptions.error,
    lockBorder: envOptions.lockBorder,
  };
}
