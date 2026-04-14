import type {
  SceneDetail,
  SceneQualityGateResult,
  SpatialFrameManifest,
  TwinComponent,
} from '../../types/scene.types';
import {
  buildValidationReport,
  countTwinPropertyOrigins,
} from './twin-validation.builder';

describe('twin-validation.builder', () => {
  it('fails semantic validation when inferred/defaulted ratio is excessive', () => {
    const components: TwinComponent[] = [
      {
        componentId: 'component-1',
        entityId: 'entity-1',
        kind: 'IDENTITY',
        label: 'Identity',
        properties: [
          property('name', 'observed'),
          property('placeId', 'observed'),
        ],
      },
      {
        componentId: 'component-2',
        entityId: 'entity-1',
        kind: 'APPEARANCE',
        label: 'Appearance',
        properties: [
          property('facadeColor', 'inferred'),
          property('facadeMaterial', 'defaulted'),
          property('roofType', 'defaulted'),
        ],
      },
    ];

    const validation = buildValidationReport({
      sceneId: 'scene-test',
      generatedAt: '2026-04-04T00:00:00Z',
      twinEntityCount: 2,
      twinComponentCount: components.length,
      evidenceCount: 2,
      deliveryArtifactCount: 3,
      spatialFrame: createSpatialFrame(),
      assetPath: '/tmp/base.glb',
      qualityGate: createQualityGate(),
      detail: createDetail(),
      sceneStateBindingCount: 1,
      entityStateBindingCount: 1,
      twinPropertyOriginCounts: countTwinPropertyOrigins(components),
    });

    const semanticGate = validation.gates.find(
      (gate) => gate.gate === 'semantic',
    );

    expect(semanticGate?.state).toBe('WARN');
    expect(semanticGate?.reasonCodes).toContain(
      'LOW_OBSERVED_APPEARANCE_COVERAGE',
    );
    expect(semanticGate?.reasonCodes).toContain(
      'HIGH_INFERENCE_PROPERTY_RATIO',
    );
    expect(validation.summary).toBe('WARN');
  });

  it('passes semantic validation when properties are mostly observed', () => {
    const components: TwinComponent[] = [
      {
        componentId: 'component-1',
        entityId: 'entity-1',
        kind: 'IDENTITY',
        label: 'Identity',
        properties: [
          property('name', 'observed'),
          property('placeId', 'observed'),
        ],
      },
      {
        componentId: 'component-2',
        entityId: 'entity-1',
        kind: 'SPATIAL',
        label: 'Spatial',
        properties: [
          property('origin', 'observed'),
          property('bounds', 'observed'),
        ],
      },
    ];

    const validation = buildValidationReport({
      sceneId: 'scene-test',
      generatedAt: '2026-04-04T00:00:00Z',
      twinEntityCount: 2,
      twinComponentCount: components.length,
      evidenceCount: 2,
      deliveryArtifactCount: 3,
      spatialFrame: createSpatialFrame(),
      assetPath: '/tmp/base.glb',
      qualityGate: createQualityGate(),
      detail: createDetail({
        facadeHintCount: 2,
        coloredBuildings: 2,
        materialBuildings: 1,
      }),
      sceneStateBindingCount: 1,
      entityStateBindingCount: 1,
      twinPropertyOriginCounts: countTwinPropertyOrigins(components),
    });

    const semanticGate = validation.gates.find(
      (gate) => gate.gate === 'semantic',
    );

    expect(semanticGate?.state).toBe('PASS');
    expect(semanticGate?.reasonCodes).toEqual([]);
  });
});

function property(name: string, origin: 'observed' | 'inferred' | 'defaulted') {
  return {
    propertyId: `property-${name}`,
    name,
    value: name,
    valueType: 'string' as const,
    origin,
    confidence: 0.8,
    sourceSnapshotIds: ['snapshot-1'],
    evidenceIds: [],
  };
}

