import { GlbBuilderService } from './glb-builder.service';

function coordinate(lat: number, lng: number) {
  return { lat, lng };
}

describe('GlbBuilderService', () => {
  it('resolves building shell buckets from explicit or inferred colors', () => {
    const service = new GlbBuilderService() as any;

    const coolStyle = service.resolveBuildingShellStyle(
      {
        objectId: 'building-glass',
        osmWayId: 'building_glass',
        name: 'Blue Tower',
        heightMeters: 32,
        outerRing: [
          coordinate(37.0002, 127.0002),
          coordinate(37.0002, 127.0006),
          coordinate(37.0006, 127.0006),
          coordinate(37.0006, 127.0002),
        ],
        holes: [],
        footprint: [],
        usage: 'COMMERCIAL',
        facadeColor: '#4d79c7',
        facadeMaterial: 'glass',
        roofColor: null,
        roofMaterial: null,
        roofShape: 'flat',
        buildingPart: null,
        preset: 'glass_tower',
        roofType: 'flat',
      },
      {
        objectId: 'building-glass',
        anchor: coordinate(37.0004, 127.0004),
        facadeEdgeIndex: 0,
        windowBands: 10,
        billboardEligible: true,
        palette: ['#4d79c7', '#cfe3f1'],
        materialClass: 'glass',
        signageDensity: 'high',
        emissiveStrength: 0.8,
        glazingRatio: 0.7,
      },
    );
    const brickStyle = service.resolveBuildingShellStyle({
      objectId: 'building-brick',
      osmWayId: 'building_brick',
      name: 'Brick Hall',
      heightMeters: 18,
      outerRing: [
        coordinate(37.0008, 127.0003),
        coordinate(37.0011, 127.0003),
        coordinate(37.0011, 127.00065),
        coordinate(37.0008, 127.00065),
      ],
      holes: [],
      footprint: [],
      usage: 'PUBLIC',
      facadeColor: '#a65b42',
      facadeMaterial: 'brick',
      roofColor: null,
      roofMaterial: null,
      roofShape: 'flat',
      buildingPart: null,
      preset: 'small_lowrise',
      roofType: 'flat',
    });

    expect(coolStyle).toMatchObject({
      materialClass: 'glass',
      bucket: 'cool-mid',
      colorHex: '#4d79c7',
    });
    expect(coolStyle.key.startsWith('glass_cool-mid_#4d79c7_')).toBe(true);
    expect(brickStyle).toMatchObject({
      materialClass: 'brick',
      bucket: 'brick',
      colorHex: '#a65b42',
    });
    expect(brickStyle.key.startsWith('brick_brick_#a65b42_')).toBe(true);
  });

  it('normalizes local outer rings to counter-clockwise winding', () => {
    const service = new GlbBuilderService() as any;
    const clockwiseRing = [
      [0, 0, 0],
      [0, 0, 10],
      [10, 0, 10],
      [10, 0, 0],
    ];

    const normalized = service.normalizeLocalRing(clockwiseRing, 'CCW');
    const signedArea = service.signedAreaXZ(normalized);

    expect(signedArea).toBeGreaterThan(0);
  });

  it('widens principal crossing geometry more than non-principal geometry', () => {
    const service = new GlbBuilderService() as any;
    const origin = coordinate(37.0, 127.0);
    const baseCrossing = {
      objectId: 'crossing-main',
      name: 'Main Crossing',
      type: 'CROSSING',
      crossing: 'zebra',
      crossingRef: null,
      signalized: true,
      path: [coordinate(37.0003, 127.0002), coordinate(37.0007, 127.0008)],
      center: coordinate(37.0005, 127.0005),
      style: 'zebra',
    };

    const standardGeometry = service.createCrosswalkGeometry(origin, [
      {
        ...baseCrossing,
        principal: false,
      },
    ]);
    const principalGeometry = service.createCrosswalkGeometry(origin, [
      {
        ...baseCrossing,
        principal: true,
      },
    ]);

    const standardXs = standardGeometry.positions.filter(
      (_value: number, index: number) => index % 3 === 0,
    );
    const principalXs = principalGeometry.positions.filter(
      (_value: number, index: number) => index % 3 === 0,
    );
    const standardWidth = Math.max(...standardXs) - Math.min(...standardXs);
    const principalWidth = Math.max(...principalXs) - Math.min(...principalXs);

    expect(principalWidth).toBeGreaterThan(standardWidth);
  });
});
