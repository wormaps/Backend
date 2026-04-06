import {
  MaterialClass,
  SceneDetail,
  SceneMeta,
} from '../../../scene/types/scene.types';
import { ShellColorBucket } from '../../compiler/glb-material-factory';
import { createSceneMaterials } from '../../compiler/glb-material-factory';
import { buildSceneAssetSelection } from '../../../scene/utils/scene-asset-profile.utils';

export type AssetSelection = ReturnType<typeof buildSceneAssetSelection>;
export type SceneMaterials = ReturnType<typeof createSceneMaterials>;

export type GroupedBuildings = Map<
  string,
  {
    materialClass: MaterialClass;
    bucket: ShellColorBucket;
    colorHex: string;
    buildings: SceneMeta['buildings'];
  }
>;

export interface MeshAddContext {
  doc: any;
  Accessor: any;
  scene: any;
  buffer: any;
}

export interface MeshAddDelegate {
  (
    doc: any,
    AccessorRef: any,
    scene: any,
    buffer: any,
    name: string,
    geometry: {
      positions: number[];
      normals: number[];
      indices: number[];
    },
    material: any,
    trace?: { sourceCount?: number; selectedCount?: number },
  ): void;
}

export interface RunnerStageHooks {
  addMeshNode: MeshAddDelegate;
  createCrosswalkGeometry: (
    origin: SceneMeta['origin'],
    crossings: SceneDetail['crossings'],
  ) => { positions: number[]; normals: number[]; indices: number[] };
  triangulateRings: (
    outerRing: [number, number, number][],
    holes: [number, number, number][][],
    triangulate: (
      vertices: number[],
      holes?: number[],
      dimensions?: number,
    ) => number[],
  ) => Array<
    [
      [number, number, number],
      [number, number, number],
      [number, number, number],
    ]
  >;
  createStreetFurnitureGeometry: (
    origin: SceneMeta['origin'],
    items: SceneDetail['streetFurniture'],
    type: SceneDetail['streetFurniture'][number]['type'],
  ) => { positions: number[]; normals: number[]; indices: number[] };
  createPoiGeometry: (
    origin: SceneMeta['origin'],
    pois: SceneMeta['pois'],
  ) => { positions: number[]; normals: number[]; indices: number[] };
  createLandCoverGeometry: (
    origin: SceneMeta['origin'],
    covers: SceneDetail['landCovers'],
    type: SceneDetail['landCovers'][number]['type'],
    triangulate: (
      vertices: number[],
      holes?: number[],
      dimensions?: number,
    ) => number[],
  ) => { positions: number[]; normals: number[]; indices: number[] };
  createLinearFeatureGeometry: (
    origin: SceneMeta['origin'],
    features: SceneDetail['linearFeatures'],
    type: SceneDetail['linearFeatures'][number]['type'],
  ) => { positions: number[]; normals: number[]; indices: number[] };
  buildGroupedBuildingShells: (
    sceneMeta: SceneMeta,
    sceneDetail: SceneDetail,
    assetSelection: AssetSelection,
  ) => GroupedBuildings;
  groupFacadeHintsByPanelColor: (
    facadeHints: SceneDetail['facadeHints'],
  ) => Array<{
    tone: 'cool' | 'warm' | 'neutral';
    colorHex: string;
    hints: SceneDetail['facadeHints'];
  }>;
  groupBillboardClustersByColor: (
    selectedClusters: SceneDetail['signageClusters'],
    sourceClusters: SceneDetail['signageClusters'],
  ) => Array<{
    tone: 'cool' | 'warm' | 'neutral';
    colorHex: string;
    selectedClusters: SceneDetail['signageClusters'];
    sourceCount: number;
  }>;
  createBuildingRoofAccentGeometry: (
    origin: SceneMeta['origin'],
    buildings: SceneMeta['buildings'],
    triangulate: (
      vertices: number[],
      holes?: number[],
      dimensions?: number,
    ) => number[],
    tone: 'cool' | 'warm' | 'neutral',
  ) => { positions: number[]; normals: number[]; indices: number[] };
  addBuildingAndHeroMeshes: (
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
  ) => void;
}
