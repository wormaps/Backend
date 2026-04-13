import {
  MaterialClass,
  SceneDetail,
  SceneMeta,
} from '../../../scene/types/scene.types';
import { ShellColorBucket } from '../../compiler/materials';
import { createSceneMaterials } from '../../compiler/materials';
import { createEnhancedSceneMaterials } from '../../compiler/materials';
import type {
  FacadeLayerMaterialProfile,
  MaterialTuningOptions,
} from '../../compiler/materials';
import type { SceneStaticAtmosphereProfile } from '../../../scene/types/scene.types';
import type { SceneVariationProfile } from '../../compiler/scene-variation';
import { buildSceneAssetSelection } from '../../../scene/utils/scene-asset-profile.utils';
import type { SceneModePolicy } from '../../../scene/utils/scene-mode-policy.utils';

export type AssetSelection = ReturnType<typeof buildSceneAssetSelection>;
export type SceneMaterials =
  | ReturnType<typeof createSceneMaterials>
  | ReturnType<typeof createEnhancedSceneMaterials>;

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
    trace?: {
      sourceCount?: number;
      selectedCount?: number;
      semanticCategory?: string;
      semanticCoverage?: 'NONE' | 'PARTIAL' | 'FULL';
    },
  ): void;
}

export interface RunnerStageHooks {
  addMeshNode: MeshAddDelegate;
  createCrosswalkGeometry: (
    origin: SceneMeta['origin'],
    crossings: SceneDetail['crossings'],
    roads?: SceneMeta['roads'],
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
    groupKey: string;
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
  resolveWindowMaterialTone: (
    facadeHints: SceneDetail['facadeHints'],
  ) => 'cool' | 'warm' | 'neutral';
  resolveHeroToneFromBuildings: (
    buildings: SceneMeta['buildings'],
  ) => 'cool' | 'warm' | 'neutral';
  materialTuning: MaterialTuningOptions;
  facadeMaterialProfile: FacadeLayerMaterialProfile;
  variationProfile: SceneVariationProfile;
  modePolicy: SceneModePolicy;
  staticAtmosphere?: SceneStaticAtmosphereProfile;
  createBuildingRoofAccentGeometry: (
    origin: SceneMeta['origin'],
    buildings: SceneMeta['buildings'],
    triangulate: (
      vertices: number[],
      holes?: number[],
      dimensions?: number,
    ) => number[],
    tone: 'cool' | 'warm' | 'neutral',
    staticAtmosphere?: SceneStaticAtmosphereProfile,
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
