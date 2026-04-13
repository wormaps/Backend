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
import { buildSceneAssetSelection } from '../../../scene/utils/scene-asset-profile.utils';
import { addTransportMeshes } from './stages/glb-build-transport.stage';
import { addStreetContextMeshes } from './stages/glb-build-street-context.stage';
import {
  addBuildingAndHeroMeshes,
  buildGroupedBuildingShells,
  collectBuildingClosureDiagnostics,
} from './stages/glb-build-building-hero.stage';
import { GroupedBuildings } from './glb-build-stage.types';
import {
  createBuildingRoofAccentGeometry,
  createLandCoverGeometry,
  createLinearFeatureGeometry,
  createPoiGeometry,
  createStreetFurnitureGeometry,
} from './geometry/glb-build-local-geometry.utils';
import { triangulateRings as triangulateRingsUtil } from './geometry/glb-build-geometry-primitives.utils';
import { SceneDetail, SceneMeta } from '../../../scene/types/scene.types';
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
  FacadeColorDiversityMetrics,
  buildFacadeColorDiversityMetrics,
  buildGroupedBuildingShellsLocal,
  groupFacadeHintsByPanelColorLocal,
  groupBillboardClustersByColorLocal,
  resolveWindowMaterialTone,
  resolveHeroToneFromBuildings,
} from './glb-build-style-metrics';
import { createCrosswalkGeometry } from './glb-build-utils';

