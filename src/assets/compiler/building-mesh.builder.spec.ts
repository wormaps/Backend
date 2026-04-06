import {
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
});
