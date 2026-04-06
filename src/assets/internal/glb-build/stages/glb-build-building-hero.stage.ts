import {
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
} from '../../../compiler/building-mesh.builder';
import {
  createBillboardMaterial,
  createBuildingPanelMaterial,
  createBuildingShellMaterial,
} from '../../../compiler/glb-material-factory';
import {
  AssetSelection,
  GroupedBuildings,
  MeshAddContext,
  RunnerStageHooks,
  SceneMaterials,
} from '../glb-build-stage.types';
import { SceneDetail, SceneMeta } from '../../../../scene/types/scene.types';

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
      ),
      {
        sourceCount: sceneMeta.buildings.length,
        selectedCount: group.buildings.length,
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
    ),
    materials.roofAccents.cool,
    {
      sourceCount: assetSelection.buildings.length,
      selectedCount: assetSelection.buildings.length,
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
    ),
    materials.roofAccents.warm,
    {
      sourceCount: assetSelection.buildings.length,
      selectedCount: assetSelection.buildings.length,
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
    ),
    materials.roofAccents.neutral,
    {
      sourceCount: assetSelection.buildings.length,
      selectedCount: assetSelection.buildings.length,
    },
  );

  for (const panelGroup of hooks.groupFacadeHintsByPanelColor(
    sceneDetail.facadeHints,
  )) {
    hooks.addMeshNode(
      ctx.doc,
      ctx.Accessor,
      ctx.scene,
      ctx.buffer,
      `building_panels_${panelGroup.tone}_${panelGroup.colorHex.slice(1)}`,
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
      ),
      {
        sourceCount: panelGroup.hints.length,
        selectedCount: assetSelection.buildings.length,
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
    ),
    materials.buildingPanels.neutral,
    {
      sourceCount: sceneDetail.facadeHints.length,
      selectedCount: assetSelection.buildings.length,
    },
  );
  hooks.addMeshNode(
    ctx.doc,
    ctx.Accessor,
    ctx.scene,
    ctx.buffer,
    'building_entrances',
    createBuildingEntranceGeometry(sceneMeta.origin, assetSelection.buildings),
    materials.buildingPanels.neutral,
    {
      sourceCount: assetSelection.buildings.length,
      selectedCount: assetSelection.buildings.length,
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
    materials.roofAccents.neutral,
    {
      sourceCount: assetSelection.buildings.length,
      selectedCount: assetSelection.buildings.length,
    },
  );

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
      ),
      {
        sourceCount: billboardGroup.sourceCount,
        selectedCount: billboardGroup.selectedClusters.length,
      },
    );
  }

  hooks.addMeshNode(
    ctx.doc,
    ctx.Accessor,
    ctx.scene,
    ctx.buffer,
    'hero_canopies',
    createHeroCanopyGeometry(sceneMeta.origin, assetSelection.buildings),
    materials.buildingPanels.neutral,
    {
      sourceCount: assetSelection.buildings.filter(
        (building) => (building.podiumSpec?.canopyEdges.length ?? 0) > 0,
      ).length,
      selectedCount: assetSelection.buildings.filter(
        (building) => (building.podiumSpec?.canopyEdges.length ?? 0) > 0,
      ).length,
    },
  );
  hooks.addMeshNode(
    ctx.doc,
    ctx.Accessor,
    ctx.scene,
    ctx.buffer,
    'hero_roof_units',
    createHeroRoofUnitGeometry(sceneMeta.origin, assetSelection.buildings),
    materials.roofAccents.neutral,
    {
      sourceCount: assetSelection.buildings.filter((building) =>
        Boolean(building.roofSpec?.roofUnits),
      ).length,
      selectedCount: assetSelection.buildings.filter((building) =>
        Boolean(building.roofSpec?.roofUnits),
      ).length,
    },
  );
  hooks.addMeshNode(
    ctx.doc,
    ctx.Accessor,
    ctx.scene,
    ctx.buffer,
    'hero_billboard_planes',
    createHeroBillboardPlaneGeometry(
      sceneMeta.origin,
      assetSelection.buildings,
    ),
    materials.billboards.warm,
    {
      sourceCount: assetSelection.buildings.filter(
        (building) => (building.signageSpec?.billboardFaces.length ?? 0) > 0,
      ).length,
      selectedCount: assetSelection.buildings.filter(
        (building) => (building.signageSpec?.billboardFaces.length ?? 0) > 0,
      ).length,
    },
  );
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
    },
  );
}
