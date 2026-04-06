import {
  createBenchGeometry,
  createBikeRackGeometry,
  createEnhancedSignPoleGeometry,
  createEnhancedStreetLightGeometry,
  createFireHydrantGeometry,
  createTrashCanGeometry,
} from '../compiler/street-furniture-mesh.builder';
import {
  createBushGeometry,
  createFlowerBedGeometry,
  createTreeVariationGeometry,
} from '../compiler/vegetation-mesh.builder';
import {
  AssetSelection,
  MeshAddContext,
  RunnerStageHooks,
  SceneMaterials,
} from './glb-build-stage.types';
import { SceneDetail, SceneMeta } from '../../scene/types/scene.types';

export function addStreetContextMeshes(
  hooks: Pick<
    RunnerStageHooks,
    | 'addMeshNode'
    | 'createStreetFurnitureGeometry'
    | 'createPoiGeometry'
    | 'createLandCoverGeometry'
    | 'createLinearFeatureGeometry'
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
): void {
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
    ),
    materials.streetLight,
    {
      sourceCount: sceneDetail.streetFurniture.filter(
        (item) => item.type === 'STREET_LIGHT',
      ).length,
      selectedCount: assetSelection.streetLights.length,
    },
  );
  hooks.addMeshNode(
    ctx.doc,
    ctx.Accessor,
    ctx.scene,
    ctx.buffer,
    'sign_poles',
    createEnhancedSignPoleGeometry(sceneMeta.origin, assetSelection.signPoles),
    materials.signPole,
    {
      sourceCount: sceneDetail.streetFurniture.filter(
        (item) => item.type === 'SIGN_POLE',
      ).length,
      selectedCount: assetSelection.signPoles.length,
    },
  );
  hooks.addMeshNode(
    ctx.doc,
    ctx.Accessor,
    ctx.scene,
    ctx.buffer,
    'benches',
    createBenchGeometry(
      sceneMeta.origin,
      sceneDetail.streetFurniture.filter((item) => item.type === 'BENCH'),
    ),
    materials.bench,
    {
      sourceCount: sceneDetail.streetFurniture.filter(
        (item) => item.type === 'BENCH',
      ).length,
      selectedCount: sceneDetail.streetFurniture.filter(
        (item) => item.type === 'BENCH',
      ).length,
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
      sceneDetail.streetFurniture.filter((item) => item.type === 'BIKE_RACK'),
    ),
    materials.bikeRack,
    {
      sourceCount: sceneDetail.streetFurniture.filter(
        (item) => item.type === 'BIKE_RACK',
      ).length,
      selectedCount: sceneDetail.streetFurniture.filter(
        (item) => item.type === 'BIKE_RACK',
      ).length,
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
      sceneDetail.streetFurniture.filter((item) => item.type === 'TRASH_CAN'),
    ),
    materials.trashCan,
    {
      sourceCount: sceneDetail.streetFurniture.filter(
        (item) => item.type === 'TRASH_CAN',
      ).length,
      selectedCount: sceneDetail.streetFurniture.filter(
        (item) => item.type === 'TRASH_CAN',
      ).length,
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
      sceneDetail.streetFurniture.filter(
        (item) => item.type === 'FIRE_HYDRANT',
      ),
    ),
    materials.fireHydrant,
    {
      sourceCount: sceneDetail.streetFurniture.filter(
        (item) => item.type === 'FIRE_HYDRANT',
      ).length,
      selectedCount: sceneDetail.streetFurniture.filter(
        (item) => item.type === 'FIRE_HYDRANT',
      ).length,
    },
  );
  hooks.addMeshNode(
    ctx.doc,
    ctx.Accessor,
    ctx.scene,
    ctx.buffer,
    'trees_variation',
    createTreeVariationGeometry(sceneMeta.origin, assetSelection.vegetation),
    materials.treeVariation,
    {
      sourceCount: sceneDetail.vegetation.filter((item) => item.type === 'TREE')
        .length,
      selectedCount: assetSelection.vegetation.filter(
        (item) => item.type === 'TREE',
      ).length,
    },
  );
  hooks.addMeshNode(
    ctx.doc,
    ctx.Accessor,
    ctx.scene,
    ctx.buffer,
    'bushes',
    createBushGeometry(sceneMeta.origin, assetSelection.vegetation),
    materials.bush,
    {
      sourceCount: sceneDetail.vegetation.filter(
        (item) => item.type === 'GREEN_PATCH',
      ).length,
      selectedCount: assetSelection.vegetation.filter(
        (item) => item.type === 'GREEN_PATCH',
      ).length,
    },
  );
  hooks.addMeshNode(
    ctx.doc,
    ctx.Accessor,
    ctx.scene,
    ctx.buffer,
    'flower_beds',
    createFlowerBedGeometry(sceneMeta.origin, assetSelection.vegetation),
    materials.flowerBed,
    {
      sourceCount: sceneDetail.vegetation.filter(
        (item) => item.type === 'PLANTER',
      ).length,
      selectedCount: assetSelection.vegetation.filter(
        (item) => item.type === 'PLANTER',
      ).length,
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
    },
  );
}