function createSpatialFrame(): SpatialFrameManifest {
  return {
    frameId: 'frame-test',
    sceneId: 'scene-test',
    generatedAt: '2026-04-04T00:00:00Z',
    geodeticCrs: 'WGS84',
    localFrame: 'ENU',
    axis: 'Z_UP',
    unit: 'meter',
    heightReference: 'ELLIPSOID_APPROX',
    anchor: { lat: 37.56, lng: 126.97 },
    bounds: {
      northEast: { lat: 37.57, lng: 126.98 },
      southWest: { lat: 37.55, lng: 126.96 },
    },
    extentMeters: { width: 100, depth: 100, radius: 50 },
    transform: {
      metersPerLat: 111000,
      metersPerLng: 88000,
      localAxes: { east: [1, 0, 0], north: [0, 0, -1], up: [0, 1, 0] },
    },
    terrain: {
      mode: 'FLAT_PLACEHOLDER',
      source: 'NONE',
      hasElevationModel: false,
      baseHeightMeters: 0,
      sampleCount: 0,
      sourcePath: null,
      notes: 'none',
    },
    verification: {
      sampleCount: 3,
      maxRoundTripErrorM: 0.1,
      avgRoundTripErrorM: 0.05,
      samples: [],
    },
    delivery: {
      glbAxisConvention: 'Y_UP_DERIVED',
      transformRequired: true,
    },
  };
}

function createQualityGate(): SceneQualityGateResult {
  return {
    version: 'qg.v1',
    state: 'PASS',
    reasonCodes: [],
    scores: {
      overall: 0.8,
      breakdown: {
        structure: 0.8,
        atmosphere: 0.8,
        placeReadability: 0.8,
      },
      modeDeltaOverallScore: 0,
    },
    thresholds: {
      coverageGapMax: 1,
      overallMin: 0.45,
      structureMin: 0.45,
      placeReadabilityMin: 0,
      modeDeltaOverallMin: -0.2,
      criticalPolygonBudgetExceededMax: 0,
      criticalInvalidGeometryMax: 0,
      maxSkippedMeshesWarn: 180,
      maxMissingSourceWarn: 48,
    },
    meshSummary: {
      totalSkipped: 0,
      polygonBudgetExceededCount: 0,
      criticalPolygonBudgetExceededCount: 0,
      emptyOrInvalidGeometryCount: 0,
      criticalEmptyOrInvalidGeometryCount: 0,
      selectionCutCount: 0,
      missingSourceCount: 0,
    },
    artifactRefs: {
      diagnosticsLogPath: '/tmp/diagnostics.log',
      modeComparisonPath: '/tmp/mode-comparison.json',
    },
    oracleApproval: {
      required: false,
      state: 'NOT_REQUIRED',
      source: 'auto',
    },
    decidedAt: '2026-04-04T00:00:00Z',
  };
}

function createDetail(
  options: {
    facadeHintCount?: number;
    coloredBuildings?: number;
    materialBuildings?: number;
  } = {},
): SceneDetail {
  const facadeHintCount = options.facadeHintCount ?? 0;
  const coloredBuildings = options.coloredBuildings ?? 0;
  const materialBuildings = options.materialBuildings ?? 0;
  return {
    sceneId: 'scene-test',
    placeId: 'place-test',
    generatedAt: '2026-04-04T00:00:00Z',
    detailStatus: 'OSM_ONLY',
    crossings: [],
    roadMarkings: [],
    streetFurniture: [],
    vegetation: [],
    landCovers: [],
    linearFeatures: [],
    facadeHints: Array.from({ length: facadeHintCount }).map((_, index) => ({
      objectId: `building-${index}`,
      anchor: { lat: 37.56 + index * 0.0001, lng: 126.97 + index * 0.0001 },
      facadeEdgeIndex: 0,
      windowBands: 4,
      billboardEligible: false,
      palette: ['#445566', '#667788', '#8899aa'],
      materialClass: 'concrete' as const,
      signageDensity: 'low' as const,
      emissiveStrength: 0.3,
      glazingRatio: 0.4,
      weakEvidence: false,
      inferenceReasonCodes: [],
      contextProfile: 'CIVIC_CLUSTER' as const,
      districtConfidence: 0.9,
      evidenceStrength: 'strong' as const,
      contextualMaterialUpgrade: false,
    })),
    signageClusters: [],
    staticAtmosphere: {
      preset: 'DAY_CLEAR',
      emissiveBoost: 1,
      roadRoughnessScale: 1,
      wetRoadBoost: 0,
    },
    annotationsApplied: [],
    provenance: {
      mapillaryUsed: false,
      mapillaryImageCount: 0,
      mapillaryFeatureCount: 0,
      osmTagCoverage: {
        coloredBuildings,
        materialBuildings,
        crossings: 0,
        streetFurniture: 0,
        vegetation: 0,
      },
      overrideCount: 0,
    },
  };
}
