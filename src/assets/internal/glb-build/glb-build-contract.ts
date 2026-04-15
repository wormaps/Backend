import type {
  SceneMeta,
  SceneDetail,
  SceneScale,
  SceneStaticAtmosphereProfile,
  SceneFidelityPlan,
  SceneStructuralCoverage,
  SceneFacadeContextDiagnostics,
  SceneGeometryDiagnostic,
  SceneWideAtmosphereProfile,
  DistrictAtmosphereProfile,
  SceneFacadeHint,
  SceneCrossingDetail,
  SceneRoadMarkingDetail,
  SceneRoadDecal,
  SceneSignageCluster,
  SceneStreetFurnitureDetail,
  SceneVegetationDetail,
  SceneIntersectionProfile,
  ScenePlaceReadabilityDiagnostics,
  SceneBuildingMeta,
  SceneRoadMeta,
  SceneWalkwayMeta,
  ScenePoiMeta,
  SceneQualityGateResult,
  SceneTerrainProfile,
  SceneVisualCoverage,
  SceneMaterialClassSummary,
  SceneLandmarkAnchor,
  SceneDetailStatus,
  SceneAssetCounts,
} from '../../../scene/types/scene.types';
import type {
  LandCoverData,
  LinearFeatureData,
  Coordinate,
  PlacePackage,
} from '../../../places/types/place.types';
import type { SceneAssetSelection } from '../../../scene/utils/scene-asset-profile.utils';

export type GlbInputContract = SceneMeta &
  SceneDetail & {
    readonly version: 'glb-input.v1';
    readonly assetSelection: SceneAssetSelection;
    readonly loadingHints?: {
      selectiveLoading: boolean;
      progressiveLoading: boolean;
      defaultNodeOrder: string[];
      chunkPriority: Array<{
        key: string;
        priority: 'high' | 'medium' | 'low';
      }>;
    };
  };

export function buildGlbInputContract(
  sceneMeta: SceneMeta,
  sceneDetail: SceneDetail,
  assetSelection: SceneAssetSelection,
): GlbInputContract {
  const { structuralCoverage: _detailStructuralCoverage, ...restDetail } =
    sceneDetail;
  void _detailStructuralCoverage;

  return {
    ...sceneMeta,
    ...restDetail,
    structuralCoverage: sceneMeta.structuralCoverage,
    version: 'glb-input.v1',
    assetSelection,
    loadingHints: {
      selectiveLoading: true,
      progressiveLoading: true,
      defaultNodeOrder: [
        'transport',
        'building_lod_high',
        'street_context',
        'building_lod_medium',
        'building_lod_low',
        'landmark',
      ],
      chunkPriority: [
        { key: 'transport', priority: 'high' },
        { key: 'building_lod_high', priority: 'high' },
        { key: 'street_context', priority: 'medium' },
        { key: 'building_lod_medium', priority: 'medium' },
        { key: 'building_lod_low', priority: 'low' },
        { key: 'landmark', priority: 'medium' },
      ],
    },
  };
}
