import { describe, expect, it } from 'bun:test';
import { Test, TestingModule } from '@nestjs/testing';
import type { InferenceReasonCode } from '../src/scene/types/scene-domain.types';
import { SceneMidQaService } from '../src/scene/services/qa/scene-mid-qa.service';
import type {
  SceneDetail,
  SceneMeta,
  SceneTwinGraph,
  ValidationReport,
} from '../src/scene/types/scene.types';

describe('Phase 3: observed_coverage with Mapillary facade hints', () => {
  async function buildService(): Promise<SceneMidQaService> {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SceneMidQaService],
    }).compile();
    return module.get(SceneMidQaService);
  }

  function makeMinimalTwin(overrides?: Partial<SceneTwinGraph>): SceneTwinGraph {
    return {
      twinId: 'twin-1',
      sceneId: 'test-scene',
      buildId: 'build-1',
      generatedAt: new Date().toISOString(),
      sourceSnapshots: {
        manifestId: 'manifest-1',
        sceneId: 'test-scene',
        generatedAt: new Date().toISOString(),
        snapshots: [],
      },
      spatialFrame: {
        frameId: 'frame-1',
        sceneId: 'test-scene',
        generatedAt: new Date().toISOString(),
        geodeticCrs: 'WGS84',
        localFrame: 'ENU',
        axis: 'Z_UP',
        unit: 'meter',
        heightReference: 'ELLIPSOID_APPROX',
        anchor: { lat: 35.6812, lng: 139.7671 },
        bounds: {
          northEast: { lat: 35.69, lng: 139.78 },
          southWest: { lat: 35.67, lng: 139.75 },
        },
        extentMeters: { width: 1000, depth: 1000, radius: 500 },
        transform: {
          metersPerLat: 111_000,
          metersPerLng: 90_000,
          localAxes: { east: [1, 0, 0], north: [0, 0, -1], up: [0, 1, 0] },
        },
        terrain: {
          mode: 'FLAT_PLACEHOLDER',
          source: 'NONE',
          hasElevationModel: false,
          baseHeightMeters: 0,
          sampleCount: 0,
          sourcePath: null,
          notes: '',
        },
        verification: {
          sampleCount: 1,
          maxRoundTripErrorM: 0.01,
          avgRoundTripErrorM: 0.005,
          samples: [
            { label: 'center', local: { eastM: 0, northM: 0 }, roundTripErrorM: 0.01 },
          ],
        },
        delivery: { glbAxisConvention: 'Y_UP_DERIVED', transformRequired: true },
      },
      entities: [],
      relationships: [],
      components: [],
      evidence: [],
      delivery: {
        buildId: 'build-1',
        sceneId: 'test-scene',
        generatedAt: new Date().toISOString(),
        scale: 'MEDIUM',
        artifacts: [],
      },
      stateChannels: [],
      landmarkAnchors: [],
      stats: { entityCount: 0, componentCount: 0, relationshipCount: 0, evidenceCount: 0 },
      ...overrides,
    };
  }

  function makeMinimalMeta(overrides?: Partial<SceneMeta>): SceneMeta {
    return {
      sceneId: 'test-scene',
      placeId: 'place-1',
      name: 'Test',
      generatedAt: new Date().toISOString(),
      origin: { lat: 35.6812, lng: 139.7671 },
      camera: { topView: { x: 0, y: 180, z: 140 }, walkViewStart: { x: 0, y: 1.7, z: 12 } },
      bounds: { radiusM: 500, northEast: { lat: 35.69, lng: 139.78 }, southWest: { lat: 35.67, lng: 139.75 } },
      stats: { buildingCount: 0, roadCount: 0, walkwayCount: 0, poiCount: 0 },
      diagnostics: {
        droppedBuildings: 0, droppedRoads: 0, droppedWalkways: 0, droppedPois: 0,
        droppedCrossings: 0, droppedStreetFurniture: 0, droppedVegetation: 0,
        droppedLandCovers: 0, droppedLinearFeatures: 0,
      },
      detailStatus: 'FULL',
      visualCoverage: { structure: 0, streetDetail: 0, landmark: 0, signage: 0 },
      materialClasses: [],
      landmarkAnchors: [],
      assetProfile: { preset: 'MEDIUM', budget: makeAssetCounts(), selected: makeAssetCounts() },
      structuralCoverage: {
        selectedBuildingCoverage: 0, coreAreaBuildingCoverage: 0,
        fallbackMassingRate: 0, footprintPreservationRate: 0, heroLandmarkCoverage: 0,
      },
      roads: [],
      buildings: [],
      walkways: [],
      pois: [],
      ...overrides,
    };
  }

  function makeAssetCounts() {
    return {
      buildingCount: 0, roadCount: 0, walkwayCount: 0, poiCount: 0,
      crossingCount: 0, trafficLightCount: 0, streetLightCount: 0,
      signPoleCount: 0, treeClusterCount: 0, billboardPanelCount: 0,
    };
  }

  function makeMinimalDetail(overrides?: Partial<SceneDetail>): SceneDetail {
    return {
      sceneId: 'test-scene',
      placeId: 'place-1',
      generatedAt: new Date().toISOString(),
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
      ...overrides,
    };
  }

  function makeMinimalValidation(overrides?: Partial<ValidationReport>): ValidationReport {
    return {
      reportId: 'val-1',
      sceneId: 'test-scene',
      generatedAt: new Date().toISOString(),
      summary: 'PASS',
      gates: [],
      qualityGate: {
        version: 'qg.v1',
        state: 'PASS',
        reasonCodes: [],
        scores: {
          overall: 0.8,
          breakdown: { structure: 0.82, atmosphere: 0.74, placeReadability: 0.78 },
          modeDeltaOverallScore: 0.12,
        },
        thresholds: {
          coverageGapMax: 1, overallMin: 0.45, structureMin: 0.45,
          placeReadabilityMin: 0, modeDeltaOverallMin: -0.2,
          criticalPolygonBudgetExceededMax: 0, criticalInvalidGeometryMax: 0,
          maxSkippedMeshesWarn: 180, maxMissingSourceWarn: 48,
        },
        meshSummary: {
          totalMeshNodeCount: 0,
          totalSkipped: 0, polygonBudgetExceededCount: 0,
          criticalPolygonBudgetExceededCount: 0, emptyOrInvalidGeometryCount: 0,
          criticalEmptyOrInvalidGeometryCount: 0, selectionCutCount: 0,
          missingSourceCount: 0, triangulationFallbackCount: 0,
        },
        artifactRefs: { diagnosticsLogPath: '', modeComparisonPath: '' },
        oracleApproval: { required: false, state: 'NOT_REQUIRED', source: 'auto' },
        decidedAt: new Date().toISOString(),
      },
      ...overrides,
    };
  }

  function makeFacadeHint(
    objectId: string,
    options?: {
      inferenceReasonCodes?: InferenceReasonCode[];
      weakEvidence?: boolean;
    },
  ): SceneDetail['facadeHints'][number] {
    return {
      objectId,
      anchor: { lat: 35.6812, lng: 139.7671 },
      facadeEdgeIndex: null,
      windowBands: 0,
      billboardEligible: false,
      palette: [],
      materialClass: 'concrete',
      signageDensity: 'low',
      emissiveStrength: 0,
      glazingRatio: 0,
      weakEvidence: options?.weakEvidence,
      inferenceReasonCodes: options?.inferenceReasonCodes,
    };
  }

  it('legacy low-coverage case still fails (no mapillary hints)', async () => {
    const service = await buildService();

    const facadeHints = Array.from({ length: 20 }, (_, i) => makeFacadeHint(`bld-${i}`));

    const report = await service.buildReport({
      sceneId: 'legacy-low-coverage',
      meta: makeMinimalMeta(),
      detail: makeMinimalDetail({
        facadeHints,
        provenance: {
          mapillaryUsed: false,
          mapillaryImageCount: 0,
          mapillaryFeatureCount: 0,
          osmTagCoverage: { coloredBuildings: 0, materialBuildings: 0, crossings: 0, streetFurniture: 0, vegetation: 0 },
          overrideCount: 0,
        },
      }),
      twin: makeMinimalTwin(),
      validation: makeMinimalValidation(),
    });

    const observedCoverageCheck = report.checks.find((c) => c.id === 'observed_coverage');
    expect(observedCoverageCheck).toBeDefined();
    expect(observedCoverageCheck!.state).toBe('FAIL');
    expect(observedCoverageCheck!.metrics.observedAppearanceCoverage).toBe(0);
    expect(observedCoverageCheck!.metrics.mapillaryObservedFacadeHintCount).toBe(0);
    expect(observedCoverageCheck!.metrics.totalObservedCount).toBe(0);
  });

  it('mapillary-observed hints increase ratio without threshold changes', async () => {
    const service = await buildService();

    const facadeHints = [
      makeFacadeHint('bld-0', { inferenceReasonCodes: ['MISSING_FACADE_COLOR'] }),
      makeFacadeHint('bld-1', { inferenceReasonCodes: ['MISSING_FACADE_COLOR'] }),
      makeFacadeHint('bld-2', { inferenceReasonCodes: ['MISSING_FACADE_MATERIAL'] }),
      makeFacadeHint('bld-3', { inferenceReasonCodes: ['MISSING_ROOF_SHAPE'] }),
      ...Array.from({ length: 16 }, (_, i) => makeFacadeHint(`bld-${i + 4}`)),
    ];

    const report = await service.buildReport({
      sceneId: 'mapillary-boosted',
      meta: makeMinimalMeta(),
      detail: makeMinimalDetail({
        facadeHints,
        provenance: {
          mapillaryUsed: true,
          mapillaryImageCount: 50,
          mapillaryFeatureCount: 120,
          osmTagCoverage: { coloredBuildings: 0, materialBuildings: 0, crossings: 0, streetFurniture: 0, vegetation: 0 },
          overrideCount: 0,
        },
      }),
      twin: makeMinimalTwin(),
      validation: makeMinimalValidation(),
    });

    const observedCoverageCheck = report.checks.find((c) => c.id === 'observed_coverage');
    expect(observedCoverageCheck).toBeDefined();
    expect(observedCoverageCheck!.state).toBe('PASS');
    expect(observedCoverageCheck!.metrics.mapillaryObservedFacadeHintCount).toBe(4);
    expect(observedCoverageCheck!.metrics.totalObservedCount).toBe(4);
    // 4/20 = 0.2 >= 0.15 → PASS
    expect(observedCoverageCheck!.metrics.observedAppearanceCoverage).toBe(0.2);
  });

  it('inferred-only hints are NOT treated as observed', async () => {
    const service = await buildService();

    const facadeHints = [
      makeFacadeHint('bld-0', {
        inferenceReasonCodes: ['DEFAULT_STYLE_RULE', 'WEAK_EVIDENCE_RATIO_HIGH'],
        weakEvidence: true,
      }),
      makeFacadeHint('bld-1', {
        inferenceReasonCodes: ['MISSING_MAPILLARY_IMAGES', 'MISSING_MAPILLARY_FEATURES'],
      }),
      ...Array.from({ length: 18 }, (_, i) => makeFacadeHint(`bld-${i + 2}`)),
    ];

    const report = await service.buildReport({
      sceneId: 'inferred-only',
      meta: makeMinimalMeta(),
      detail: makeMinimalDetail({
        facadeHints,
        provenance: {
          mapillaryUsed: false,
          mapillaryImageCount: 0,
          mapillaryFeatureCount: 0,
          osmTagCoverage: { coloredBuildings: 0, materialBuildings: 0, crossings: 0, streetFurniture: 0, vegetation: 0 },
          overrideCount: 0,
        },
      }),
      twin: makeMinimalTwin(),
      validation: makeMinimalValidation(),
    });

    const observedCoverageCheck = report.checks.find((c) => c.id === 'observed_coverage');
    expect(observedCoverageCheck).toBeDefined();
    expect(observedCoverageCheck!.state).toBe('FAIL');
    expect(observedCoverageCheck!.metrics.mapillaryObservedFacadeHintCount).toBe(0);
    expect(observedCoverageCheck!.metrics.totalObservedCount).toBe(0);
  });

  it('mixed observed + inferred + OSM tags produce correct ratio', async () => {
    const service = await buildService();

    const facadeHints = [
      makeFacadeHint('bld-0', { inferenceReasonCodes: ['MISSING_FACADE_COLOR'] }),
      makeFacadeHint('bld-1', { inferenceReasonCodes: ['MISSING_FACADE_COLOR'] }),
      makeFacadeHint('bld-2', { inferenceReasonCodes: ['MISSING_FACADE_MATERIAL'] }),
      makeFacadeHint('bld-3', {
        inferenceReasonCodes: ['DEFAULT_STYLE_RULE', 'WEAK_EVIDENCE_RATIO_HIGH'],
        weakEvidence: true,
      }),
      makeFacadeHint('bld-4', {
        inferenceReasonCodes: ['DEFAULT_STYLE_RULE', 'WEAK_EVIDENCE_RATIO_HIGH'],
        weakEvidence: true,
      }),
      makeFacadeHint('bld-5', {
        inferenceReasonCodes: ['DEFAULT_STYLE_RULE', 'WEAK_EVIDENCE_RATIO_HIGH'],
        weakEvidence: true,
      }),
      makeFacadeHint('bld-6', {
        inferenceReasonCodes: ['DEFAULT_STYLE_RULE', 'WEAK_EVIDENCE_RATIO_HIGH'],
        weakEvidence: true,
      }),
      makeFacadeHint('bld-7', {
        inferenceReasonCodes: ['DEFAULT_STYLE_RULE', 'WEAK_EVIDENCE_RATIO_HIGH'],
        weakEvidence: true,
      }),
      ...Array.from({ length: 12 }, (_, i) => makeFacadeHint(`bld-${i + 8}`)),
    ];

    const report = await service.buildReport({
      sceneId: 'mixed-signals',
      meta: makeMinimalMeta(),
      detail: makeMinimalDetail({
        facadeHints,
        provenance: {
          mapillaryUsed: true,
          mapillaryImageCount: 30,
          mapillaryFeatureCount: 80,
          osmTagCoverage: { coloredBuildings: 2, materialBuildings: 0, crossings: 0, streetFurniture: 0, vegetation: 0 },
          overrideCount: 0,
        },
      }),
      twin: makeMinimalTwin(),
      validation: makeMinimalValidation(),
    });

    const observedCoverageCheck = report.checks.find((c) => c.id === 'observed_coverage');
    expect(observedCoverageCheck).toBeDefined();
    expect(observedCoverageCheck!.state).toBe('PASS');
    expect(observedCoverageCheck!.metrics.osmTagObservedCount).toBe(2);
    expect(observedCoverageCheck!.metrics.mapillaryObservedFacadeHintCount).toBe(3);
    expect(observedCoverageCheck!.metrics.totalObservedCount).toBe(5);
    expect(observedCoverageCheck!.metrics.observedAppearanceCoverage).toBe(0.25);
  });

  it('WARN boundary: ratio between 0.05 and 0.15', async () => {
    const service = await buildService();

    const facadeHints = [
      makeFacadeHint('bld-0', { inferenceReasonCodes: ['MISSING_FACADE_COLOR'] }),
      makeFacadeHint('bld-1', { inferenceReasonCodes: ['MISSING_FACADE_MATERIAL'] }),
      ...Array.from({ length: 18 }, (_, i) => makeFacadeHint(`bld-${i + 2}`)),
    ];

    const report = await service.buildReport({
      sceneId: 'warn-boundary',
      meta: makeMinimalMeta(),
      detail: makeMinimalDetail({
        facadeHints,
        provenance: {
          mapillaryUsed: true,
          mapillaryImageCount: 20,
          mapillaryFeatureCount: 50,
          osmTagCoverage: { coloredBuildings: 0, materialBuildings: 0, crossings: 0, streetFurniture: 0, vegetation: 0 },
          overrideCount: 0,
        },
      }),
      twin: makeMinimalTwin(),
      validation: makeMinimalValidation(),
    });

    const observedCoverageCheck = report.checks.find((c) => c.id === 'observed_coverage');
    expect(observedCoverageCheck).toBeDefined();
    expect(observedCoverageCheck!.state).toBe('WARN');
    expect(observedCoverageCheck!.metrics.observedAppearanceCoverage).toBe(0.1);
  });

  it('hint with mixed inference + observed codes counts as observed', async () => {
    const service = await buildService();

    const facadeHints = [
      makeFacadeHint('bld-0', {
        inferenceReasonCodes: ['MISSING_MAPILLARY_IMAGES', 'MISSING_FACADE_COLOR'],
      }),
      ...Array.from({ length: 19 }, (_, i) => makeFacadeHint(`bld-${i + 1}`)),
    ];

    const report = await service.buildReport({
      sceneId: 'mixed-codes',
      meta: makeMinimalMeta(),
      detail: makeMinimalDetail({
        facadeHints,
        provenance: {
          mapillaryUsed: true,
          mapillaryImageCount: 10,
          mapillaryFeatureCount: 20,
          osmTagCoverage: { coloredBuildings: 0, materialBuildings: 0, crossings: 0, streetFurniture: 0, vegetation: 0 },
          overrideCount: 0,
        },
      }),
      twin: makeMinimalTwin(),
      validation: makeMinimalValidation(),
    });

    const observedCoverageCheck = report.checks.find((c) => c.id === 'observed_coverage');
    expect(observedCoverageCheck).toBeDefined();
    expect(observedCoverageCheck!.metrics.mapillaryObservedFacadeHintCount).toBe(1);
    expect(observedCoverageCheck!.metrics.totalObservedCount).toBe(1);
  });

  it('empty facadeHints array does not cause division by zero', async () => {
    const service = await buildService();

    const report = await service.buildReport({
      sceneId: 'empty-hints',
      meta: makeMinimalMeta(),
      detail: makeMinimalDetail({
        facadeHints: [],
        provenance: {
          mapillaryUsed: false,
          mapillaryImageCount: 0,
          mapillaryFeatureCount: 0,
          osmTagCoverage: { coloredBuildings: 0, materialBuildings: 0, crossings: 0, streetFurniture: 0, vegetation: 0 },
          overrideCount: 0,
        },
      }),
      twin: makeMinimalTwin(),
      validation: makeMinimalValidation(),
    });

    const observedCoverageCheck = report.checks.find((c) => c.id === 'observed_coverage');
    expect(observedCoverageCheck).toBeDefined();
    expect(observedCoverageCheck!.metrics.observedAppearanceCoverage).toBe(0);
    expect(observedCoverageCheck!.metrics.facadeHintCount).toBe(0);
  });
});
