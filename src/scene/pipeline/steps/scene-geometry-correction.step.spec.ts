import { SceneGeometryCorrectionStep } from './scene-geometry-correction.step';
import type { SceneDetail, SceneMeta } from '../../types/scene.types';

function coordinate(lat: number, lng: number) {
  return { lat, lng };
}

describe('SceneGeometryCorrectionStep', () => {
  it('marks buildings overlapping roads with collision risk and grounding offset', () => {
    const step = new SceneGeometryCorrectionStep();
    const { meta, detail } = createFixture();

    const corrected = step.execute(meta, detail);
    const closeBuilding = corrected.meta.buildings.find(
      (building) => building.objectId === 'building-close',
    );
    const farBuilding = corrected.meta.buildings.find(
      (building) => building.objectId === 'building-far',
    );

    expect(closeBuilding?.collisionRisk).toBe('none');
    expect(closeBuilding?.groundOffsetM).toBe(0);
    expect(farBuilding?.collisionRisk).toBe('none');
    expect(farBuilding?.groundOffsetM).toBe(0);
    const correction = corrected.detail.geometryDiagnostics?.find(
      (item) => item.objectId === '__geometry_correction__',
    ) as {
      collisionRiskCount?: number;
      groundedGapCount?: number;
    };

    expect(correction).toBeDefined();
    expect(correction.collisionRiskCount).toBe(0);
    expect(correction.groundedGapCount).toBe(0);
  });

  it('does not mark distant building as collision risk with adaptive threshold', () => {
    const step = new SceneGeometryCorrectionStep();
    const { meta, detail } = createFixture();
    meta.buildings = [
      {
        ...meta.buildings[0],
        objectId: 'building-threshold',
        outerRing: [
          coordinate(35.65953, 139.7006),
          coordinate(35.65957, 139.70064),
          coordinate(35.65949, 139.70066),
        ],
      },
    ];

    const corrected = step.execute(meta, detail);
    expect(corrected.meta.buildings[0].collisionRisk).toBe('none');
  });
});

function createFixture(): { meta: SceneMeta; detail: SceneDetail } {
  const meta: SceneMeta = {
    sceneId: 'scene-geometry-correction',
    placeId: 'place-1',
    name: 'Geometry correction test',
    generatedAt: '2026-04-08T00:00:00.000Z',
    origin: coordinate(35.6595, 139.7005),
    camera: {
      topView: { x: 0, y: 120, z: 90 },
      walkViewStart: { x: 0, y: 1.7, z: 6 },
    },
    bounds: {
      radiusM: 600,
      northEast: coordinate(35.66, 139.701),
      southWest: coordinate(35.659, 139.7),
    },
    stats: {
      buildingCount: 2,
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
    detailStatus: 'FULL',
    visualCoverage: {
      structure: 1,
      streetDetail: 1,
      landmark: 1,
      signage: 1,
    },
    materialClasses: [],
    landmarkAnchors: [],
    assetProfile: {
      preset: 'MEDIUM',
      budget: {
        buildingCount: 2,
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
        buildingCount: 2,
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
      heroLandmarkCoverage: 1,
    },
    roads: [
      {
        objectId: 'road-1',
        osmWayId: 'road_1',
        name: 'road',
        laneCount: 2,
        roadClass: 'primary',
        widthMeters: 10,
        direction: 'TWO_WAY',
        path: [coordinate(35.6595, 139.7005), coordinate(35.6598, 139.7008)],
        center: coordinate(35.65965, 139.70065),
        surface: null,
        bridge: false,
        roadVisualClass: 'arterial',
      },
    ],
    buildings: [
      {
        objectId: 'building-close',
        osmWayId: 'building_close',
        name: 'close',
        heightMeters: 20,
        outerRing: [
          coordinate(35.65952, 139.70052),
          coordinate(35.65956, 139.70056),
          coordinate(35.6595, 139.70058),
        ],
        holes: [],
        footprint: [],
        usage: 'COMMERCIAL',
        facadeColor: '#888888',
        facadeMaterial: 'mixed',
        roofColor: '#777777',
        roofMaterial: 'concrete',
        roofShape: 'flat',
        buildingPart: 'yes',
        preset: 'mixed_midrise',
        roofType: 'flat',
      },
      {
        objectId: 'building-far',
        osmWayId: 'building_far',
        name: 'far',
        heightMeters: 16,
        outerRing: [
          coordinate(35.661, 139.702),
          coordinate(35.66104, 139.70204),
          coordinate(35.66096, 139.70208),
        ],
        holes: [],
        footprint: [],
        usage: 'MIXED',
        facadeColor: '#777777',
        facadeMaterial: 'mixed',
        roofColor: '#666666',
        roofMaterial: 'concrete',
        roofShape: 'flat',
        buildingPart: 'yes',
        preset: 'small_lowrise',
        roofType: 'flat',
      },
    ],
    walkways: [],
    pois: [],
  };

  const detail: SceneDetail = {
    sceneId: meta.sceneId,
    placeId: meta.placeId,
    generatedAt: meta.generatedAt,
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

  return { meta, detail };
}
