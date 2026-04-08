import { buildSceneAssetSelection } from './scene-asset-profile.utils';
import { buildSceneModeComparisonReport } from './scene-mode-comparison-report.utils';
import { SceneDetail, SceneMeta } from '../types/scene.types';

function coordinate(lat: number, lng: number) {
  return { lat, lng };
}

function createRoad(index: number, lat: number, lng: number) {
  return {
    objectId: `road-${index}`,
    osmWayId: `road_${index}`,
    name: `Road ${index}`,
    laneCount: 2,
    roadClass: 'primary',
    widthMeters: 12,
    direction: 'TWO_WAY' as const,
    path: [coordinate(lat, lng), coordinate(lat + 0.00015, lng + 0.00015)],
    center: coordinate(lat + 0.000075, lng + 0.000075),
    surface: null,
    bridge: false,
  };
}

function createWalkway(index: number, lat: number, lng: number) {
  return {
    objectId: `walkway-${index}`,
    osmWayId: `walkway_${index}`,
    name: `Walkway ${index}`,
    widthMeters: 4,
    walkwayType: 'footway',
    path: [coordinate(lat, lng), coordinate(lat + 0.0001, lng + 0.0001)],
    surface: null,
  };
}

function createCrossing(
  index: number,
  lat: number,
  lng: number,
  principal = false,
) {
  return {
    objectId: `crossing-${index}`,
    name: `Crossing ${index}`,
    type: 'CROSSING' as const,
    crossing: null,
    crossingRef: null,
    signalized: principal,
    path: [coordinate(lat, lng), coordinate(lat + 0.00008, lng + 0.00008)],
    center: coordinate(lat + 0.00004, lng + 0.00004),
    principal,
    style: 'zebra' as const,
  };
}

