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
  };
}