interface BuildingClosureDiagnosticsMetrics {
  openShellCount: number;
  roofWallGapCount: number;
  invalidSetbackJoinCount: number;
}

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
    sceneMeta: SceneMeta,
    sceneDetail: SceneDetail,
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
    const earcutModule = await import('earcut');
    const validatorModule = await import('gltf-validator');
    const triangulate = earcutModule.default;
    const { Accessor, Document, NodeIO } = gltf;
    const doc = new Document();
    installMaterialCache(
      doc as unknown as Record<string, unknown>,
      sceneMeta.sceneId,
      this.materialCacheStats,
    );
    const buffer = doc.createBuffer('scene-buffer');
    const scene = doc.createScene(sceneMeta.sceneId);
    initializeDccHierarchy(
      doc as unknown as Record<string, unknown>,
      scene as unknown as Record<string, unknown>,
      sceneMeta.sceneId,
      this.semanticGroupNodes,
    );
    registerBuildingGroupNodes(
      doc as unknown as Record<string, unknown>,
      scene as unknown as Record<string, unknown>,
      sceneMeta,
      this.semanticGroupNodes,
    );
    this.currentMeshDiagnostics = [];

    const assetSelection = buildSceneAssetSelection(
      sceneMeta,
      sceneDetail,
      sceneMeta.assetProfile.preset,
    );
    const adaptiveMeta =
      this.sceneAssetProfileService.buildSceneMetaWithAssetSelection(
        sceneMeta,
        assetSelection,
      );
    const modePolicy = resolveSceneModePolicy(
      sceneDetail.fidelityPlan?.targetMode,
      sceneDetail.fidelityPlan?.currentMode,
    );
    const materialTuning = this.resolveMaterialTuning(sceneMeta, sceneDetail);
    const variationProfile = this.resolveVariationProfile(
      adaptiveMeta,
      sceneDetail,
    );
    const facadeMaterialProfile = this.resolveFacadeMaterialProfile(
      sceneMeta,
      sceneDetail,
    );
    const materials = createEnhancedSceneMaterials(
      doc,
      materialTuning,
      facadeMaterialProfile,
    );

    this.appLoggerService.info('scene.glb_build.material_tuning', {
      sceneId: sceneMeta.sceneId,
      step: 'glb_build',
      tuning: materialTuning,
      variationProfile,
      modePolicy: modePolicy.id,
      staticAtmosphere: sceneDetail.staticAtmosphere?.preset ?? 'DAY_CLEAR',
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
      sceneMeta,
      sceneDetail,
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
      sceneMeta,
      sceneDetail,
      assetSelection,
      materials,
      triangulate,
    );

    const groupedBuildings = buildGroupedBuildingShells(
      {
        buildGroupedBuildingShells: (
          _sceneMeta: SceneMeta,
          sceneDetail: SceneDetail,
          assetSelection: ReturnType<typeof buildSceneAssetSelection>,
        ) => buildGroupedBuildingShellsLocal(sceneDetail, assetSelection),
      },
      sceneMeta,
      sceneDetail,
      assetSelection,
    );

    const buildingClosureDiagnostics = this.collectBuildingClosureDiagnostics(
      adaptiveMeta,
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
        staticAtmosphere: sceneDetail.staticAtmosphere,
        createBuildingRoofAccentGeometry,
      },
      { doc, Accessor, scene, buffer },
      sceneMeta,
      sceneDetail,
      assetSelection,
      materials,
      triangulate,
      groupedBuildings,
    );

    const outputPath = join(getSceneDataDir(), `${sceneMeta.sceneId}.glb`);
    await mkdir(dirname(outputPath), { recursive: true });

    const glbBinary = await new NodeIO().writeBinary(doc);
    await this.validateGlb(
      Uint8Array.from(glbBinary),
      sceneMeta.sceneId,
      validatorModule,
    );
    await writeFile(outputPath, glbBinary);

    const comparisonReport = buildSceneModeComparisonReport(
      adaptiveMeta,
      sceneDetail,
      {
        generationMs:
          (runMetrics?.pipelineMs ?? 0) + (Date.now() - buildStartedAt),
        glbBytes: glbBinary.byteLength,
      },
    );

    const facadeColorDiversity = buildFacadeColorDiversityMetrics(
      sceneDetail,
      groupedBuildings,
    );

    const diagnosticsPayload = {
      sceneScoreReport: buildSceneFidelityMetricsReport(
        adaptiveMeta,
        sceneDetail,
      ),
      sceneModeComparisonReport: comparisonReport,
      modePolicy,
      assetSelection: {
        selected: assetSelection.selected,
        budget: assetSelection.budget,
      },
      structuralCoverage: adaptiveMeta.structuralCoverage,
      sourceDetail: {
        crossings: sceneDetail.crossings.length,
        roadMarkings: sceneDetail.roadMarkings.length,
        roadDecals: sceneDetail.roadDecals?.length ?? 0,
        facadeHints: sceneDetail.facadeHints.length,
        signageClusters: sceneDetail.signageClusters.length,
      },
      facadeContextDiagnostics: sceneDetail.facadeContextDiagnostics,
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
      staticAtmosphere: sceneDetail.staticAtmosphere,
      sceneWideAtmosphereProfile: sceneDetail.sceneWideAtmosphereProfile,
      districtAtmosphereProfiles: sceneDetail.districtAtmosphereProfiles,
    };

    this.appLoggerService.info('scene.glb_build.diagnostics', {
      sceneId: sceneMeta.sceneId,
      step: 'glb_build',
      ...diagnosticsPayload,
    });
    await appendSceneDiagnosticsLog(
      sceneMeta.sceneId,
      'glb_build',
      diagnosticsPayload,
    );
    await appendSceneDiagnosticsLog(
      sceneMeta.sceneId,
      'mode_comparison',
      comparisonReport as unknown as Record<string, unknown>,
    );
    await writeFile(
      join(getSceneDataDir(), `${sceneMeta.sceneId}.mode-comparison.json`),
      JSON.stringify(comparisonReport, null, 2),
      'utf8',
    );

    return outputPath;
  }

  private collectBuildingClosureDiagnostics(
    sceneMeta: SceneMeta,
    assetSelection: ReturnType<typeof buildSceneAssetSelection>,
  ): BuildingClosureDiagnosticsMetrics {
    return collectBuildingClosureDiagnostics(
      sceneMeta,
      assetSelection.buildings,
    );
  }

  private resolveMaterialTuning(
    sceneMeta: SceneMeta,
    sceneDetail: SceneDetail,
  ): MaterialTuningOptions {
    return resolveMaterialTuningFromScene(
      sceneMeta,
      sceneDetail.facadeHints,
      sceneDetail.staticAtmosphere,
      sceneDetail.fidelityPlan?.targetMode,
    );
  }

  private resolveVariationProfile(
    sceneMeta: SceneMeta,
    sceneDetail: SceneDetail,
  ) {
    return resolveSceneVariationProfile(sceneMeta, sceneDetail);
  }

  private resolveFacadeMaterialProfile(
    sceneMeta: SceneMeta,
    sceneDetail: SceneDetail,
  ) {
    return resolveFacadeLayerMaterialProfile(sceneMeta, sceneDetail);
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
      maxIssues: 1000,
    })) as {
      issues?: {
        numErrors?: number;
        messages?: Array<{ code?: string; message?: string; pointer?: string }>;
      };
    };

    const numErrors = report.issues?.numErrors ?? 0;
    if (numErrors > 0) {
      const detail = report.issues?.messages
        ?.slice(0, 5)
        .map(
          (issue) =>
            `${issue.code ?? 'UNKNOWN'}:${issue.pointer ?? '-'}:${issue.message ?? ''}`,
        )
        .join(' | ');
      throw new Error(
        `GLB validation failed with ${numErrors} error(s).${detail ? ` ${detail}` : ''}`,
      );
    }
  }
}
