import {
  collectBuildingRoofSurfaceMetrics,
  collectBuildingShellClosureMetrics,
  createBillboardsGeometry,
  createBuildingEntranceGeometry,
  createBuildingPanelsGeometry,
  createBuildingRoofEquipmentGeometry,
  createBuildingRoofSurfaceGeometry,
  createBuildingShellGeometry,
  createBuildingWindowGeometry,
  createHeroBillboardPlaneGeometry,
  createHeroCanopyGeometry,
  createHeroRoofUnitGeometry,
  createLandmarkExtrasGeometry,
} from '../../../compiler/building';
import type { BuildingWindowGeometryOptions } from '../../../compiler/building/building-mesh.window.builder';
import {
  createBillboardMaterial,
  createBuildingPanelMaterial,
  createBuildingShellMaterial,
} from '../../../compiler/materials';
import {
  AssetSelection,
  GroupedBuildings,
  MeshAddContext,
  RunnerStageHooks,
  SceneMaterials,
} from '../glb-build-stage.types';
import type { GlbInputContract } from '../glb-build-contract';
import {
  resolveAccentToneFromPalette,
  resolveBuildingShellStyleFromHint,
} from '../glb-build-style.utils';

export interface BuildingClosureDiagnostics {
  openShellCount: number;
  roofWallGapCount: number;
  invalidSetbackJoinCount: number;
}

export function collectBuildingClosureDiagnostics(
  sceneMeta: GlbInputContract,
  buildings: GlbInputContract['buildings'],
): BuildingClosureDiagnostics {
  const shellMetrics = collectBuildingShellClosureMetrics(
    sceneMeta.origin,
    buildings,
  );
  const roofMetrics = collectBuildingRoofSurfaceMetrics(buildings);
  return {
    openShellCount: shellMetrics.openShellCount,
    roofWallGapCount: roofMetrics.roofWallGapRiskCount,
    invalidSetbackJoinCount: shellMetrics.invalidSetbackJoinCount,
  };
}

export function resolveWindowTriangleBudgetForSelection(
  selectedBuildingCount: number,
): BuildingWindowGeometryOptions {
  const maxWindowTriangles =
    selectedBuildingCount > 1000
      ? 780_000
      : selectedBuildingCount > 700
        ? 840_000
        : 900_000;
  return { maxWindowTriangles };
}

export function buildGroupedBuildingShells(
  hooks: Pick<RunnerStageHooks, 'buildGroupedBuildingShells'>,
  sceneMeta: GlbInputContract,
  sceneDetail: GlbInputContract,
  assetSelection: AssetSelection,
): GroupedBuildings {
  return hooks.buildGroupedBuildingShells(
    sceneMeta,
    sceneDetail,
    assetSelection,
  );
}

