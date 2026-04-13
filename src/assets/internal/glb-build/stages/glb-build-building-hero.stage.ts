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
import { SceneDetail, SceneMeta } from '../../../../scene/types/scene.types';

export interface BuildingClosureDiagnostics {
  openShellCount: number;
  roofWallGapCount: number;
  invalidSetbackJoinCount: number;
}

export function collectBuildingClosureDiagnostics(
  sceneMeta: SceneMeta,
  buildings: SceneMeta['buildings'],
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
  sceneMeta: SceneMeta,
  sceneDetail: SceneDetail,
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
  sceneMeta: SceneMeta,
  sceneDetail: SceneDetail,
  assetSelection: AssetSelection,
  materials: SceneMaterials,
  triangulate: (
    vertices: number[],
    holes?: number[],
    dimensions?: number,
  ) => number[],
  groupedBuildings: GroupedBuildings,
): void {
  const selectedBuildingIds = new Set(
    assetSelection.buildings.map((building) => building.objectId),
  );
  const selectedFacadeHints = sceneDetail.facadeHints.filter((hint) =>
    selectedBuildingIds.has(hint.objectId),
  );

  for (const [groupKey, group] of groupedBuildings.entries()) {
    hooks.addMeshNode(
      ctx.doc,
      ctx.Accessor,
      ctx.scene,
      ctx.buffer,
      `building_shells_${groupKey}`,
      createBuildingShellGeometry(
        sceneMeta.origin,
        group.buildings,
        triangulate,
      ),
      createBuildingShellMaterial(
        ctx.doc,
        group.materialClass,
        group.bucket,
        group.colorHex,
        hooks.materialTuning,
        hooks.facadeMaterialProfile,
      ),
      {
        sourceCount: sceneMeta.buildings.length,
        selectedCount: group.buildings.length,
        semanticCategory: 'building',
        sourceObjectIds: group.buildings.map((building) => building.objectId),
      },
    );
  }

  hooks.addMeshNode(
    ctx.doc,
    ctx.Accessor,
    ctx.scene,
    ctx.buffer,
    'building_roof_surfaces_cool',
    createBuildingRoofSurfaceGeometry(
      sceneMeta.origin,
      assetSelection.buildings,
      triangulate,
      'cool',
    ),
    materials.roofSurfaces.cool,
    {
      sourceCount: assetSelection.buildings.length,
      selectedCount: assetSelection.buildings.length,
      semanticCategory: 'building',
      sourceObjectIds: assetSelection.buildings.map((building) => building.objectId),
    },
  );
  hooks.addMeshNode(
    ctx.doc,
    ctx.Accessor,
    ctx.scene,
    ctx.buffer,
    'building_roof_surfaces_warm',
    createBuildingRoofSurfaceGeometry(
      sceneMeta.origin,
      assetSelection.buildings,
      triangulate,
      'warm',
    ),
    materials.roofSurfaces.warm,
    {
      sourceCount: assetSelection.buildings.length,
      selectedCount: assetSelection.buildings.length,
      semanticCategory: 'building',
      sourceObjectIds: assetSelection.buildings.map((building) => building.objectId),
    },
  );
  hooks.addMeshNode(
    ctx.doc,
    ctx.Accessor,
    ctx.scene,
    ctx.buffer,
    'building_roof_surfaces_neutral',
    createBuildingRoofSurfaceGeometry(
      sceneMeta.origin,
      assetSelection.buildings,
      triangulate,
      'neutral',
    ),
    materials.roofSurfaces.neutral,
    {
      sourceCount: assetSelection.buildings.length,
      selectedCount: assetSelection.buildings.length,
      semanticCategory: 'building',
      sourceObjectIds: assetSelection.buildings.map((building) => building.objectId),
    },
  );

  hooks.addMeshNode(
    ctx.doc,
    ctx.Accessor,
    ctx.scene,
    ctx.buffer,
    'building_roof_accents_cool',
    hooks.createBuildingRoofAccentGeometry(
      sceneMeta.origin,
      assetSelection.buildings,
      triangulate,
      'cool',
      hooks.staticAtmosphere,
    ),
    materials.roofAccents.cool,
    {
      sourceCount: assetSelection.buildings.length,
      selectedCount: assetSelection.buildings.length,
      semanticCategory: 'building',
      sourceObjectIds: assetSelection.buildings.map((building) => building.objectId),
    },
  );
  hooks.addMeshNode(
    ctx.doc,
    ctx.Accessor,
    ctx.scene,
    ctx.buffer,
    'building_roof_accents_warm',
    hooks.createBuildingRoofAccentGeometry(
      sceneMeta.origin,
      assetSelection.buildings,
      triangulate,
      'warm',
      hooks.staticAtmosphere,
    ),
    materials.roofAccents.warm,
    {
      sourceCount: assetSelection.buildings.length,
      selectedCount: assetSelection.buildings.length,
      semanticCategory: 'building',
      sourceObjectIds: assetSelection.buildings.map((building) => building.objectId),
    },
  );
  hooks.addMeshNode(
    ctx.doc,
    ctx.Accessor,
    ctx.scene,
    ctx.buffer,
    'building_roof_accents_neutral',
    hooks.createBuildingRoofAccentGeometry(
      sceneMeta.origin,
      assetSelection.buildings,
      triangulate,
      'neutral',
      hooks.staticAtmosphere,
    ),
    materials.roofAccents.neutral,
    {
      sourceCount: assetSelection.buildings.length,
      selectedCount: assetSelection.buildings.length,
      semanticCategory: 'building',
      sourceObjectIds: assetSelection.buildings.map((building) => building.objectId),
    },
  );

  for (const panelGroup of hooks.groupFacadeHintsByPanelColor(
    selectedFacadeHints,
  )) {
    hooks.addMeshNode(
      ctx.doc,
      ctx.Accessor,
      ctx.scene,
      ctx.buffer,
      `building_panels_${panelGroup.tone}_${panelGroup.colorHex.slice(1)}_${Math.abs(hashKey((panelGroup as { groupKey?: string }).groupKey ?? `${panelGroup.tone}:${panelGroup.colorHex}`)).toString(36)}`,
      createBuildingPanelsGeometry(
        sceneMeta.origin,
        assetSelection.buildings,
        panelGroup.hints,
        panelGroup.tone,
      ),
      createBuildingPanelMaterial(
        ctx.doc,
        panelGroup.tone,
        panelGroup.colorHex,
        hooks.materialTuning,
        hooks.facadeMaterialProfile,
      ),
      {
        sourceCount: panelGroup.hints.length,
        selectedCount: assetSelection.buildings.length,
        semanticCategory: 'building',
        sourceObjectIds: panelGroup.hints.map((hint) => hint.objectId),
      },
    );
  }

  hooks.addMeshNode(
    ctx.doc,
    ctx.Accessor,
    ctx.scene,
    ctx.buffer,
    'building_windows',
    createBuildingWindowGeometry(
      sceneMeta.origin,
      assetSelection.buildings,
      sceneDetail.facadeHints,
      resolveWindowTriangleBudgetForSelection(assetSelection.buildings.length),
    ),
    materials.windowPrimary ??
      materials.windowGlassCurtainWall ??
      materials.windowGlassReflective ??
      materials.buildingPanels[
        hooks.resolveWindowMaterialTone(sceneDetail.facadeHints)
      ],
    {
      sourceCount: sceneDetail.facadeHints.length,
      selectedCount: assetSelection.buildings.length,
      semanticCategory: 'building',
      sourceObjectIds: sceneDetail.facadeHints.map((hint) => hint.objectId),
    },
  );
  hooks.addMeshNode(
    ctx.doc,
    ctx.Accessor,
    ctx.scene,
    ctx.buffer,
    'building_entrances',
    createBuildingEntranceGeometry(sceneMeta.origin, assetSelection.buildings),
    materials.entrancePrimary ??
      materials.facadePrimary ??
      materials.facadeConcreteMid ??
      materials.buildingPanels.neutral,
    {
      sourceCount: assetSelection.buildings.length,
      selectedCount: assetSelection.buildings.length,
      semanticCategory: 'building',
      sourceObjectIds: assetSelection.buildings.map((building) => building.objectId),
    },
  );
  hooks.addMeshNode(
    ctx.doc,
    ctx.Accessor,
    ctx.scene,
    ctx.buffer,
    'building_roof_equipment',
    createBuildingRoofEquipmentGeometry(
      sceneMeta.origin,
      assetSelection.buildings,
    ),
    materials.roofEquipmentPrimary ?? materials.roofAccents.neutral,
    {
      sourceCount: assetSelection.buildings.length,
      selectedCount: assetSelection.buildings.length,
      semanticCategory: 'building',
      sourceObjectIds: assetSelection.buildings.map((building) => building.objectId),
    },
  );

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
          semanticCategory: 'building',
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
        semanticCategory: 'building',
        sourceObjectIds: [
          ...sceneMeta.landmarkAnchors.map((item) => item.objectId),
          ...sceneDetail.signageClusters.map((item) => item.objectId),
        ],
      },
    );
  }
}

function hashKey(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33 + value.charCodeAt(index)) | 0;
  }
  return hash;
}
