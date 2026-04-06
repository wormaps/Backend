import type {
  SceneBuildingMeta,
  SceneCrossingDetail,
  SceneDetail,
  SceneMeta,
  ScenePoiMeta,
  SceneRoadMeta,
  SceneStreetFurnitureDetail,
  SceneVegetationDetail,
  SceneWalkwayMeta,
} from '../types/scene.types';

export interface SceneAssetSelection {
  buildings: SceneBuildingMeta[];
  roads: SceneRoadMeta[];
  walkways: SceneWalkwayMeta[];
  pois: ScenePoiMeta[];
  crossings: SceneCrossingDetail[];
  trafficLights: SceneStreetFurnitureDetail[];
  streetLights: SceneStreetFurnitureDetail[];
  signPoles: SceneStreetFurnitureDetail[];
  vegetation: SceneVegetationDetail[];
  billboardPanels: SceneDetail['signageClusters'];
  budget: SceneMeta['assetProfile']['budget'];
  selected: SceneMeta['assetProfile']['selected'];
  structuralCoverage: SceneMeta['structuralCoverage'];
}
