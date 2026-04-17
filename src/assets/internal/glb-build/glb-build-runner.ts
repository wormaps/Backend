import { Injectable } from '@nestjs/common';
import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { AppLoggerService } from '../../../common/logging/app-logger.service';
import { appMetrics } from '../../../common/metrics/metrics.instance';
import {
  createEnhancedSceneMaterials,
  MaterialTuningOptions,
} from '../../compiler/materials';
import { getSceneDataDir, writeFileAtomically } from '../../../scene/storage/scene-storage.utils';
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
import {
  MaterialCacheStats,
  installMaterialCache,
} from './glb-build-material-cache';
import {
  MeshNodeDiagnostic,
  TriangleBudgetState,
} from './glb-build-mesh-node';
import { executeGlbBuild, type GlbBuildRunnerState } from './glb-build-runner.pipeline';
import type { GlbInputContract } from './glb-build-contract';

interface BuildingClosureDiagnosticsMetrics {
  openShellCount: number;
  roofWallGapCount: number;
  invalidSetbackJoinCount: number;
}

@Injectable()
export class GlbBuildRunner {
  private currentMeshDiagnostics: MeshNodeDiagnostic[] = [];
  private readonly appLoggerService: AppLoggerService;
  private readonly sceneAssetProfileService: SceneAssetProfileService;
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
    return executeGlbBuild(
      this as unknown as GlbBuildRunnerState,
      contract,
      runMetrics,
    );
  }
}
