import {
  createGroundGeometry,
  createRoadMarkingsGeometry,
  createCrosswalkGeometry,
  createRoadDecalPathGeometry,
  createRoadDecalPolygonGeometry,
  createRoadDecalStripeGeometry,
  createRoadEdgeGeometry,
  createRoadBaseGeometry,
  createWalkwayGeometry,
  createCurbGeometry,
  createMedianGeometry,
  createSidewalkEdgeGeometry,
} from './road-mesh.builder';

function coordinate(lat: number, lng: number) {
  return { lat, lng };
}

describe('road-mesh.builder', () => {
  it('builds stripe geometry from hero stripe_set decals', () => {
    const geometry = createRoadDecalStripeGeometry(
      coordinate(35.659482, 139.7005596),
      [
        {
          objectId: 'hero-stripes',
          type: 'CROSSWALK_OVERLAY',
          color: '#f8f8f6',
          emphasis: 'hero',
          priority: 'hero',
          layer: 'crosswalk_overlay',
          shapeKind: 'stripe_set',
          styleToken: 'scramble_white',
          stripeSet: {
            centerPath: [
              coordinate(35.65978, 139.70023),
              coordinate(35.65918, 139.70088),
            ],
            stripeCount: 8,
            stripeDepth: 0.9,
            halfWidth: 8,
          },
        },
      ],
      ['CROSSWALK_OVERLAY'],
    );

    expect(geometry.positions.length).toBeGreaterThan(0);
    expect(geometry.indices.length).toBeGreaterThan(0);
    const yValues = geometry.positions.filter((_, index) => index % 3 === 1);
    expect(Math.max(...yValues)).toBeGreaterThanOrEqual(0.058);
  });

  it('builds edge geometry for roads to separate asphalt from curb bands', () => {
    const geometry = createRoadEdgeGeometry(
      coordinate(35.659482, 139.7005596),
      [
        {
          objectId: 'road-1',
          osmWayId: 'way_1',
          name: 'Road',
          laneCount: 4,
          roadClass: 'primary',
          widthMeters: 14,
          direction: 'TWO_WAY',
          path: [coordinate(35.6593, 139.7002), coordinate(35.6597, 139.7008)],
          center: coordinate(35.6595, 139.7005),
          surface: 'asphalt',
          bridge: false,
        },
      ],
    );

    expect(geometry.positions.length).toBeGreaterThan(0);
    expect(geometry.indices.length).toBeGreaterThan(0);
  });

  it('applies terrain offset to road base geometry when provided', () => {
    const geometry = createRoadBaseGeometry(
      coordinate(35.659482, 139.7005596),
      [
        {
          objectId: 'road-1',
          osmWayId: 'way_1',
          name: 'Road',
          laneCount: 4,
          roadClass: 'primary',
          widthMeters: 14,
          direction: 'TWO_WAY',
          path: [coordinate(35.6593, 139.7002), coordinate(35.6597, 139.7008)],
          center: coordinate(35.6595, 139.7005),
          surface: 'asphalt',
          bridge: false,
          terrainOffsetM: 0.12,
        },
      ],
    );

    const yValues = geometry.positions.filter((_, index) => index % 3 === 1);
    expect(Math.min(...yValues)).toBeGreaterThanOrEqual(0.16 - 1e-6);
  });

  it('uses local terrain profile samples for ground relief when available', () => {
    const geometry = createGroundGeometry({
      sceneId: 'scene-terrain',
      placeId: 'place-terrain',
      name: 'Terrain Scene',
      generatedAt: '2026-04-13T00:00:00Z',
      origin: coordinate(35.659482, 139.7005596),
      camera: {
        topView: { x: 0, y: 180, z: 140 },
        walkViewStart: { x: 0, y: 1.7, z: 12 },
      },
      bounds: {
        radiusM: 120,
        northEast: coordinate(35.6602, 139.7012),
        southWest: coordinate(35.6588, 139.6998),
      },
      stats: {
        buildingCount: 0,
        roadCount: 0,
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
      detailStatus: 'OSM_ONLY',
      visualCoverage: {
        structure: 0,
        streetDetail: 0,
        landmark: 0,
        signage: 0,
      },
      materialClasses: [],
      landmarkAnchors: [],
      assetProfile: {
        preset: 'MEDIUM',
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
      },
      structuralCoverage: {
        selectedBuildingCoverage: 0,
        coreAreaBuildingCoverage: 0,
        fallbackMassingRate: 0,
        footprintPreservationRate: 0,
        heroLandmarkCoverage: 0,
      },
      roads: [],
      buildings: [],
      walkways: [],
      pois: [],
      terrainProfile: {
        mode: 'LOCAL_DEM_SAMPLES',
        source: 'LOCAL_FILE',
        hasElevationModel: true,
        heightReference: 'LOCAL_DEM',
        baseHeightMeters: 32,
        sampleCount: 2,
        minHeightMeters: 32,
        maxHeightMeters: 36,
        sourcePath: '/tmp/spec.terrain.json',
        notes: 'spec terrain',
        samples: [
          {
            location: coordinate(35.6592, 139.7001),
            heightMeters: 32,
          },
          {
            location: coordinate(35.6601, 139.7010),
            heightMeters: 36,
          },
        ],
      },
    });

    const yValues = geometry.positions.filter((_, index) => index % 3 === 1);
    expect(Math.max(...yValues)).toBeGreaterThan(-0.01);
    expect(Math.max(...yValues) - Math.min(...yValues)).toBeGreaterThan(0.01);
  });

  it('renders principal crossings with stronger visibility than non-principal crossings', () => {
    const origin = coordinate(35.659482, 139.7005596);
    const standard = createCrosswalkGeometry(origin, [
      {
        objectId: 'crossing-standard',
        name: 'Standard',
        type: 'CROSSING',
        crossing: 'zebra',
        crossingRef: null,
        signalized: false,
        principal: false,
        style: 'zebra',
        path: [coordinate(35.6593, 139.7002), coordinate(35.6598, 139.7008)],
        center: coordinate(35.65955, 139.7005),
      },
    ]);
    const principal = createCrosswalkGeometry(origin, [
      {
        objectId: 'crossing-principal',
        name: 'Principal',
        type: 'CROSSING',
        crossing: 'zebra',
        crossingRef: null,
        signalized: true,
        principal: true,
        style: 'signalized',
        path: [coordinate(35.6593, 139.7002), coordinate(35.6598, 139.7008)],
        center: coordinate(35.65955, 139.7005),
      },
    ]);

    const standardX = standard.positions.filter((_, i) => i % 3 === 0);
    const principalX = principal.positions.filter((_, i) => i % 3 === 0);
    const standardWidth = Math.max(...standardX) - Math.min(...standardX);
    const principalWidth = Math.max(...principalX) - Math.min(...principalX);

    expect(principal.indices.length).toBeGreaterThan(standard.indices.length);
    expect(principalWidth).toBeGreaterThan(standardWidth);
  });

  it('lifts crossings with the nearest road terrain offset', () => {
    const origin = coordinate(35.659482, 139.7005596);
    const geometry = createCrosswalkGeometry(
      origin,
      [
        {
          objectId: 'crossing-terrain',
          name: 'Terrain Crossing',
          type: 'CROSSING',
          crossing: 'zebra',
          crossingRef: null,
          signalized: true,
          principal: true,
          style: 'signalized',
          path: [coordinate(35.6593, 139.7002), coordinate(35.6598, 139.7008)],
          center: coordinate(35.65955, 139.7005),
        },
      ],
      [
        {
          objectId: 'road-1',
          osmWayId: 'way_1',
          name: 'Road',
          laneCount: 4,
          roadClass: 'primary',
          widthMeters: 14,
          direction: 'TWO_WAY',
          path: [coordinate(35.6593, 139.7002), coordinate(35.6598, 139.7008)],
          center: coordinate(35.6595, 139.7005),
          surface: 'asphalt',
          bridge: false,
          terrainOffsetM: 0.11,
        },
      ],
    );

    const yValues = geometry.positions.filter((_, index) => index % 3 === 1);
    expect(Math.min(...yValues)).toBeGreaterThanOrEqual(0.252 - 1e-6);
  });

  it('applies terrain offset to walkway and sidewalk edge geometry', () => {
    const origin = coordinate(35.659482, 139.7005596);
    const walkways = [
      {
        objectId: 'walkway-1',
        osmWayId: 'walkway_1',
        name: 'Walkway',
        path: [coordinate(35.6593, 139.7002), coordinate(35.6597, 139.7008)],
        widthMeters: 3,
        walkwayType: 'footway',
        surface: 'paving_stones',
        terrainOffsetM: 0.09,
      },
    ];

    const walkwayGeometry = createWalkwayGeometry(origin, walkways);
    const edgeGeometry = createSidewalkEdgeGeometry(origin, walkways);
    const walkwayY = walkwayGeometry.positions.filter(
      (_, index) => index % 3 === 1,
    );
    const edgeY = edgeGeometry.positions.filter((_, index) => index % 3 === 1);

    expect(Math.min(...walkwayY)).toBeGreaterThanOrEqual(0.12 - 1e-6);
    expect(Math.max(...edgeY)).toBeGreaterThanOrEqual(0.216 - 1e-6);
  });

  it('applies terrain offset to curb and median geometry', () => {
    const origin = coordinate(35.659482, 139.7005596);
    const roads = [
      {
        objectId: 'road-1',
        osmWayId: 'way_1',
        name: 'Road',
        laneCount: 4,
        roadClass: 'primary',
        widthMeters: 14,
        direction: 'TWO_WAY' as const,
        path: [coordinate(35.6593, 139.7002), coordinate(35.6597, 139.7008)],
        center: coordinate(35.6595, 139.7005),
        surface: 'asphalt',
        bridge: false,
        terrainOffsetM: 0.1,
      },
    ];

    const curbGeometry = createCurbGeometry(origin, roads);
    const medianGeometry = createMedianGeometry(origin, roads);
    const curbY = curbGeometry.positions.filter((_, index) => index % 3 === 1);
    const medianY = medianGeometry.positions.filter(
      (_, index) => index % 3 === 1,
    );

    expect(Math.min(...curbY)).toBeGreaterThanOrEqual(0.14 - 1e-6);
    expect(Math.max(...curbY)).toBeGreaterThanOrEqual(0.32 - 1e-6);
    expect(Math.min(...medianY)).toBeGreaterThanOrEqual(0.15 - 1e-6);
    expect(Math.max(...medianY)).toBeGreaterThanOrEqual(0.27 - 1e-6);
  });

  it('caps stripe density on short crossings to avoid overdraw', () => {
    const origin = coordinate(35.659482, 139.7005596);
    const veryShortPrincipal = createCrosswalkGeometry(origin, [
      {
        objectId: 'crossing-short-principal',
        name: 'Short Principal',
        type: 'CROSSING',
        crossing: 'zebra',
        crossingRef: null,
        signalized: true,
        principal: true,
        style: 'signalized',
        path: [
          coordinate(35.6595, 139.7005),
          coordinate(35.659508, 139.700512),
        ],
        center: coordinate(35.659504, 139.700506),
      },
    ]);

    const stripeCount = veryShortPrincipal.indices.length / 6;
    expect(stripeCount).toBeLessThanOrEqual(6);
  });

  it('uses thicker widths for lane, stop, and crosswalk markings', () => {
    const geometry = createRoadMarkingsGeometry(
      coordinate(35.659482, 139.7005596),
      [
        {
          objectId: 'lane-line',
          type: 'LANE_LINE',
          color: '#f7f2a2',
          path: [coordinate(35.6593, 139.7002), coordinate(35.6598, 139.7008)],
        },
        {
          objectId: 'stop-line',
          type: 'STOP_LINE',
          color: '#ffffff',
          path: [
            coordinate(35.65935, 139.7003),
            coordinate(35.6598, 139.70085),
          ],
        },
        {
          objectId: 'crosswalk-marking',
          type: 'CROSSWALK',
          color: '#f5f5f5',
          path: [coordinate(35.6594, 139.70025), coordinate(35.6599, 139.7009)],
        },
      ],
    );

    expect(geometry.positions.length).toBeGreaterThan(0);
    expect(geometry.indices.length).toBeGreaterThan(0);
  });

  it('places decal path overlays in separated height bands', () => {
    const geometry = createRoadDecalPathGeometry(
      coordinate(35.659482, 139.7005596),
      [
        {
          objectId: 'decal-lane',
          type: 'LANE_OVERLAY',
          color: '#f7f2a2',
          emphasis: 'standard',
          path: [coordinate(35.6593, 139.7002), coordinate(35.6598, 139.7008)],
        },
        {
          objectId: 'decal-stop',
          type: 'STOP_LINE',
          color: '#ffffff',
          emphasis: 'standard',
          path: [
            coordinate(35.65935, 139.7003),
            coordinate(35.6598, 139.70085),
          ],
        },
        {
          objectId: 'decal-crosswalk-hero',
          type: 'CROSSWALK_OVERLAY',
          color: '#f8f8f6',
          emphasis: 'hero',
          path: [coordinate(35.6594, 139.70025), coordinate(35.6599, 139.7009)],
        },
      ],
      ['LANE_OVERLAY', 'STOP_LINE', 'CROSSWALK_OVERLAY'],
    );

    const yValues = geometry.positions.filter((_, index) => index % 3 === 1);
    expect(yValues.some((y) => y >= 0.114 - 1e-6)).toBe(true);
    expect(yValues.some((y) => y >= 0.146 - 1e-6)).toBe(true);
    expect(yValues.some((y) => y >= 0.1 - 1e-6)).toBe(true);
  });

  it('builds polygon decals for junction and arrow overlays', () => {
    const geometry = createRoadDecalPolygonGeometry(
      coordinate(35.659482, 139.7005596),
      [
        {
          objectId: 'junction-polygon',
          type: 'JUNCTION_OVERLAY',
          color: '#f1df8a',
          emphasis: 'hero',
          polygon: [
            coordinate(35.65955, 139.70045),
            coordinate(35.65963, 139.70055),
            coordinate(35.65955, 139.70065),
            coordinate(35.65947, 139.70055),
          ],
        },
        {
          objectId: 'arrow-polygon',
          type: 'ARROW_MARK',
          color: '#f8e8a2',
          emphasis: 'hero',
          polygon: [
            coordinate(35.65952, 139.70042),
            coordinate(35.65962, 139.70055),
            coordinate(35.65952, 139.70068),
          ],
        },
      ],
      ['JUNCTION_OVERLAY', 'ARROW_MARK'],
      (outerRing) => {
        if (outerRing.length < 3) {
          return [];
        }
        const triangles: Array<
          [
            (typeof outerRing)[number],
            (typeof outerRing)[number],
            (typeof outerRing)[number],
          ]
        > = [];
        for (let i = 1; i < outerRing.length - 1; i += 1) {
          triangles.push([outerRing[0], outerRing[i], outerRing[i + 1]]);
        }
        return triangles;
      },
      () => [0, 1, 2],
    );

    expect(geometry.positions.length).toBeGreaterThan(0);
    expect(geometry.indices.length).toBeGreaterThan(0);
  });
});
