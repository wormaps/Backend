import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SceneQualityGateService } from './scene-quality-gate.service';
import type { SceneDetail, SceneMeta } from '../../types/scene.types';

type SceneGeometryDiagnosticWithCorrection = {
  objectId: string;
  strategy: 'fallback_massing';
  fallbackApplied: boolean;
  fallbackReason: 'NONE';
  hasHoles: false;
  polygonComplexity: 'simple';
  collisionRiskCount: number;
  groundedGapCount: number;
};

const COLLISION_HARD_FAIL_RATIO = 0.015;

function coordinate(lat: number, lng: number) {
  return { lat, lng };
}

describe('SceneQualityGateService', () => {
  const originalSceneDataDir = process.env.SCENE_DATA_DIR;

  afterEach(() => {
    if (originalSceneDataDir) {
      process.env.SCENE_DATA_DIR = originalSceneDataDir;
      return;
    }
    delete process.env.SCENE_DATA_DIR;
  });

  it('requires oracle approval file in PHASE_3_PRODUCTION_LOCK', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'wormapb-qg-test-'));
    process.env.SCENE_DATA_DIR = tempDir;

    const service = new SceneQualityGateService();
    const sceneId = 'scene-qg-phase3';
    const meta = createSceneMeta(sceneId, 'PHASE_3_PRODUCTION_LOCK');
    const detail = createSceneDetail(sceneId, 'PHASE_3_PRODUCTION_LOCK');

    await writeFile(
      join(tempDir, `${sceneId}.diagnostics.log`),
      `${JSON.stringify({
        stage: 'glb_build',
        meshNodes: [
          {
            name: 'road_base',
            skipped: false,
          },
        ],
      })}\n`,
      'utf8',
    );

    const pendingResult = await service.evaluate(meta, detail);
    expect(pendingResult.oracleApproval.required).toBe(true);
    expect(pendingResult.oracleApproval.state).toBe('PENDING');
    expect(pendingResult.reasonCodes).toContain('ORACLE_APPROVAL_REQUIRED');

    await writeFile(
      join(tempDir, `${sceneId}.oracle-approval.json`),
      JSON.stringify(
        {
          state: 'APPROVED',
          approvedBy: 'oracle-review-bot',
          approvedAt: '2026-04-08T00:00:00.000Z',
          note: 'phase-3 review passed',
        },
        null,
        2,
      ),
      'utf8',
    );

    const approvedResult = await service.evaluate(meta, detail);
    expect(approvedResult.oracleApproval.state).toBe('APPROVED');
    expect(approvedResult.reasonCodes).not.toContain(
      'ORACLE_APPROVAL_REQUIRED',
    );

    await writeFile(
      join(tempDir, `${sceneId}.oracle-approval.json`),
      JSON.stringify(
        {
          state: 'REJECTED',
          approvedBy: 'oracle-review-bot',
          approvedAt: '2026-04-08T01:00:00.000Z',
          note: 'artifact quality insufficient',
        },
        null,
        2,
      ),
      'utf8',
    );

    const rejectedResult = await service.evaluate(meta, detail);
    expect(rejectedResult.oracleApproval.state).toBe('REJECTED');
    expect(rejectedResult.state).toBe('FAIL');
    expect(rejectedResult.reasonCodes).toContain('ORACLE_APPROVAL_REQUIRED');
  });

  it('fails when geometry diagnostics report collisions and grounding gaps', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'wormapb-qg-geom-'));
    process.env.SCENE_DATA_DIR = tempDir;

    const service = new SceneQualityGateService();
    const sceneId = 'scene-qg-geometry';
    const meta = createSceneMeta(sceneId, 'PHASE_1_BASELINE');
    const detail = createSceneDetail(sceneId, 'PHASE_1_BASELINE');
    const correctionDiagnostic: SceneGeometryDiagnosticWithCorrection = {
      objectId: '__geometry_correction__',
      strategy: 'fallback_massing',
      fallbackApplied: true,
      fallbackReason: 'NONE',
      hasHoles: false,
      polygonComplexity: 'simple',
      collisionRiskCount: 3,
      groundedGapCount: 1,
    };
    detail.geometryDiagnostics = [
      correctionDiagnostic as unknown as NonNullable<
        SceneDetail['geometryDiagnostics']
      >[number],
    ];

    await writeFile(
      join(tempDir, `${sceneId}.diagnostics.log`),
      `${JSON.stringify({
        stage: 'glb_build',
        meshNodes: [{ name: 'road_base', skipped: false }],
      })}\n`,
      'utf8',
    );

    const result = await service.evaluate(meta, detail);
    expect(result.state).toBe('FAIL');
    expect(result.reasonCodes).toContain('CRITICAL_COLLISION_DETECTED');
    expect(result.reasonCodes).toContain('CRITICAL_GROUNDING_GAP_DETECTED');
  });

  it('does not fail for low collision ratio alone', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'wormapb-qg-collide-'));
    process.env.SCENE_DATA_DIR = tempDir;

    const service = new SceneQualityGateService();
    const sceneId = 'scene-qg-collision-ratio';
    const meta = createSceneMeta(sceneId, 'PHASE_1_BASELINE');
    meta.buildings = Array.from({ length: 200 }, (_, index) => ({
      ...meta.buildings[0],
      objectId: `building-${index}`,
      osmWayId: `building_${index}`,
    }));
    const detail = createSceneDetail(sceneId, 'PHASE_1_BASELINE');
    detail.geometryDiagnostics = [
      {
        objectId: '__geometry_correction__',
        strategy: 'fallback_massing',
        fallbackApplied: true,
        fallbackReason: 'NONE',
        hasHoles: false,
        polygonComplexity: 'simple',
        collisionRiskCount: Math.floor(
          200 * (COLLISION_HARD_FAIL_RATIO - 0.005),
        ),
        groundedGapCount: 0,
      } as unknown as NonNullable<SceneDetail['geometryDiagnostics']>[number],
    ];

    await writeFile(
      join(tempDir, `${sceneId}.diagnostics.log`),
      `${JSON.stringify({
        stage: 'glb_build',
        meshNodes: [{ name: 'road_base', skipped: false }],
      })}\n`,
      'utf8',
    );

    const result = await service.evaluate(meta, detail);
    expect(result.reasonCodes).not.toContain('CRITICAL_COLLISION_DETECTED');
  });
});

