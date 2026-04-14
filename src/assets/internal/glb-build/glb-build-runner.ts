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
import { createCrosswalkGeometry } from './glb-build-utils';
import type { GlbInputContract } from './glb-build-contract';

interface BuildingClosureDiagnosticsMetrics {
  openShellCount: number;
  roofWallGapCount: number;
  invalidSetbackJoinCount: number;
}

interface GlbTransformFunctionsModule {
  prune: (options?: Record<string, unknown>) => unknown;
  dedup: (options?: Record<string, unknown>) => unknown;
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
  quantizePosition: 14,
  quantizeNormal: 10,
  quantizeTexcoord: 12,
  quantizeColor: 8,
  quantizeGeneric: 12,
  cleanup: false,
};

@Injectable()
export class GlbBuildRunner {
  private currentMeshDiagnostics: MeshNodeDiagnostic[] = [];
  private readonly sceneAssetProfileService = new SceneAssetProfileService();
  private materialCacheStats: MaterialCacheStats = { hits: 0, misses: 0 };
  private semanticGroupNodes = new Map<string, unknown>();
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
    ) =>
      addMeshNode(
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

    addTransportMeshes(
      {
        addMeshNode: addMeshNodeBound,
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
    );

    const glbBinary = await new NodeIO().writeBinary(doc);
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
      materialTuning,
      facadeMaterialProfile,
      variationProfile,
      staticAtmosphere: contract.staticAtmosphere,
      sceneWideAtmosphereProfile: contract.sceneWideAtmosphereProfile,
      districtAtmosphereProfiles: contract.districtAtmosphereProfiles,
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
  ): Promise<void> {
    const transformableDoc = doc as TransformableGlbDocument;
    if (typeof transformableDoc.transform !== 'function') {
      return;
    }

    try {
      await transformableDoc.transform(
        transformModule.prune({
          keepExtras: true,
          keepLeaves: true,
          keepAttributes: true,
        }),
        transformModule.dedup({
          keepUniqueNames: true,
        }),
        transformModule.weld(),
        transformModule.quantize(GLB_QUANTIZE_OPTIONS),
      );

      this.appLoggerService.info('scene.glb_build.optimize', {
        sceneId,
        step: 'glb_build',
        transforms: ['prune', 'dedup', 'weld', 'quantize'],
        quantize: GLB_QUANTIZE_OPTIONS,
      });
    } catch (error) {
      this.appLoggerService.warn('scene.glb_build.optimize_skipped', {
        sceneId,
        step: 'glb_build',
        reason: error instanceof Error ? error.message : String(error),
      });
    }
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
}