describe('buildSceneModeComparisonReport', () => {
  it('creates baseline/target table rows and deltas', () => {
    const sceneMeta: SceneMeta = {
      sceneId: 'scene-mode-comparison-test',
      placeId: 'place-mode-comparison-test',
      name: 'Mode Comparison Test',
      generatedAt: '2026-04-08T00:00:00Z',
      origin: coordinate(37, 127),
      camera: {
        topView: { x: 0, y: 120, z: 80 },
        walkViewStart: { x: 0, y: 1.7, z: 12 },
      },
      bounds: {
        radiusM: 2200,
        northEast: coordinate(37.02, 127.02),
        southWest: coordinate(36.98, 126.98),
      },
      stats: {
        buildingCount: 1,
        roadCount: 3,
        walkwayCount: 3,
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
          buildingCount: 520,
          roadCount: 260,
          walkwayCount: 320,
          poiCount: 120,
          crossingCount: 96,
          trafficLightCount: 48,
          streetLightCount: 64,
          signPoleCount: 80,
          treeClusterCount: 56,
          billboardPanelCount: 72,
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
      roads: [
        createRoad(1, 37.0002, 127.0002),
        createRoad(2, 37.0004, 127.0004),
        createRoad(3, 37.0006, 127.0006),
      ],
      buildings: [
        {
          objectId: 'building-1',
          osmWayId: 'building_1',
          name: 'Building 1',
          usage: 'COMMERCIAL',
          heightMeters: 30,
          outerRing: [
            coordinate(37.0002, 127.0002),
            coordinate(37.0002, 127.0003),
            coordinate(37.0003, 127.0003),
          ],
          holes: [],
          footprint: [
            coordinate(37.0002, 127.0002),
            coordinate(37.0002, 127.0003),
            coordinate(37.0003, 127.0003),
          ],
          roofType: 'flat',
          preset: 'glass_tower',
          geometryStrategy: 'simple_extrude',
          visualRole: 'hero_landmark',
        },
      ],
      walkways: [
        createWalkway(1, 37.0002, 127.0002),
        createWalkway(2, 37.0004, 127.0004),
        createWalkway(3, 37.0006, 127.0006),
      ],
      pois: [],
    };

    const sceneDetail: SceneDetail = {
      sceneId: sceneMeta.sceneId,
      placeId: sceneMeta.placeId,
      generatedAt: sceneMeta.generatedAt,
      detailStatus: 'FULL',
      crossings: [
        createCrossing(1, 37.0003, 127.0003, true),
        createCrossing(2, 37.0005, 127.0005),
      ],
      roadMarkings: [],
      roadDecals: [
        {
          objectId: 'decal-1',
          type: 'CROSSWALK_OVERLAY',
          color: '#ffffff',
          emphasis: 'standard',
          path: [coordinate(37.0003, 127.0003), coordinate(37.0004, 127.0004)],
        },
      ],
      streetFurniture: [],
      vegetation: [],
      landCovers: [],
      linearFeatures: [],
      facadeHints: [
        {
          objectId: 'building-1',
          anchor: coordinate(37.00025, 127.00025),
          facadeEdgeIndex: 0,
          windowBands: 8,
          billboardEligible: true,
          palette: ['#4d79c7'],
          materialClass: 'glass',
          signageDensity: 'high',
          emissiveStrength: 0.9,
          glazingRatio: 0.72,
          districtCluster: 'core_commercial',
        },
      ],
      signageClusters: [
        {
          objectId: 'sig-1',
          anchor: coordinate(37.00025, 127.00025),
          panelCount: 5,
          palette: ['#ff7700'],
          emissiveStrength: 0.9,
          widthMeters: 4,
          heightMeters: 2,
        },
      ],
      annotationsApplied: ['hero-1'],
      fidelityPlan: {
        currentMode: 'LANDMARK_ENRICHED',
        targetMode: 'REALITY_OVERLAY_READY',
        targetCoverageRatio: 0.72,
        achievedCoverageRatio: 0.69,
        coverageGapRatio: 0.03,
        phase: 'PHASE_2_HYBRID_FOUNDATION',
        coreRadiusM: 320,
        priorities: ['test'],
        evidence: {
          structure: 'HIGH',
          facade: 'HIGH',
          signage: 'HIGH',
          streetFurniture: 'MEDIUM',
          landmark: 'HIGH',
        },
        sourceRegistry: [],
      },
      staticAtmosphere: {
        preset: 'NIGHT_NEON',
        emissiveBoost: 1.25,
        roadRoughnessScale: 0.9,
        wetRoadBoost: 0.45,
      },
      provenance: {
        mapillaryUsed: true,
        mapillaryImageCount: 120,
        mapillaryFeatureCount: 95,
        osmTagCoverage: {
          coloredBuildings: 1,
          materialBuildings: 1,
          crossings: 2,
          streetFurniture: 0,
          vegetation: 0,
        },
        overrideCount: 1,
      },
    };

    const selection = buildSceneAssetSelection(
      sceneMeta,
      sceneDetail,
      'MEDIUM',
    );
    const adaptiveMeta = {
      ...sceneMeta,
      assetProfile: {
        ...sceneMeta.assetProfile,
        selected: selection.selected,
        budget: selection.budget,
      },
      structuralCoverage: selection.structuralCoverage,
    };

    const report = buildSceneModeComparisonReport(adaptiveMeta, sceneDetail, {
      generationMs: 1300,
      glbBytes: 620000,
    });

    expect(report.baseline.mode).toBe('PROCEDURAL_ONLY');
    expect(report.baseline.source).toBe('synthetic');
    expect(report.baseline.generationMs).toBeNull();
    expect(report.baseline.glbBytes).toBeNull();
    expect(report.target.mode).toBe('REALITY_OVERLAY_READY');
    expect(report.target.source).toBe('actual');
    expect(report.target.generationMs).toBe(1300);
    expect(report.target.glbBytes).toBe(620000);
    expect(report.delta.generationMs).toBeNull();
    expect(report.delta.glbBytes).toBeNull();
    expect(report.target.emissiveAvg).toBeGreaterThan(
      report.baseline.emissiveAvg,
    );
    expect(report.target.overallScore).toBeGreaterThan(
      report.baseline.overallScore,
    );
    expect(report.baseline.overallScore).toBeCloseTo(
      Number(
        (
          report.baseline.scoreBreakdownStructure * 0.4 +
          report.baseline.scoreBreakdownAtmosphere * 0.3 +
          report.baseline.scoreBreakdownPlaceReadability * 0.3
        ).toFixed(3),
      ),
      3,
    );
  });
});
