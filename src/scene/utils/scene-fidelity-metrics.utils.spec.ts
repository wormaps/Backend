import { buildSceneFidelityMetricsReport } from './scene-fidelity-metrics.utils';
import type { SceneDetail, SceneMeta } from '../types/scene.types';

function coordinate(lat: number, lng: number) {
  return { lat, lng };
}

function createSceneMeta(selectedCrossings: number): SceneMeta {
  const now = new Date().toISOString();
  return {
    sceneId: 'scene-metrics-test',
    placeId: 'place-test',
    name: 'Metrics Test',
    generatedAt: now,
    origin: coordinate(35.659482, 139.7005596),
    camera: {
      topView: { x: 0, y: 120, z: 0 },
      walkViewStart: { x: 0, y: 1.7, z: 0 },
    },
    bounds: {
      radiusM: 400,
      northEast: coordinate(35.661, 139.702),
      southWest: coordinate(35.658, 139.699),
    },
    stats: { buildingCount: 20, roadCount: 10, walkwayCount: 8, poiCount: 6 },
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
    visualCoverage: { structure: 1, streetDetail: 1, landmark: 1, signage: 1 },
    materialClasses: [],
    landmarkAnchors: [
      {
        objectId: 'lm-1',
        name: 'LM',
        location: coordinate(35.66, 139.7),
        kind: 'CROSSING',
      },
    ],
    assetProfile: {
      preset: 'MEDIUM',
      budget: {
        buildingCount: 20,
        roadCount: 10,
        walkwayCount: 8,
        poiCount: 6,
        crossingCount: 12,
        trafficLightCount: 6,
        streetLightCount: 6,
        signPoleCount: 4,
        treeClusterCount: 3,
        billboardPanelCount: 2,
      },
      selected: {
        buildingCount: 12,
        roadCount: 8,
        walkwayCount: 6,
        poiCount: 4,
        crossingCount: selectedCrossings,
        trafficLightCount: 4,
        streetLightCount: 4,
        signPoleCount: 3,
        treeClusterCount: 2,
        billboardPanelCount: 2,
      },
    },
    structuralCoverage: {
      selectedBuildingCoverage: 0.7,
      coreAreaBuildingCoverage: 0.9,
      fallbackMassingRate: 0,
      footprintPreservationRate: 1,
      heroLandmarkCoverage: 1,
    },
    roads: Array.from({ length: 10 }, (_, i) => ({
      objectId: `road-${i}`,
      osmWayId: `way-${i}`,
      name: `Road ${i}`,
      laneCount: 2,
      roadClass: 'primary',
      widthMeters: 10,
      direction: 'TWO_WAY',
      path: [
        coordinate(35.659 + i * 0.00001, 139.7002),
        coordinate(35.6595 + i * 0.00001, 139.7008),
      ],
      center: coordinate(35.65925 + i * 0.00001, 139.7005),
      surface: 'asphalt',
      bridge: false,
    })),
    buildings: Array.from({ length: 20 }, (_, i) => ({
      objectId: `building-${i}`,
      osmWayId: `building-way-${i}`,
      name: `Building ${i}`,
      heightMeters: 20,
      outerRing: [
        coordinate(35.659 + i * 0.00001, 139.7002),
        coordinate(35.659 + i * 0.00001, 139.70025),
        coordinate(35.65905 + i * 0.00001, 139.70025),
        coordinate(35.65905 + i * 0.00001, 139.7002),
      ],
      holes: [],
      footprint: [],
      usage: 'COMMERCIAL',
      facadeColor: '#8899aa',
      facadeMaterial: 'glass',
      roofColor: null,
      roofMaterial: null,
      roofShape: 'flat',
      buildingPart: null,
      preset: 'office_midrise',
      roofType: 'flat',
      visualRole: i < 3 ? 'hero_landmark' : 'generic',
    })),
    walkways: [],
    pois: [],
  } as SceneMeta;
}

function createSceneDetail(crossingCount: number): SceneDetail {
  const now = new Date().toISOString();
  return {
    sceneId: 'scene-metrics-test',
    placeId: 'place-test',
    generatedAt: now,
    detailStatus: 'FULL',
    crossings: Array.from({ length: crossingCount }, (_, i) => ({
      objectId: `crossing-${i}`,
      name: `Crossing ${i}`,
      type: 'CROSSING',
      crossing: 'zebra',
      crossingRef: null,
      signalized: i % 2 === 0,
      principal: i < 2,
      style: i % 2 === 0 ? 'signalized' : 'zebra',
      path: [
        coordinate(35.6593 + i * 0.00001, 139.7002),
        coordinate(35.6598 + i * 0.00001, 139.7008),
      ],
      center: coordinate(35.65955 + i * 0.00001, 139.7005),
    })),
    roadMarkings: [],
    streetFurniture: [],
    vegetation: [],
    landCovers: [],
    linearFeatures: [],
    facadeHints: Array.from({ length: 20 }, (_, i) => ({
      objectId: `building-${i}`,
      anchor: coordinate(35.6595, 139.7006),
      facadeEdgeIndex: 0,
      windowBands: 8,
      billboardEligible: i < 6,
      palette: ['#8899aa'],
      materialClass: 'glass',
      signageDensity: i < 10 ? 'high' : 'medium',
      emissiveStrength: 0.6,
      glazingRatio: 0.5,
    })),
    signageClusters: Array.from({ length: 10 }, (_, i) => ({
      objectId: `sign-${i}`,
      anchor: coordinate(35.6595, 139.7006),
      panelCount: 2,
      palette: ['#ff8844'],
      emissiveStrength: 0.7,
      widthMeters: 2,
      heightMeters: 1.2,
    })),
    annotationsApplied: [],
    provenance: {
      mapillaryUsed: true,
      mapillaryImageCount: 1,
      mapillaryFeatureCount: 20,
      osmTagCoverage: {
        coloredBuildings: 10,
        materialBuildings: 10,
        crossings: crossingCount,
        streetFurniture: 0,
        vegetation: 0,
      },
      overrideCount: 0,
    },
  } as SceneDetail;
}

