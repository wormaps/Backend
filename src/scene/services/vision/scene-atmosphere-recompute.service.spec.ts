import type { SceneDetail, SceneMeta } from '../../types/scene.types';
import { SceneAtmosphereRecomputeService } from './scene-atmosphere-recompute.service';
import { SceneFacadeAtmosphereService } from './scene-facade-atmosphere.service';

describe('SceneAtmosphereRecomputeService', () => {
  const service = new SceneAtmosphereRecomputeService(
    new SceneFacadeAtmosphereService(),
  );

  const meta: SceneMeta = {
    sceneId: 'scene-1',
    placeId: 'place-1',
    name: 'Test Place',
    generatedAt: '2026-04-07T00:00:00Z',
    origin: { lat: 37.5, lng: 127 },
    camera: {
      topView: { x: 0, y: 150, z: 120 },
      walkViewStart: { x: 0, y: 1.7, z: 10 },
    },
    bounds: {
      radiusM: 450,
      northEast: { lat: 37.51, lng: 127.01 },
      southWest: { lat: 37.49, lng: 126.99 },
    },
    stats: {
      buildingCount: 1,
      roadCount: 1,
      walkwayCount: 0,
      poiCount: 0,
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
    detailStatus: 'PARTIAL',
    visualCoverage: {
      structure: 1,
      streetDetail: 0.4,
      landmark: 0.4,
      signage: 0.4,
    },
    materialClasses: [],
    landmarkAnchors: [],
    assetProfile: {
      preset: 'MEDIUM',
      budget: {
        buildingCount: 1,
        roadCount: 1,
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
        buildingCount: 1,
        roadCount: 1,
        walkwayCount: 0,
        poiCount: 0,
        crossingCount: 0,
        trafficLightCount: 0,
        streetLightCount: 0,
        signPoleCount: 0,
        treeClusterCount: 0,
        billboardPanelCount: 0,
      },
    },
    structuralCoverage: {
      selectedBuildingCoverage: 1,
      coreAreaBuildingCoverage: 1,
      fallbackMassingRate: 0,
      footprintPreservationRate: 1,
      heroLandmarkCoverage: 0,
    },
    roads: [
      {
        objectId: 'road-1',
        osmWayId: 'way_1',
        name: 'Road',
        laneCount: 2,
        roadClass: 'primary',
        widthMeters: 10,
        direction: 'TWO_WAY',
        path: [
          { lat: 37.5, lng: 127 },
          { lat: 37.5002, lng: 127.0002 },
        ],
        center: { lat: 37.5001, lng: 127.0001 },
        surface: 'asphalt',
        bridge: false,
        roadVisualClass: 'arterial',
      },
    ],
    buildings: [
      {
        objectId: 'building-1',
        osmWayId: 'way_2',
        name: 'Tower',
        heightMeters: 32,
        outerRing: [
          { lat: 37.5, lng: 127 },
          { lat: 37.5, lng: 127.0001 },
          { lat: 37.5001, lng: 127.0001 },
        ],
        holes: [],
        footprint: [
          { lat: 37.5, lng: 127 },
          { lat: 37.5, lng: 127.0001 },
          { lat: 37.5001, lng: 127.0001 },
        ],
        usage: 'COMMERCIAL',
        preset: 'glass_tower',
        roofType: 'flat',
        facadeColor: null,
        facadeMaterial: null,
        roofColor: null,
        roofMaterial: null,
        roofShape: null,
      },
    ],
    walkways: [],
    pois: [],
  };

  const detail: SceneDetail = {
    sceneId: 'scene-1',
    placeId: 'place-1',
    generatedAt: '2026-04-07T00:00:00Z',
    detailStatus: 'PARTIAL',
    crossings: [],
    roadMarkings: [],
    streetFurniture: [],
    vegetation: [],
    landCovers: [],
    linearFeatures: [],
    facadeHints: [
      {
        objectId: 'building-1',
        anchor: { lat: 37.50005, lng: 127.00005 },
        facadeEdgeIndex: 1,
        windowBands: 8,
        billboardEligible: true,
        palette: ['#4d79c7'],
        shellPalette: ['#4d79c7'],
        panelPalette: ['#d0deef'],
        materialClass: 'glass',
        signageDensity: 'high',
        emissiveStrength: 0.88,
        glazingRatio: 0.72,
        weakEvidence: false,
        contextProfile: 'NEON_CORE',
        districtCluster: 'core_commercial',
        districtConfidence: 0.82,
        evidenceStrength: 'strong',
      },
    ],
    signageClusters: [
      {
        objectId: 'cluster-1',
        anchor: { lat: 37.50005, lng: 127.00005 },
        panelCount: 4,
        palette: ['#ff7a90'],
        emissiveStrength: 0.92,
        widthMeters: 6,
        heightMeters: 2,
      },
    ],
    roadDecals: [],
    intersectionProfiles: [],
    geometryDiagnostics: [],
    annotationsApplied: ['override-1'],
    provenance: {
      mapillaryUsed: true,
      mapillaryImageCount: 10,
      mapillaryFeatureCount: 20,
      osmTagCoverage: {
        coloredBuildings: 0,
        materialBuildings: 0,
        crossings: 0,
        streetFurniture: 0,
        vegetation: 0,
      },
      overrideCount: 1,
    },
  };

  it('recomputes district/scene-wide/static atmosphere in one pass', () => {
    const result = service.recompute(meta, detail);

    expect(result.detail.districtAtmosphereProfiles?.length).toBeGreaterThan(0);
    expect(result.detail.sceneWideAtmosphereProfile).toBeDefined();
    expect(result.detail.staticAtmosphere).toBeDefined();
    expect(result.detail.staticAtmosphere?.wetRoadBoost).toBe(0);
    expect(result.meta.materialClasses[0]?.className).toBe('glass');
  });
});
