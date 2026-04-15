import { buildGlbInputContract } from './glb-build-contract';
import type { SceneDetail, SceneMeta } from '../../../scene/types/scene.types';
import type { SceneAssetSelection } from '../../../scene/services/asset-profile/scene-asset-profile.types';

describe('buildGlbInputContract', () => {
  it('preserves SceneMeta and SceneDetail fields', () => {
    const sceneMeta = createSceneMeta();
    const sceneDetail = createSceneDetail();
    const assetSelection = createAssetSelection();

    const contract = buildGlbInputContract(
      sceneMeta,
      sceneDetail,
      assetSelection,
    );

    expect(contract.version).toBe('glb-input.v1');
    expect(contract.sceneId).toBe(sceneMeta.sceneId);
    expect(contract.name).toBe(sceneMeta.name);
    expect(contract.origin).toEqual(sceneMeta.origin);
    expect(contract.facadeHints).toEqual(sceneDetail.facadeHints);
    expect(contract.signageClusters).toEqual(sceneDetail.signageClusters);
    expect(contract.assetSelection).toEqual(assetSelection);
  });

  it('prefers meta structuralCoverage when detail has stale value', () => {
    const sceneMeta = createSceneMeta();
    const sceneDetail = {
      ...createSceneDetail(),
      structuralCoverage: {
        selectedBuildingCoverage: 0.01,
        coreAreaBuildingCoverage: 0.02,
        fallbackMassingRate: 0.99,
        footprintPreservationRate: 0.03,
        heroLandmarkCoverage: 0.04,
      },
    } as SceneDetail;
    const assetSelection = createAssetSelection();

    const contract = buildGlbInputContract(
      sceneMeta,
      sceneDetail,
      assetSelection,
    );

    expect(contract.structuralCoverage).toEqual(sceneMeta.structuralCoverage);
  });

  it('attaches progressive/selective loading hints in contract', () => {
    const contract = buildGlbInputContract(
      createSceneMeta(),
      createSceneDetail(),
      createAssetSelection(),
    );

    expect(contract.loadingHints).toBeDefined();
    expect(contract.loadingHints?.selectiveLoading).toBe(true);
    expect(contract.loadingHints?.progressiveLoading).toBe(true);
    expect(contract.loadingHints?.defaultNodeOrder).toContain('transport');
    expect(contract.loadingHints?.defaultNodeOrder).toContain(
      'building_lod_high',
    );
    expect(contract.extensionIntents?.msftLodNodeLevel).toBe(true);
    expect(contract.extensionIntents?.extMeshGpuInstancing).toBe(true);
  });
});

function createSceneMeta(): SceneMeta {
  return {
    sceneId: 'scene-test',
    placeId: 'place-1',
    name: 'Test Scene',
    generatedAt: '2024-01-01T00:00:00Z',
    origin: { lat: 35.6762, lng: 139.6503 },
    camera: {
      topView: { x: 0, y: 1, z: 2 },
      walkViewStart: { x: 0, y: 1, z: 2 },
    },
    bounds: {
      radiusM: 100,
      northEast: { lat: 35.6772, lng: 139.6513 },
      southWest: { lat: 35.6752, lng: 139.6493 },
    },
    stats: {
      buildingCount: 10,
      roadCount: 5,
      walkwayCount: 3,
      poiCount: 2,
    },
    diagnostics: {
      droppedBuildings: 0,
      droppedRoads: 0,
      droppedWalkways: 0,
      droppedPois: 0,
      droppedCrossings: 0,
      droppedStreetFurniture: 0,
      droppedVegetation: 0,
      droppedLandCovers: 0,
      droppedLinearFeatures: 0,
    },
    detailStatus: 'FULL',
    visualCoverage: {
      structure: 0.8,
      streetDetail: 0.6,
      landmark: 0.4,
      signage: 0.3,
    },
    materialClasses: [],
    landmarkAnchors: [],
    assetProfile: {
      preset: 'MEDIUM',
      budget: {
        buildingCount: 20,
        roadCount: 10,
        walkwayCount: 5,
        poiCount: 3,
        crossingCount: 4,
        trafficLightCount: 6,
        streetLightCount: 8,
        signPoleCount: 5,
        treeClusterCount: 7,
        billboardPanelCount: 2,
      },
      selected: {
        buildingCount: 10,
        roadCount: 5,
        walkwayCount: 3,
        poiCount: 2,
        crossingCount: 2,
        trafficLightCount: 3,
        streetLightCount: 4,
        signPoleCount: 2,
        treeClusterCount: 3,
        billboardPanelCount: 1,
      },
    },
    structuralCoverage: {
      selectedBuildingCoverage: 0.5,
      coreAreaBuildingCoverage: 0.6,
      fallbackMassingRate: 0.1,
      footprintPreservationRate: 0.9,
      heroLandmarkCoverage: 0.3,
    },
    roads: [],
    buildings: [],
    walkways: [],
    pois: [],
  };
}

function createSceneDetail(): SceneDetail {
  return {
    sceneId: 'scene-test',
    placeId: 'place-1',
    generatedAt: '2024-01-01T00:00:00Z',
    detailStatus: 'FULL',
    crossings: [],
    roadMarkings: [],
    streetFurniture: [],
    vegetation: [],
    landCovers: [],
    linearFeatures: [],
    facadeHints: [],
    signageClusters: [],
    annotationsApplied: [],
    provenance: {
      mapillaryUsed: false,
      mapillaryImageCount: 0,
      mapillaryFeatureCount: 0,
      osmTagCoverage: {
        coloredBuildings: 0,
        materialBuildings: 0,
        crossings: 0,
        streetFurniture: 0,
        vegetation: 0,
      },
      overrideCount: 0,
    },
  };
}

function createAssetSelection(): SceneAssetSelection {
  return {
    buildings: [],
    roads: [],
    walkways: [],
    pois: [],
    crossings: [],
    trafficLights: [],
    streetLights: [],
    signPoles: [],
    vegetation: [],
    billboardPanels: [],
    budget: {
      buildingCount: 0,
      roadCount: 0,
      walkwayCount: 0,
      poiCount: 0,
      crossingCount: 0,
      trafficLightCount: 0,
      streetLightCount: 0,
      signPoleCount: 0,
      treeClusterCount: 0,
      billboardPanelCount: 0,
    },
    selected: {
      buildingCount: 0,
      roadCount: 0,
      walkwayCount: 0,
      poiCount: 0,
      crossingCount: 0,
      trafficLightCount: 0,
      streetLightCount: 0,
      signPoleCount: 0,
      treeClusterCount: 0,
      billboardPanelCount: 0,
    },
    structuralCoverage: {
      selectedBuildingCoverage: 0,
      coreAreaBuildingCoverage: 0,
      fallbackMassingRate: 0,
      footprintPreservationRate: 0,
      heroLandmarkCoverage: 0,
    },
  };
}
