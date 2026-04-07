import {
  createBuildingPanelsGeometry,
  createBuildingRoofSurfaceGeometry,
  createBuildingRoofEquipmentGeometry,
  createHeroBillboardPlaneGeometry,
  createHeroCanopyGeometry,
  createHeroRoofUnitGeometry,
} from './building-mesh.builder';

function coordinate(lat: number, lng: number) {
  return { lat, lng };
}

describe('building-mesh.builder', () => {
  const building = {
    objectId: 'hero-building',
    osmWayId: 'way_hero',
    name: 'Hero Building',
    heightMeters: 48,
    outerRing: [
      coordinate(35.6597, 139.7008),
      coordinate(35.6597, 139.701),
      coordinate(35.6595, 139.701),
      coordinate(35.6595, 139.7008),
    ],
    holes: [],
    footprint: [],
    usage: 'COMMERCIAL' as const,
    facadeColor: '#4d79c7',
    facadeMaterial: 'glass',
    roofColor: null,
    roofMaterial: null,
    roofShape: 'flat',
    buildingPart: null,
    preset: 'glass_tower' as const,
    roofType: 'flat' as const,
    visualRole: 'hero_landmark' as const,
    baseMass: 'corner_tower' as const,
    podiumSpec: {
      levels: 3,
      setbacks: 2,
      cornerChamfer: true,
      canopyEdges: [0, 1],
    },
    signageSpec: {
      billboardFaces: [0, 1],
      signBandLevels: 2,
      screenFaces: [0],
      emissiveZones: 3,
    },
    roofSpec: {
      roofUnits: 4,
      crownType: 'screen_crown' as const,
      parapet: true,
    },
  };

  it('builds canopy, roof-unit, and billboard geometry for hero buildings', () => {
    const origin = coordinate(35.659482, 139.7005596);

    const canopies = createHeroCanopyGeometry(origin, [building]);
    const roofUnits = createHeroRoofUnitGeometry(origin, [building]);
    const billboards = createHeroBillboardPlaneGeometry(origin, [building]);

    expect(canopies.positions.length).toBeGreaterThan(0);
    expect(roofUnits.positions.length).toBeGreaterThan(0);
    expect(billboards.positions.length).toBeGreaterThan(0);
  });

  it('applies facadeSpec lower/mid/top band rules to create richer hero facade geometry', () => {
    const origin = coordinate(35.659482, 139.7005596);
    const heroPanels = createBuildingPanelsGeometry(
      origin,
      [building],
      [
        {
          objectId: building.objectId,
          anchor: coordinate(35.6596, 139.7009),
          facadeEdgeIndex: 0,
          windowBands: 10,
          billboardEligible: true,
          palette: ['#2d3a4b', '#5b6b7f', '#dce5f2'],
          shellPalette: ['#2d3a4b'],
          panelPalette: ['#f44336', '#f9d423', '#ffffff'],
          materialClass: 'glass',
          signageDensity: 'high',
          emissiveStrength: 1,
          glazingRatio: 0.7,
          facadePreset: 'glass_grid',
          visualRole: 'hero_landmark',
          podiumSpec: building.podiumSpec,
          signageSpec: building.signageSpec,
          facadeSpec: {
            atlasId: 'hero-test',
            uvMode: 'placeholder',
            emissiveMaskId: 'hero-screen',
            facadePattern: 'curtain_wall',
            lowerBandType: 'retail_sign_band',
            midBandType: 'window_grid',
            topBandType: 'screen_band',
            windowRepeatX: 8,
            windowRepeatY: 14,
          },
          weakEvidence: false,
        },
      ],
      'warm',
    );

    expect(heroPanels.positions.length).toBeGreaterThan(0);
    expect(heroPanels.indices.length).toBeGreaterThan(0);
    const xValues = heroPanels.positions.filter((_, index) => index % 3 === 0);
    const zValues = heroPanels.positions.filter((_, index) => index % 3 === 2);
    expect(Math.max(...xValues) - Math.min(...xValues)).toBeGreaterThan(0.15);
    expect(Math.max(...zValues) - Math.min(...zValues)).toBeGreaterThan(0.15);
  });

  it('builds roof surface geometry so roofs read separately from wall shells', () => {
    const origin = coordinate(35.659482, 139.7005596);
    const roofSurfaces = createBuildingRoofSurfaceGeometry(
      origin,
      [building],
      () => [0, 1, 2, 0, 2, 3],
      'cool',
      {
        preset: 'NIGHT_NEON',
        emissiveBoost: 1.25,
        roadRoughnessScale: 0.9,
      },
    );

    expect(roofSurfaces.positions.length).toBeGreaterThan(0);
    expect(roofSurfaces.indices.length).toBeGreaterThan(0);
  });

  it('adds stronger roof equipment density for hero-driven rooftops', () => {
    const origin = coordinate(35.659482, 139.7005596);
    const roofEquipments = createBuildingRoofEquipmentGeometry(origin, [
      building,
    ]);

    expect(roofEquipments.positions.length).toBeGreaterThan(0);
    expect(roofEquipments.indices.length).toBeGreaterThan(0);
  });
});