function createSceneMeta(
  sceneId: string,
  phase:
    | 'PHASE_1_BASELINE'
    | 'PHASE_2_HYBRID_FOUNDATION'
    | 'PHASE_3_PRODUCTION_LOCK',
): SceneMeta {
  return {
    sceneId,
    placeId: 'place-1',
    name: 'Test Scene',
    generatedAt: '2026-04-08T00:00:00.000Z',
    origin: coordinate(35.6595, 139.7005),
    camera: {
      topView: { x: 0, y: 120, z: 90 },
      walkViewStart: { x: 0, y: 1.7, z: 6 },
    },
    bounds: {
      radiusM: 600,
      northEast: coordinate(35.66, 139.701),
      southWest: coordinate(35.659, 139.7),
    },
    stats: {
      buildingCount: 1,
      roadCount: 1,
      walkwayCount: 1,
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
        buildingCount: 1,
        roadCount: 1,
        walkwayCount: 1,
        poiCount: 0,
        crossingCount: 0,
        trafficLightCount: 1,
        streetLightCount: 1,
        signPoleCount: 1,
        treeClusterCount: 0,
        billboardPanelCount: 0,
      },
      selected: {
        buildingCount: 1,
        roadCount: 1,
        walkwayCount: 1,
        poiCount: 0,
        crossingCount: 0,
        trafficLightCount: 1,
        streetLightCount: 1,
        signPoleCount: 1,
        treeClusterCount: 0,
        billboardPanelCount: 0,
      },
    },
    structuralCoverage: {
      selectedBuildingCoverage: 1,
      coreAreaBuildingCoverage: 1,
      fallbackMassingRate: 0,
      footprintPreservationRate: 1,
      heroLandmarkCoverage: 1,
    },
    fidelityPlan: {
      currentMode: 'REALITY_OVERLAY_READY',
      targetMode: 'REALITY_OVERLAY_READY',
      targetCoverageRatio: 0.7,
      achievedCoverageRatio: 0.8,
      coverageGapRatio: 0,
      phase,
      coreRadiusM: 320,
      priorities: ['구조 보존'],
      evidence: {
        structure: 'HIGH',
        facade: 'HIGH',
        signage: 'HIGH',
        streetFurniture: 'HIGH',
        landmark: 'HIGH',
      },
      sourceRegistry: [
        {
          sourceType: 'OSM',
          enabled: true,
          coverage: 'FULL',
          reason: 'test',
        },
      ],
    },
    roads: [
      {
        objectId: 'road-1',
        osmWayId: 'road_1',
        name: 'road',
        laneCount: 2,
        roadClass: 'primary',
        widthMeters: 12,
        direction: 'TWO_WAY',
        path: [coordinate(35.6595, 139.7005), coordinate(35.6596, 139.7006)],
        center: coordinate(35.65955, 139.70055),
        surface: null,
        bridge: false,
        roadVisualClass: 'arterial',
      },
    ],
    buildings: [
      {
        objectId: 'building-1',
        osmWayId: 'building_1',
        name: 'building',
        heightMeters: 30,
        outerRing: [
          coordinate(35.6595, 139.7005),
          coordinate(35.6596, 139.7006),
          coordinate(35.6594, 139.7007),
        ],
        holes: [],
        footprint: [],
        usage: 'COMMERCIAL',
        facadeColor: '#cccccc',
        facadeMaterial: 'glass',
        roofColor: null,
        roofMaterial: null,
        roofShape: null,
        buildingPart: null,
        preset: 'glass_tower',
        roofType: 'flat',
      },
    ],
    walkways: [],
    pois: [],
  };
}

