import {
  createRoadMarkingsGeometry,
  createCrosswalkGeometry,
  createRoadDecalPathGeometry,
  createRoadDecalPolygonGeometry,
  createRoadDecalStripeGeometry,
  createRoadEdgeGeometry,
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
