import {
  createBenchGeometry,
  createBikeRackGeometry,
  createEnhancedSignPoleGeometry,
  createEnhancedStreetLightGeometry,
  createFireHydrantGeometry,
  createTrashCanGeometry,
} from '../../../compiler/street-furniture';
import {
  createBushGeometry,
  createFlowerBedGeometry,
  createTreeVariationGeometry,
} from '../../../compiler/vegetation';
import {
  AssetSelection,
  MeshAddContext,
  RunnerStageHooks,
  SceneMaterials,
} from '../glb-build-stage.types';
import type { GlbInputContract } from '../glb-build-contract';

export function addStreetContextMeshes(
  hooks: Pick<
    RunnerStageHooks,
    | 'addMeshNode'
    | 'collectGraphIntent'
    | 'prototypeRegistry'
    | 'createStreetFurnitureGeometry'
    | 'createPoiGeometry'
    | 'createLandCoverGeometry'
    | 'variationProfile'
    | 'modePolicy'
    | 'createLinearFeatureGeometry'
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
): void {
  hooks.collectGraphIntent?.({
    stage: 'street_context',
    semanticCategory: 'street_context',
    sourceCount:
      sceneDetail.streetFurniture.length +
      sceneDetail.vegetation.length +
      sceneDetail.landCovers.length +
      sceneMeta.pois.length,
    selectedCount:
      assetSelection.trafficLights.length +
      assetSelection.streetLights.length +
      assetSelection.signPoles.length +
      assetSelection.vegetation.length +
      assetSelection.pois.length,
    loadTier: 'medium',
  });
  const benchItems = selectMinorFurniture(sceneDetail.streetFurniture, 'BENCH');
  const bikeRackItems = selectMinorFurniture(
    sceneDetail.streetFurniture,
    'BIKE_RACK',
  );
  const trashCanItems = selectMinorFurniture(
    sceneDetail.streetFurniture,
    'TRASH_CAN',
  );
  const hydrantItems = selectMinorFurniture(
    sceneDetail.streetFurniture,
    'FIRE_HYDRANT',
  );

  hooks.addMeshNode(
    ctx.doc,
    ctx.Accessor,
    ctx.scene,
    ctx.buffer,
    'traffic_lights',
    hooks.createStreetFurnitureGeometry(
      sceneMeta.origin,
      assetSelection.trafficLights,
      'TRAFFIC_LIGHT',
    ),
    materials.trafficLight,
    {
      sourceCount: sceneDetail.streetFurniture.filter(
        (item) => item.type === 'TRAFFIC_LIGHT',
      ).length,
      selectedCount: assetSelection.trafficLights.length,
      semanticCategory: 'street_context',
      sourceObjectIds: assetSelection.trafficLights.map(
        (item) => item.objectId,
      ),
    },
  );
  hooks.addMeshNode(
    ctx.doc,
    ctx.Accessor,
    ctx.scene,
    ctx.buffer,
    'street_lights',
    createEnhancedStreetLightGeometry(
      sceneMeta.origin,
      assetSelection.streetLights,
      hooks.variationProfile,
    ),
    materials.streetLight,
    {
      sourceCount: sceneDetail.streetFurniture.filter(
        (item) => item.type === 'STREET_LIGHT',
      ).length,
      selectedCount: assetSelection.streetLights.length,
      semanticCategory: 'street_context',
      sourceObjectIds: assetSelection.streetLights.map((item) => item.objectId),
    },
  );
  hooks.addMeshNode(
    ctx.doc,
    ctx.Accessor,
    ctx.scene,
    ctx.buffer,
    'sign_poles',
    createEnhancedSignPoleGeometry(
      sceneMeta.origin,
      assetSelection.signPoles,
      hooks.variationProfile,
    ),
    materials.signPole,
    {
      sourceCount: sceneDetail.streetFurniture.filter(
        (item) => item.type === 'SIGN_POLE',
      ).length,
      selectedCount: assetSelection.signPoles.length,
      semanticCategory: 'street_context',
      sourceObjectIds: assetSelection.signPoles.map((item) => item.objectId),
    },
  );
  if (hooks.modePolicy.stage.includeMinorFurniture) {
    hooks.addMeshNode(
      ctx.doc,
      ctx.Accessor,
      ctx.scene,
      ctx.buffer,
      'benches',
      createBenchGeometry(sceneMeta.origin, benchItems, hooks.variationProfile),
      materials.bench,
      {
        sourceCount: sceneDetail.streetFurniture.filter(
          (item) => item.type === 'BENCH',
        ).length,
        selectedCount: benchItems.length,
        semanticCategory: 'street_context',
        sourceObjectIds: benchItems.map((item) => item.objectId),
      },
    );
    hooks.addMeshNode(
      ctx.doc,
      ctx.Accessor,
      ctx.scene,
      ctx.buffer,
      'bike_racks',
      createBikeRackGeometry(
        sceneMeta.origin,
        bikeRackItems,
        hooks.variationProfile,
      ),
      materials.bikeRack,
      {
        sourceCount: sceneDetail.streetFurniture.filter(
          (item) => item.type === 'BIKE_RACK',
        ).length,
        selectedCount: bikeRackItems.length,
        semanticCategory: 'street_context',
        sourceObjectIds: bikeRackItems.map((item) => item.objectId),
      },
    );
    hooks.addMeshNode(
      ctx.doc,
      ctx.Accessor,
      ctx.scene,
      ctx.buffer,
      'trash_cans',
      createTrashCanGeometry(
        sceneMeta.origin,
        trashCanItems,
        hooks.variationProfile,
      ),
      materials.trashCan,
      {
        sourceCount: sceneDetail.streetFurniture.filter(
          (item) => item.type === 'TRASH_CAN',
        ).length,
        selectedCount: trashCanItems.length,
        semanticCategory: 'street_context',
        sourceObjectIds: trashCanItems.map((item) => item.objectId),
      },
    );
    hooks.addMeshNode(
      ctx.doc,
      ctx.Accessor,
      ctx.scene,
      ctx.buffer,
      'fire_hydrants',
      createFireHydrantGeometry(
        sceneMeta.origin,
        hydrantItems,
        hooks.variationProfile,
      ),
      materials.fireHydrant,
      {
        sourceCount: sceneDetail.streetFurniture.filter(
          (item) => item.type === 'FIRE_HYDRANT',
        ).length,
        selectedCount: hydrantItems.length,
        semanticCategory: 'street_context',
        sourceObjectIds: hydrantItems.map((item) => item.objectId),
      },
    );
  }
  hooks.addMeshNode(
    ctx.doc,
    ctx.Accessor,
    ctx.scene,
    ctx.buffer,
    'trees_variation',
    createTreeVariationGeometry(
      sceneMeta.origin,
      assetSelection.vegetation,
      hooks.variationProfile,
    ),
    materials.treeVariation,
    {
      sourceCount: sceneDetail.vegetation.filter((item) => item.type === 'TREE')
        .length,
      selectedCount: assetSelection.vegetation.filter(
        (item) => item.type === 'TREE',
      ).length,
      semanticCategory: 'street_context',
      sourceObjectIds: assetSelection.vegetation
        .filter((item) => item.type === 'TREE')
        .map((item) => item.objectId),
    },
  );
  hooks.addMeshNode(
    ctx.doc,
    ctx.Accessor,
    ctx.scene,
    ctx.buffer,
    'bushes',
    createBushGeometry(
      sceneMeta.origin,
      assetSelection.vegetation,
      hooks.variationProfile,
    ),
    materials.bush,
    {
      sourceCount: sceneDetail.vegetation.filter(
        (item) => item.type === 'GREEN_PATCH',
      ).length,
      selectedCount: assetSelection.vegetation.filter(
        (item) => item.type === 'GREEN_PATCH',
      ).length,
      semanticCategory: 'street_context',
      sourceObjectIds: assetSelection.vegetation
        .filter((item) => item.type === 'GREEN_PATCH')
        .map((item) => item.objectId),
    },
  );
  hooks.addMeshNode(
    ctx.doc,
    ctx.Accessor,
    ctx.scene,
    ctx.buffer,
    'flower_beds',
    createFlowerBedGeometry(
      sceneMeta.origin,
      assetSelection.vegetation,
      hooks.variationProfile,
    ),
    materials.flowerBed,
    {
      sourceCount: sceneDetail.vegetation.filter(
        (item) => item.type === 'PLANTER',
      ).length,
      selectedCount: assetSelection.vegetation.filter(
        (item) => item.type === 'PLANTER',
      ).length,
      semanticCategory: 'street_context',
      sourceObjectIds: assetSelection.vegetation
        .filter((item) => item.type === 'PLANTER')
        .map((item) => item.objectId),
    },
  );
  hooks.addMeshNode(
    ctx.doc,
    ctx.Accessor,
    ctx.scene,
    ctx.buffer,
    'poi_markers',
    hooks.createPoiGeometry(sceneMeta.origin, assetSelection.pois),
    materials.poi,
    {
      sourceCount: sceneMeta.pois.length,
      selectedCount: assetSelection.pois.length,
      semanticCategory: 'street_context',
      sourceObjectIds: assetSelection.pois.map((item) => item.objectId),
    },
  );
  hooks.addMeshNode(
    ctx.doc,
    ctx.Accessor,
    ctx.scene,
    ctx.buffer,
    'landcover_parks',
    hooks.createLandCoverGeometry(
      sceneMeta.origin,
      sceneDetail.landCovers,
      'PARK',
      triangulate,
    ),
    materials.landCoverPark,
    {
      sourceCount: sceneDetail.landCovers.filter((item) => item.type === 'PARK')
        .length,
      selectedCount: sceneDetail.landCovers.filter(
        (item) => item.type === 'PARK',
      ).length,
      semanticCategory: 'street_context',
      sourceObjectIds: sceneDetail.landCovers
        .filter((item) => item.type === 'PARK')
        .map((item) => item.id),
    },
  );
  hooks.addMeshNode(
    ctx.doc,
    ctx.Accessor,
    ctx.scene,
    ctx.buffer,
    'landcover_water',
    hooks.createLandCoverGeometry(
      sceneMeta.origin,
      sceneDetail.landCovers,
      'WATER',
      triangulate,
    ),
    materials.landCoverWater,
    {
      sourceCount: sceneDetail.landCovers.filter(
        (item) => item.type === 'WATER',
      ).length,
      selectedCount: sceneDetail.landCovers.filter(
        (item) => item.type === 'WATER',
      ).length,
      semanticCategory: 'street_context',
      sourceObjectIds: sceneDetail.landCovers
        .filter((item) => item.type === 'WATER')
        .map((item) => item.id),
    },
  );
  hooks.addMeshNode(
    ctx.doc,
    ctx.Accessor,
    ctx.scene,
    ctx.buffer,
    'landcover_plazas',
    hooks.createLandCoverGeometry(
      sceneMeta.origin,
      sceneDetail.landCovers,
      'PLAZA',
      triangulate,
    ),
    materials.landCoverPlaza,
    {
      sourceCount: sceneDetail.landCovers.filter(
        (item) => item.type === 'PLAZA',
      ).length,
      selectedCount: sceneDetail.landCovers.filter(
        (item) => item.type === 'PLAZA',
      ).length,
      semanticCategory: 'street_context',
      sourceObjectIds: sceneDetail.landCovers
        .filter((item) => item.type === 'PLAZA')
        .map((item) => item.id),
    },
  );
  hooks.addMeshNode(
    ctx.doc,
    ctx.Accessor,
    ctx.scene,
    ctx.buffer,
    'linear_railways',
    hooks.createLinearFeatureGeometry(
      sceneMeta.origin,
      sceneDetail.linearFeatures,
      'RAILWAY',
    ),
    materials.linearRailway,
    {
      sourceCount: sceneDetail.linearFeatures.filter(
        (item) => item.type === 'RAILWAY',
      ).length,
      selectedCount: sceneDetail.linearFeatures.filter(
        (item) => item.type === 'RAILWAY',
      ).length,
      semanticCategory: 'street_context',
      sourceObjectIds: sceneDetail.linearFeatures
        .filter((item) => item.type === 'RAILWAY')
        .map((item) => item.id),
    },
  );
  hooks.addMeshNode(
    ctx.doc,
    ctx.Accessor,
    ctx.scene,
    ctx.buffer,
    'linear_bridges',
    hooks.createLinearFeatureGeometry(
      sceneMeta.origin,
      sceneDetail.linearFeatures,
      'BRIDGE',
    ),
    materials.linearBridge,
    {
      sourceCount: sceneDetail.linearFeatures.filter(
        (item) => item.type === 'BRIDGE',
      ).length,
      selectedCount: sceneDetail.linearFeatures.filter(
        (item) => item.type === 'BRIDGE',
      ).length,
      semanticCategory: 'street_context',
      sourceObjectIds: sceneDetail.linearFeatures
        .filter((item) => item.type === 'BRIDGE')
        .map((item) => item.id),
    },
  );
  hooks.addMeshNode(
    ctx.doc,
    ctx.Accessor,
    ctx.scene,
    ctx.buffer,
    'linear_waterways',
    hooks.createLinearFeatureGeometry(
      sceneMeta.origin,
      sceneDetail.linearFeatures,
      'WATERWAY',
    ),
    materials.linearWaterway,
    {
      sourceCount: sceneDetail.linearFeatures.filter(
        (item) => item.type === 'WATERWAY',
      ).length,
      selectedCount: sceneDetail.linearFeatures.filter(
        (item) => item.type === 'WATERWAY',
      ).length,
      semanticCategory: 'street_context',
      sourceObjectIds: sceneDetail.linearFeatures
        .filter((item) => item.type === 'WATERWAY')
        .map((item) => item.id),
    },
  );
}

function selectMinorFurniture(
  items: GlbInputContract['streetFurniture'],
  type: GlbInputContract['streetFurniture'][number]['type'],
): GlbInputContract['streetFurniture'] {
  return items.filter((item) => item.type === type);
}
