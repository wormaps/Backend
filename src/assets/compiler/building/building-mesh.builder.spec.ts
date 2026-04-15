import {
  createBuildingShellGeometry,
  createBuildingPanelsGeometry,
  createBuildingWindowGeometry,
  createBuildingRoofSurfaceGeometry,
  createBuildingEntranceGeometry,
  createBuildingRoofEquipmentGeometry,
  collectBuildingRoofSurfaceMetrics,
  createHeroBillboardPlaneGeometry,
  createHeroCanopyGeometry,
  createHeroRoofUnitGeometry,
} from './building-mesh.builder';
import type { SceneMeta } from '../../../scene/types/scene.types';

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
        wetRoadBoost: 0.45,
      },
    );

    expect(roofSurfaces.positions.length).toBeGreaterThan(0);
    expect(roofSurfaces.indices.length).toBeGreaterThan(0);
  });

  it('counts roof-wall gap risk only for invalid gable rings', () => {
    const metrics = collectBuildingRoofSurfaceMetrics([
      {
        ...building,
        objectId: 'gable-risk',
        roofType: 'gable',
        outerRing: [
          coordinate(35.6597, 139.7008),
          coordinate(35.6597, 139.701),
          coordinate(35.6595, 139.701),
        ],
      },
      {
        ...building,
        objectId: 'stepped-setback',
        roofType: 'stepped',
        setbackLevels: 3,
        outerRing: [
          coordinate(35.6597, 139.7008),
          coordinate(35.6597, 139.701),
          coordinate(35.6595, 139.701),
          coordinate(35.6595, 139.7008),
        ],
      },
    ]);

    expect(metrics.roofWallGapRiskCount).toBe(1);
  });

  it('adds stronger roof equipment density for hero-driven rooftops', () => {
    const origin = coordinate(35.659482, 139.7005596);
    const roofEquipments = createBuildingRoofEquipmentGeometry(origin, [
      building,
    ]);

    expect(roofEquipments.positions.length).toBeGreaterThan(0);
    expect(roofEquipments.indices.length).toBeGreaterThan(0);
  });

  it('reduces roof equipment density for low LOD non-hero buildings', () => {
    const origin = coordinate(35.659482, 139.7005596);
    const highLodEquipment = createBuildingRoofEquipmentGeometry(origin, [
      {
        ...building,
        objectId: 'roof-high',
        osmWayId: 'roof_high',
        visualRole: 'generic',
        lodLevel: 'HIGH',
      },
    ] as SceneMeta['buildings']);
    const lowLodEquipment = createBuildingRoofEquipmentGeometry(origin, [
      {
        ...building,
        objectId: 'roof-low',
        osmWayId: 'roof_low',
        visualRole: 'generic',
        lodLevel: 'LOW',
      },
    ] as SceneMeta['buildings']);

    expect(highLodEquipment.indices.length).toBeGreaterThan(0);
    expect(lowLodEquipment.indices.length).toBeGreaterThan(0);
    expect(lowLodEquipment.indices.length).toBeLessThan(
      highLodEquipment.indices.length,
    );
  });

  it('generates fallback windows even when facade hints are missing', () => {
    const origin = coordinate(35.659482, 139.7005596);
    const windows = createBuildingWindowGeometry(origin, [building], []);

    expect(windows.positions.length).toBeGreaterThan(0);
    expect(windows.indices.length).toBeGreaterThan(0);
  });

  it('caps window geometry for large building batches', () => {
    const origin = coordinate(35.659482, 139.7005596);
    const largeBuildingSet = Array.from(
      { length: 1800 },
      (_, index): SceneMeta['buildings'][number] => ({
        ...building,
        objectId: `building-${index}`,
        osmWayId: `building_${index}`,
        heightMeters: 48,
        outerRing: [
          coordinate(35.659 + index * 0.000001, 139.7),
          coordinate(35.659 + index * 0.000001, 139.7002),
          coordinate(35.6592 + index * 0.000001, 139.7002),
          coordinate(35.6592 + index * 0.000001, 139.7),
        ],
        visualArchetype: 'highrise_office',
        windowPatternDensity: 'dense',
      }),
    );

    const windows = createBuildingWindowGeometry(origin, largeBuildingSet, []);
    const triangleCount = windows.indices.length / 3;

    expect(triangleCount).toBeGreaterThan(0);
    expect(triangleCount).toBeLessThanOrEqual(920000);
  });

  it('honors maxWindowTriangles option for explicit window budget', () => {
    const origin = coordinate(35.659482, 139.7005596);
    const denseBatch = Array.from(
      { length: 1200 },
      (_, index): SceneMeta['buildings'][number] => ({
        ...building,
        objectId: `window-budget-${index}`,
        osmWayId: `window_budget_${index}`,
        outerRing: [
          coordinate(35.658 + index * 0.000001, 139.6998),
          coordinate(35.658 + index * 0.000001, 139.7),
          coordinate(35.6582 + index * 0.000001, 139.7),
          coordinate(35.6582 + index * 0.000001, 139.6998),
        ],
        visualArchetype: 'highrise_office',
        windowPatternDensity: 'dense',
      }),
    );

    const defaultBudgetWindows = createBuildingWindowGeometry(
      origin,
      denseBatch,
      [],
    );
    const tighterBudgetWindows = createBuildingWindowGeometry(
      origin,
      denseBatch,
      [],
      { maxWindowTriangles: 320_000 },
    );

    const defaultTriangles = defaultBudgetWindows.indices.length / 3;
    const tighterTriangles = tighterBudgetWindows.indices.length / 3;

    expect(defaultTriangles).toBeGreaterThan(0);
    expect(tighterTriangles).toBeGreaterThan(0);
    expect(tighterTriangles).toBeLessThan(defaultTriangles);
    expect(tighterTriangles).toBeLessThanOrEqual(340_000);
  });

  it('applies foundation depth from groundOffsetM to shell minimum height', () => {
    const origin = coordinate(35.659482, 139.7005596);
    const triangulateQuad = () => [0, 1, 2, 0, 2, 3];
    const buildWithGroundOffset = (
      groundOffsetM: number,
    ): ReturnType<typeof createBuildingShellGeometry> =>
      createBuildingShellGeometry(
        origin,
        [
          {
            ...building,
            objectId: `shell-ground-${groundOffsetM}`,
            osmWayId: `shell_ground_${groundOffsetM}`,
            visualRole: 'generic',
            geometryStrategy: 'simple_extrude',
            groundOffsetM,
          },
        ],
        triangulateQuad,
      );

    const shellNoOffset = buildWithGroundOffset(0);
    const shellNearRoad = buildWithGroundOffset(0.06);
    const shellAdaptiveOffset = buildWithGroundOffset(0.18);
    const shellDeepOffset = buildWithGroundOffset(0.8);

    const minY = (positions: number[]): number => {
      const ys = positions.filter((_, index) => index % 3 === 1);
      return Math.min(...ys);
    };

    expect(minY(shellNoOffset.positions)).toBeCloseTo(-0.4, 6);
    expect(minY(shellNearRoad.positions)).toBeCloseTo(-0.46, 6);
    expect(minY(shellAdaptiveOffset.positions)).toBeCloseTo(-0.58, 6);
    expect(minY(shellDeepOffset.positions)).toBeCloseTo(-1.1, 6);
  });

  it('applies terrain-aware foundation depth adjustment', () => {
    const origin = coordinate(35.659482, 139.7005596);
    const triangulateQuad = () => [0, 1, 2, 0, 2, 3];
    const buildWithTerrainOffset = (
      terrainOffsetM: number,
    ): ReturnType<typeof createBuildingShellGeometry> =>
      createBuildingShellGeometry(
        origin,
        [
          {
            ...building,
            objectId: `shell-terrain-${terrainOffsetM}`,
            osmWayId: `shell_terrain_${terrainOffsetM}`,
            visualRole: 'generic',
            geometryStrategy: 'simple_extrude',
            groundOffsetM: 0.06,
            terrainOffsetM,
          },
        ],
        triangulateQuad,
      );

    const shellFlatTerrain = buildWithTerrainOffset(0);
    const shellElevatedTerrain = buildWithTerrainOffset(0.5);
    const shellHighTerrain = buildWithTerrainOffset(2.0);

    const minY = (positions: number[]): number => {
      const ys = positions.filter((_, index) => index % 3 === 1);
      return Math.min(...ys);
    };

    const foundationDepth = (positions: number[]): number => {
      const ys = positions.filter((_, index) => index % 3 === 1);
      return Math.max(...ys) - Math.min(...ys);
    };

    expect(minY(shellFlatTerrain.positions)).toBeCloseTo(-0.46, 6);
    expect(minY(shellElevatedTerrain.positions)).toBeCloseTo(-0.11, 2);
    expect(foundationDepth(shellHighTerrain.positions)).toBeGreaterThan(
      foundationDepth(shellElevatedTerrain.positions),
    );
    expect(minY(shellHighTerrain.positions)).toBeGreaterThanOrEqual(-1.1);
  });

  it('applies terrainOffsetM consistently across building stack geometry', () => {
    const origin = coordinate(35.659482, 139.7005596);
    const elevatedBuilding = {
      ...building,
      objectId: 'terrain-elevated',
      osmWayId: 'terrain_elevated',
      visualRole: 'generic' as const,
      terrainOffsetM: 0.24,
    };
    const triangulateQuad = () => [0, 1, 2, 0, 2, 3];
    const facadeHints = [
      {
        objectId: elevatedBuilding.objectId,
        anchor: coordinate(35.6596, 139.7009),
        facadeEdgeIndex: 0,
        windowBands: 8,
        billboardEligible: false,
        palette: ['#2d3a4b', '#5b6b7f', '#dce5f2'],
        materialClass: 'glass' as const,
        signageDensity: 'medium' as const,
        emissiveStrength: 0.4,
        glazingRatio: 0.62,
        facadePreset: 'glass_grid' as const,
      },
    ];

    const shell = createBuildingShellGeometry(
      origin,
      [elevatedBuilding],
      triangulateQuad,
    );
    const roof = createBuildingRoofSurfaceGeometry(
      origin,
      [elevatedBuilding],
      triangulateQuad,
      'cool',
    );
    const panels = createBuildingPanelsGeometry(
      origin,
      [elevatedBuilding],
      facadeHints,
      'cool',
    );
    const windows = createBuildingWindowGeometry(
      origin,
      [elevatedBuilding],
      facadeHints,
    );
    const entrances = createBuildingEntranceGeometry(origin, [
      elevatedBuilding,
    ]);
    const roofEquipment = createBuildingRoofEquipmentGeometry(origin, [
      elevatedBuilding,
    ]);
    const heroRoofUnits = createHeroRoofUnitGeometry(origin, [
      {
        ...elevatedBuilding,
        visualRole: 'hero_landmark',
      },
    ]);

    const minY = (positions: number[]): number =>
      Math.min(...positions.filter((_, index) => index % 3 === 1));

    expect(minY(shell.positions)).toBeCloseTo(-0.232, 3);
    expect(minY(roof.positions)).toBeGreaterThanOrEqual(48.24);
    expect(minY(panels.positions)).toBeGreaterThanOrEqual(0.24);
    expect(minY(windows.positions)).toBeGreaterThanOrEqual(0.24);
    expect(minY(entrances.positions)).toBeGreaterThanOrEqual(0.24);
    expect(minY(roofEquipment.positions)).toBeGreaterThanOrEqual(48.34);
    expect(minY(heroRoofUnits.positions)).toBeGreaterThanOrEqual(48.44);
  });
});