function createSceneDetail(
  sceneId: string,
  phase:
    | 'PHASE_1_BASELINE'
    | 'PHASE_2_HYBRID_FOUNDATION'
    | 'PHASE_3_PRODUCTION_LOCK',
): SceneDetail {
  return {
    sceneId,
    placeId: 'place-1',
    generatedAt: '2026-04-08T00:00:00.000Z',
    detailStatus: 'FULL',
    crossings: [],
    roadMarkings: [
      {
        objectId: 'marking-1',
        type: 'LANE_LINE',
        color: '#ffffff',
        path: [coordinate(35.6595, 139.7005), coordinate(35.6596, 139.7006)],
      },
    ],
    streetFurniture: [
      {
        objectId: 'light-1',
        type: 'TRAFFIC_LIGHT',
        name: 'signal',
        location: coordinate(35.65955, 139.70055),
        principal: true,
      },
    ],
    vegetation: [],
    landCovers: [],
    linearFeatures: [],
    facadeHints: [
      {
        objectId: 'building-1',
        anchor: coordinate(35.65955, 139.70055),
        facadeEdgeIndex: 0,
        windowBands: 6,
        billboardEligible: true,
        palette: ['#888888', '#777777'],
        materialClass: 'glass',
        signageDensity: 'high',
        emissiveStrength: 0.8,
        glazingRatio: 0.6,
      },
    ],
    signageClusters: [
      {
        objectId: 'sig-1',
        anchor: coordinate(35.65955, 139.70055),
        panelCount: 3,
        palette: ['#ff0000'],
        emissiveStrength: 0.8,
        widthMeters: 2,
        heightMeters: 1,
      },
    ],
    annotationsApplied: ['ann-1', 'ann-2', 'ann-3'],
    fidelityPlan: {
      currentMode: 'REALITY_OVERLAY_READY',
      targetMode: 'REALITY_OVERLAY_READY',
      targetCoverageRatio: 0.7,
      achievedCoverageRatio: 0.8,
      coverageGapRatio: 0,
      phase,
      coreRadiusM: 320,
      priorities: ['구조 보존'],
      evidence: {
        structure: 'HIGH',
        facade: 'HIGH',
        signage: 'HIGH',
        streetFurniture: 'HIGH',
        landmark: 'HIGH',
      },
      sourceRegistry: [
        {
          sourceType: 'OSM',
          enabled: true,
          coverage: 'FULL',
          reason: 'test',
        },
      ],
    },
    provenance: {
      mapillaryUsed: true,
      mapillaryImageCount: 3,
      mapillaryFeatureCount: 120,
      osmTagCoverage: {
        coloredBuildings: 1,
        materialBuildings: 1,
        crossings: 0,
        streetFurniture: 1,
        vegetation: 0,
      },
      overrideCount: 3,
    },
  };
}
