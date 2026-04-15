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

    const correction = corrected.detail.geometryDiagnostics?.find(
      (item) => item.objectId === '__geometry_correction__',
    ) as {
      collisionRiskCount?: number;
      buildingOverlapCount?: number;
      groundedGapCount?: number;
      averageGroundOffsetM?: number;
      maxGroundOffsetM?: number;
      openShellCount?: number;
      roofWallGapCount?: number;
      invalidSetbackJoinCount?: number;
      terrainAnchoredBuildingCount?: number;
      terrainAnchoredRoadCount?: number;
      terrainAnchoredWalkwayCount?: number;
      transportTerrainCoverageRatio?: number;
    };

    expect(correction).toBeDefined();
    expect(correction.collisionRiskCount).toBe(1);
    expect(correction.buildingOverlapCount).toBe(0);
    expect(correction.groundedGapCount).toBe(1);
    expect((correction.averageGroundOffsetM ?? 0) > 0.06).toBe(true);
    expect((correction.maxGroundOffsetM ?? 0) > 0.06).toBe(true);
    expect(correction.openShellCount).toBe(0);
    expect(correction.roofWallGapCount).toBe(0);
    expect(correction.invalidSetbackJoinCount).toBe(0);
    expect(correction.terrainAnchoredBuildingCount).toBe(2);
    expect(correction.terrainAnchoredRoadCount).toBe(1);
    expect(correction.terrainAnchoredWalkwayCount).toBe(1);
    expect(correction.transportTerrainCoverageRatio).toBe(1);

    expect(closeBuilding?.collisionRisk).toBe('road_overlap');
    expect((closeBuilding?.groundOffsetM ?? 0) > 0.06).toBe(true);
    expect(Math.abs(closeBuilding?.terrainOffsetM ?? 0)).toBeGreaterThan(0);
    expect(farBuilding?.collisionRisk).toBe('none');
    expect(farBuilding?.groundOffsetM).toBe(0);
    expect(Math.abs(farBuilding?.terrainOffsetM ?? 0)).toBeGreaterThan(0);
    expect(
      Math.abs(corrected.meta.walkways[0]?.terrainOffsetM ?? 0),
    ).toBeGreaterThan(0);
  });

  it('marks edge-near building using anchor-based road proximity', () => {
    const step = new SceneGeometryCorrectionStep();
    const { meta, detail } = createFixture();
    meta.buildings = [
      {
        ...meta.buildings[0],
        objectId: 'building-edge-near',
        outerRing: [
          coordinate(35.6595, 139.70051),
          coordinate(35.65962, 139.70072),
          coordinate(35.65956, 139.70077),
        ],
      },
    ];

    const corrected = step.execute(meta, detail);
    expect(corrected.meta.buildings[0].collisionRisk).toBe('road_overlap');
    expect((corrected.meta.buildings[0].groundOffsetM ?? 0) > 0.06).toBe(true);
  });

  it('keeps distant buildings unmodified by adaptive offset', () => {
    const step = new SceneGeometryCorrectionStep();
    const { meta, detail } = createFixture();

    const corrected = step.execute(meta, detail);
    const farBuilding = corrected.meta.buildings.find(
      (building) => building.objectId === 'building-far',
    );
    expect(farBuilding?.collisionRisk).toBe('none');
    expect(farBuilding?.groundOffsetM).toBe(0);
  });

  it('marks overlapping buildings as collision risk even when road is far', () => {
    const step = new SceneGeometryCorrectionStep();
    const { meta, detail } = createFixture();

    meta.roads = [
      {
        ...meta.roads[0],
        objectId: 'road-far',
        osmWayId: 'road_far',
        path: [coordinate(35.7, 139.8), coordinate(35.7002, 139.8002)],
      },
    ];
    meta.buildings = [
      {
        ...meta.buildings[0],
        objectId: 'building-overlap-a',
        osmWayId: 'building_overlap_a',
        outerRing: [
          coordinate(35.6595, 139.7005),
          coordinate(35.6595, 139.70062),
          coordinate(35.65962, 139.70062),
          coordinate(35.65962, 139.7005),
        ],
      },
      {
        ...meta.buildings[1],
        objectId: 'building-overlap-b',
        osmWayId: 'building_overlap_b',
        outerRing: [
          coordinate(35.65956, 139.70056),
          coordinate(35.65956, 139.70068),
          coordinate(35.65968, 139.70068),
          coordinate(35.65968, 139.70056),
        ],
      },
    ];

    const corrected = step.execute(meta, detail);
    const correction = corrected.detail.geometryDiagnostics?.find(
      (item) => item.objectId === '__geometry_correction__',
    ) as {
      collisionRiskCount?: number;
      buildingOverlapCount?: number;
      overlapMitigationOutcomes?: Array<{
        objectId: string;
        strategy: string;
        severity: string;
        overlapAreaM2: number;
      }>;
      totalOverlapAreaM2?: number;
      highSeverityOverlapCount?: number;
      mediumSeverityOverlapCount?: number;
      lowSeverityOverlapCount?: number;
    };

    expect(corrected.meta.buildings[0].collisionRisk).toBe('none');
    expect(corrected.meta.buildings[1].collisionRisk).toBe('none');
    expect((corrected.meta.buildings[0].groundOffsetM ?? 0) > 0).toBe(true);
    expect((corrected.meta.buildings[1].groundOffsetM ?? 0) > 0).toBe(true);
    expect(correction.collisionRiskCount).toBe(0);
    expect(correction.buildingOverlapCount).toBe(2);
    expect(correction.overlapMitigationOutcomes).toBeDefined();
    expect(correction.overlapMitigationOutcomes?.length).toBe(2);
    expect(correction.totalOverlapAreaM2).toBeGreaterThan(0);
    expect(correction.overlapMitigationOutcomes?.[0].strategy).not.toBe('none');
    expect(correction.overlapMitigationOutcomes?.[1].strategy).not.toBe('none');
    expect(correction.overlapMitigationOutcomes?.[0].severity).toBeDefined();
    expect(correction.overlapMitigationOutcomes?.[1].severity).toBeDefined();
  });

  it('keeps terrain coverage as fully anchored on flat terrain samples', () => {
    const step = new SceneGeometryCorrectionStep();
    const { meta, detail } = createFixture();

    meta.terrainProfile = {
      ...(meta.terrainProfile ?? {
        mode: 'LOCAL_DEM_SAMPLES',
        source: 'LOCAL_FILE',
        hasElevationModel: true,
        heightReference: 'LOCAL_DEM',
        baseHeightMeters: 30,
        sampleCount: 1,
        minHeightMeters: 30,
        maxHeightMeters: 30,
        sourcePath: '/tmp/flat-terrain.json',
        notes: 'flat terrain',
        samples: [
          { location: coordinate(35.6595, 139.7005), heightMeters: 30 },
        ],
      }),
      baseHeightMeters: 30,
      minHeightMeters: 30,
      maxHeightMeters: 30,
      samples: [
        { location: coordinate(35.6595, 139.7005), heightMeters: 30 },
        { location: coordinate(35.65975, 139.70072), heightMeters: 30 },
      ],
    };

    const corrected = step.execute(meta, detail);
    const correction = corrected.detail.geometryDiagnostics?.find(
      (item) => item.objectId === '__geometry_correction__',
    ) as {
      transportTerrainCoverageRatio?: number;
      terrainAnchoredRoadCount?: number;
      terrainAnchoredWalkwayCount?: number;
    };

    expect(correction.terrainAnchoredRoadCount).toBe(1);
    expect(correction.terrainAnchoredWalkwayCount).toBe(1);
    expect(correction.transportTerrainCoverageRatio).toBe(1);
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
      walkwayCount: 1,
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
        walkwayCount: 1,
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
        walkwayCount: 1,
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
    terrainProfile: {
      mode: 'LOCAL_DEM_SAMPLES',
      source: 'LOCAL_FILE',
      hasElevationModel: true,
      heightReference: 'LOCAL_DEM',
      baseHeightMeters: 30,
      sampleCount: 2,
      minHeightMeters: 30,
      maxHeightMeters: 34,
      sourcePath: '/tmp/scene-geometry-correction.terrain.json',
      notes: 'spec terrain',
      samples: [
        {
          location: coordinate(35.6595, 139.7005),
          heightMeters: 30,
        },
        {
          location: coordinate(35.66095, 139.70205),
          heightMeters: 34,
        },
      ],
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
    walkways: [
      {
        objectId: 'walkway-1',
        osmWayId: 'walkway_1',
        name: 'walkway',
        widthMeters: 3,
        walkwayType: 'footway',
        surface: 'paving_stones',
        path: [
          coordinate(35.65955, 139.70055),
          coordinate(35.65975, 139.70072),
        ],
      },
    ],
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