describe('scene-fidelity-metrics.utils', () => {
  it('raises placeReadability when crosswalkCompleteness increases', () => {
    const detail = createSceneDetail(10);
    const low = buildSceneFidelityMetricsReport(createSceneMeta(4), detail);
    const high = buildSceneFidelityMetricsReport(createSceneMeta(10), detail);

    expect(high.quality.crosswalkCompleteness).toBeGreaterThan(
      low.quality.crosswalkCompleteness,
    );
    expect(high.score.breakdown.placeReadability).toBeGreaterThan(
      low.score.breakdown.placeReadability,
    );
  });

  it('raises placeReadability when signage density increases', () => {
    const detailLowSignage = createSceneDetail(10);
    detailLowSignage.signageClusters = detailLowSignage.signageClusters.slice(
      0,
      2,
    );
    const detailHighSignage = createSceneDetail(10);
    detailHighSignage.signageClusters = Array.from({ length: 30 }, (_, i) => ({
      objectId: `dense-sign-${i}`,
      anchor: coordinate(35.6595, 139.7006),
      panelCount: 2,
      palette: ['#ff8844'],
      emissiveStrength: 0.7,
      widthMeters: 2,
      heightMeters: 1.2,
    }));

    const meta = createSceneMeta(10);
    const low = buildSceneFidelityMetricsReport(meta, detailLowSignage);
    const high = buildSceneFidelityMetricsReport(meta, detailHighSignage);

    expect(high.quality.signageDensity).toBeGreaterThan(
      low.quality.signageDensity,
    );
    expect(high.score.breakdown.placeReadability).toBeGreaterThan(
      low.score.breakdown.placeReadability,
    );
  });

  it('raises heroOverrideRate when auto hero promotion annotation exists', () => {
    const detail = createSceneDetail(10);
    detail.roadDecals = [
      {
        objectId: 'hero-crosswalk-1',
        intersectionId: 'intersection-1',
        type: 'CROSSWALK_OVERLAY',
        color: '#f8f8f6',
        emphasis: 'hero',
        priority: 'hero',
        layer: 'crosswalk_overlay',
        shapeKind: 'path_strip',
        path: [
          coordinate(35.65931, 139.70031),
          coordinate(35.65936, 139.70039),
        ],
      },
    ];
    const withoutAuto = buildSceneFidelityMetricsReport(
      createSceneMeta(10),
      detail,
    );
    detail.annotationsApplied.push('shibuya:auto-hero-promotion:6');
    const withAuto = buildSceneFidelityMetricsReport(
      createSceneMeta(10),
      detail,
    );

    expect(withAuto.quality.heroOverrideRate).toBeGreaterThan(
      withoutAuto.quality.heroOverrideRate,
    );
    expect(withAuto.score.breakdown.placeReadability).toBeGreaterThan(
      withoutAuto.score.breakdown.placeReadability,
    );
  });

  it('does not apply auto hero boost without hero road context', () => {
    const detail = createSceneDetail(10);
    const withoutAuto = buildSceneFidelityMetricsReport(
      createSceneMeta(10),
      detail,
    );
    detail.annotationsApplied.push('shibuya:auto-hero-promotion:6');
    const withAuto = buildSceneFidelityMetricsReport(
      createSceneMeta(10),
      detail,
    );

    expect(withAuto.quality.heroOverrideRate).toBe(
      withoutAuto.quality.heroOverrideRate,
    );
  });

  it('excludes weak-evidence hero buildings from heroOverrideRate', () => {
    const reliableDetail = createSceneDetail(10);
    const weakHeavyDetail = createSceneDetail(10);
    reliableDetail.roadDecals = [
      {
        objectId: 'hero-crosswalk-1',
        intersectionId: 'intersection-1',
        type: 'CROSSWALK_OVERLAY',
        color: '#f8f8f6',
        emphasis: 'hero',
        priority: 'hero',
        layer: 'crosswalk_overlay',
        shapeKind: 'path_strip',
        path: [
          coordinate(35.65931, 139.70031),
          coordinate(35.65936, 139.70039),
        ],
      },
    ];
    weakHeavyDetail.roadDecals = reliableDetail.roadDecals;
    weakHeavyDetail.facadeHints = weakHeavyDetail.facadeHints.map(
      (hint, index) => ({
        ...hint,
        weakEvidence: index < 2,
      }),
    );

    const meta = createSceneMeta(10);
    const reliable = buildSceneFidelityMetricsReport(meta, reliableDetail);
    const weakHeavy = buildSceneFidelityMetricsReport(meta, weakHeavyDetail);

    expect(weakHeavy.quality.heroOverrideRate).toBeLessThan(
      reliable.quality.heroOverrideRate,
    );
  });
});