export function addBuildingAndHeroMeshes(
  hooks: Pick<
    RunnerStageHooks,
    | 'addMeshNode'
    | 'groupFacadeHintsByPanelColor'
    | 'groupBillboardClustersByColor'
    | 'resolveWindowMaterialTone'
    | 'resolveHeroToneFromBuildings'
    | 'materialTuning'
    | 'facadeMaterialProfile'
    | 'variationProfile'
    | 'modePolicy'
    | 'staticAtmosphere'
    | 'createBuildingRoofAccentGeometry'
  >,
  ctx: MeshAddContext,
  sceneMeta: GlbInputContract,
  sceneDetail: GlbInputContract,
  assetSelection: AssetSelection,
  materials: SceneMaterials,
  triangulate: (
    vertices: number[],
    holes?: number[],
    dimensions?: number,
  ) => number[],
  groupedBuildings: GroupedBuildings,
): void {
  void groupedBuildings;
  const selectedBuildingCount = Math.max(1, assetSelection.buildings.length);
  const windowBudget = resolveWindowTriangleBudgetForSelection(
    selectedBuildingCount,
  );
  for (const building of assetSelection.buildings) {
    const buildingHints = sceneDetail.facadeHints.filter(
      (hint) => hint.objectId === building.objectId,
    );
    const primaryHint = buildingHints[0];
    const shellStyle = resolveBuildingShellStyleFromHint(building, primaryHint);
    const roofTone = resolveBuildingRoofTone(building);

    hooks.addMeshNode(
      ctx.doc,
      ctx.Accessor,
      ctx.scene,
      ctx.buffer,
      `building_shell_${building.objectId}`,
      createBuildingShellGeometry(sceneMeta.origin, [building], triangulate),
      createBuildingShellMaterial(
        ctx.doc,
        shellStyle.materialClass,
        shellStyle.bucket,
        shellStyle.colorHex,
        hooks.materialTuning,
        hooks.facadeMaterialProfile,
      ),
      {
        sourceCount: 1,
        selectedCount: 1,
        selectionLod: building.lodLevel,
        semanticCategory: 'building',
        sourceObjectIds: [building.objectId],
      },
    );

    hooks.addMeshNode(
      ctx.doc,
      ctx.Accessor,
      ctx.scene,
      ctx.buffer,
      `building_roof_surface_${building.objectId}`,
      createBuildingRoofSurfaceGeometry(
        sceneMeta.origin,
        [building],
        triangulate,
        roofTone,
      ),
      materials.roofSurfaces[roofTone],
      {
        sourceCount: 1,
        selectedCount: 1,
        selectionLod: building.lodLevel,
        semanticCategory: 'building',
        sourceObjectIds: [building.objectId],
      },
    );

    hooks.addMeshNode(
      ctx.doc,
      ctx.Accessor,
      ctx.scene,
      ctx.buffer,
      `building_roof_accent_${building.objectId}`,
      hooks.createBuildingRoofAccentGeometry(
        sceneMeta.origin,
        [building],
        triangulate,
        roofTone,
        hooks.staticAtmosphere,
      ),
      materials.roofAccents[roofTone],
      {
        sourceCount: 1,
        selectedCount: 1,
        selectionLod: building.lodLevel,
        semanticCategory: 'building',
        sourceObjectIds: [building.objectId],
      },
    );

    if (primaryHint) {
      const panelTone = resolveAccentToneFromPalette(
        primaryHint.panelPalette ?? primaryHint.palette,
      );
      const panelColor =
        primaryHint.panelPalette?.[0] ?? primaryHint.palette[0];
      if (panelColor) {
        hooks.addMeshNode(
          ctx.doc,
          ctx.Accessor,
          ctx.scene,
          ctx.buffer,
          `building_panel_${building.objectId}`,
          createBuildingPanelsGeometry(
            sceneMeta.origin,
            [building],
            [primaryHint],
            panelTone,
          ),
          createBuildingPanelMaterial(
            ctx.doc,
            panelTone,
            panelColor,
            hooks.materialTuning,
            hooks.facadeMaterialProfile,
          ),
          {
            sourceCount: 1,
            selectedCount: 1,
            selectionLod: building.lodLevel,
            semanticCategory: 'building',
            sourceObjectIds: [building.objectId],
          },
        );
      }
    }

    hooks.addMeshNode(
      ctx.doc,
      ctx.Accessor,
      ctx.scene,
      ctx.buffer,
      `building_window_${building.objectId}`,
      createBuildingWindowGeometry(
        sceneMeta.origin,
        [building],
        buildingHints,
        windowBudget,
      ),
      materials.windowPrimary ??
        materials.windowGlassCurtainWall ??
        materials.windowGlassReflective ??
        materials.buildingPanels[
          hooks.resolveWindowMaterialTone(buildingHints)
        ],
      {
        sourceCount: buildingHints.length,
        selectedCount: 1,
        selectionLod: building.lodLevel,
        semanticCategory: 'building',
        sourceObjectIds: [building.objectId],
      },
    );
    hooks.addMeshNode(
      ctx.doc,
      ctx.Accessor,
      ctx.scene,
      ctx.buffer,
      `building_entrance_${building.objectId}`,
      createBuildingEntranceGeometry(sceneMeta.origin, [building]),
      materials.entrancePrimary ??
        materials.facadePrimary ??
        materials.facadeConcreteMid ??
        materials.buildingPanels.neutral,
      {
        sourceCount: 1,
        selectedCount: 1,
        selectionLod: building.lodLevel,
        semanticCategory: 'building',
        sourceObjectIds: [building.objectId],
      },
    );
    hooks.addMeshNode(
      ctx.doc,
      ctx.Accessor,
      ctx.scene,
      ctx.buffer,
      `building_roof_equipment_${building.objectId}`,
      createBuildingRoofEquipmentGeometry(sceneMeta.origin, [building]),
      materials.roofEquipmentPrimary ?? materials.roofAccents.neutral,
      {
        sourceCount: building.roofSpec?.roofUnits ?? 0,
        selectedCount: building.roofSpec?.roofUnits ?? 0,
        selectionLod: building.lodLevel,
        semanticCategory: 'building',
        sourceObjectIds: [building.objectId],
      },
    );
  }

  if (hooks.modePolicy.stage.includeEmissiveBillboard) {
    for (const billboardGroup of hooks.groupBillboardClustersByColor(
      assetSelection.billboardPanels,
      sceneDetail.signageClusters,
    )) {
      hooks.addMeshNode(
        ctx.doc,
        ctx.Accessor,
        ctx.scene,
        ctx.buffer,
        `billboards_${billboardGroup.tone}_${billboardGroup.colorHex.slice(1)}`,
        createBillboardsGeometry(
          sceneMeta.origin,
          billboardGroup.selectedClusters,
          billboardGroup.tone,
        ),
        createBillboardMaterial(
          ctx.doc,
          billboardGroup.tone,
          billboardGroup.colorHex,
          hooks.materialTuning,
        ),
        {
          sourceCount: billboardGroup.sourceCount,
          selectedCount: billboardGroup.selectedClusters.length,
          semanticCategory: 'signage',
          sourceObjectIds: billboardGroup.selectedClusters.map(
            (cluster) => cluster.objectId,
          ),
        },
      );
    }
  }

  if (hooks.modePolicy.stage.includeHeroBuilding) {
    for (const building of assetSelection.buildings) {
      const heroTone = hooks.resolveHeroToneFromBuildings([building]);

      if ((building.podiumSpec?.canopyEdges.length ?? 0) > 0) {
        hooks.addMeshNode(
          ctx.doc,
          ctx.Accessor,
          ctx.scene,
          ctx.buffer,
          `hero_canopy_${building.objectId}`,
          createHeroCanopyGeometry(sceneMeta.origin, [building]),
          materials.heroCanopyPrimary ??
            materials.buildingLightAccentSpot ??
            materials.buildingPanels[heroTone],
          {
            sourceCount: 1,
            selectedCount: 1,
            selectionLod: building.lodLevel,
            semanticCategory: 'building',
            sourceObjectIds: [building.objectId],
          },
        );
      }

      if (building.roofSpec?.roofUnits) {
        hooks.addMeshNode(
          ctx.doc,
          ctx.Accessor,
          ctx.scene,
          ctx.buffer,
          `hero_roof_unit_${building.objectId}`,
          createHeroRoofUnitGeometry(sceneMeta.origin, [building]),
          materials.heroRoofUnitPrimary ??
            materials.facadeMetalMid ??
            materials.roofAccents[heroTone],
          {
            sourceCount: 1,
            selectedCount: 1,
            selectionLod: building.lodLevel,
            semanticCategory: 'building',
            sourceObjectIds: [building.objectId],
          },
        );
      }

      if ((building.signageSpec?.billboardFaces.length ?? 0) > 0) {
        hooks.addMeshNode(
          ctx.doc,
          ctx.Accessor,
          ctx.scene,
          ctx.buffer,
          `hero_billboard_${building.objectId}`,
          createHeroBillboardPlaneGeometry(sceneMeta.origin, [building]),
          materials.heroBillboardPrimary ??
            materials.neonSignOrange ??
            materials.billboards.warm,
          {
            sourceCount: 1,
            selectedCount: 1,
            selectionLod: building.lodLevel,
            semanticCategory: 'building',
            sourceObjectIds: [building.objectId],
          },
        );
      }
    }
  }
  if (hooks.modePolicy.stage.includeLandmarkExtras) {
    hooks.addMeshNode(
      ctx.doc,
      ctx.Accessor,
      ctx.scene,
      ctx.buffer,
      'landmark_extras',
      createLandmarkExtrasGeometry(
        sceneMeta.origin,
        sceneMeta.landmarkAnchors,
        sceneDetail.signageClusters,
      ),
      materials.landmark,
      {
        sourceCount:
          sceneMeta.landmarkAnchors.length + sceneDetail.signageClusters.length,
        selectedCount:
          sceneMeta.landmarkAnchors.length + sceneDetail.signageClusters.length,
        semanticCategory: 'landmark',
        sourceObjectIds: [
          ...sceneMeta.landmarkAnchors.map((item) => item.objectId),
          ...sceneDetail.signageClusters.map((item) => item.objectId),
        ],
      },
    );
  }
}

function resolveBuildingRoofTone(
  building: GlbInputContract['buildings'][number],
): 'cool' | 'warm' | 'neutral' {
  const explicit = building.roofColor ?? building.facadeColor;
  if (explicit) {
    return resolveAccentToneFromPalette([explicit]);
  }
  if (building.roofType === 'gable') {
    return 'warm';
  }
  return building.preset === 'glass_tower' ? 'cool' : 'neutral';
}
