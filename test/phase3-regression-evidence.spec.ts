import { describe, expect, it, mock } from 'bun:test';
import { createEmptyGeometry } from '../src/assets/compiler/road/road-mesh.types';
import {
  pushTriangle,
  pushBox,
} from '../src/assets/internal/glb-build/geometry/glb-build-geometry-primitives.utils';
import {
  runTexcoordPreflight,
  formatTexcoordPreflightError,
  type TexcoordPreflightReport,
} from '../src/assets/internal/glb-build/glb-build-texcoord-preflight';
import {
  createTriangulationFallbackTracker,
  pushExtrudedPolygon,
  insetRing,
} from '../src/assets/compiler/building/building-mesh.shell.builder';
import {
  hasAdvisoryHighCorrectionRatio,
  findGeometryCorrectionDiagnostics,
} from '../src/scene/services/generation/quality-gate/scene-quality-gate-geometry';
import { buildSceneFidelityMetricsReport } from '../src/scene/utils/scene-fidelity-metrics.utils';
import type { SceneDetail, SceneMeta } from '../src/scene/types/scene.types';

/**
 * Phase 3 Unit 5 — Representative Regression Coverage & Evidence Collection
 *
 * Integration tests that verify the 4 Phase 3 units work together:
 * - Unit 1: UV/TEXCOORD_0 geometry plumbing
 * - Unit 2: Texture-bound preflight fail-closed
 * - Unit 3: Triangulation fallback count evidence
 * - Unit 4: correctedRatio advisory signal
 *
 * These tests exercise the units in combination, not in isolation.
 */
describe('Phase 3 Unit 5 — Regression Coverage & Evidence Integration', () => {
  describe('UV contract + preflight integration', () => {
    it('geometry with UVs passes preflight when material is textured', () => {
      // Build geometry WITH TEXCOORD_0
      const geo = createEmptyGeometry();
      pushTriangle(geo, [0, 0, 0], [1, 0, 0], [0, 0, 1]);
      expect(geo.uvs!.length).toBe(6);

      // Simulate a glTF document with textured material and TEXCOORD_0-bearing primitive
      const texturedMat = createMockMaterial('textured-mat', { hasBaseColorTexture: true });
      const prim = createMockPrimitive(texturedMat, { hasTexcoord: true });
      const mesh = createMockMesh('uv-mesh', [prim]);
      const doc = createMockDocument({ meshes: [mesh], materials: [texturedMat] });

      const report = runTexcoordPreflight(doc);
      expect(report.valid).toBe(true);
      expect(report.issues).toEqual([]);
    });

    it('geometry without UVs fails preflight when material is textured', () => {
      // Build geometry WITHOUT TEXCOORD_0
      const geo = createEmptyGeometry();
      geo.positions.push(0, 0, 0, 1, 0, 0, 0, 0, 1);
      geo.normals.push(0, 1, 0, 0, 1, 0, 0, 1, 0);
      geo.indices.push(0, 1, 2);
      // No UVs pushed
      expect(geo.uvs!.length).toBe(0);

      // Simulate a glTF document with textured material but NO TEXCOORD_0
      const texturedMat = createMockMaterial('textured-mat', { hasBaseColorTexture: true });
      const prim = createMockPrimitive(texturedMat, { hasTexcoord: false });
      const mesh = createMockMesh('no-uv-mesh', [prim]);
      const doc = createMockDocument({ meshes: [mesh], materials: [texturedMat] });

      const report = runTexcoordPreflight(doc);
      expect(report.valid).toBe(false);
      expect(report.issues).toHaveLength(1);
      expect(report.issues[0]!.missingAttribute).toBe('TEXCOORD_0');
    });

    it('pushBox UVs satisfy preflight for textured materials', () => {
      const geo = createEmptyGeometry();
      pushBox(geo, [0, 0, 0], [4, 2, 3]);

      // pushBox emits UVs matching vertex count
      expect(geo.uvs!.length).toBe(geo.positions.length / 3 * 2);
      expect(geo.uvs!.length).toBeGreaterThan(0);

      // Simulate preflight pass with textured material
      const texturedMat = createMockMaterial('box-texture', { hasBaseColorTexture: true });
      const prim = createMockPrimitive(texturedMat, { hasTexcoord: true });
      const mesh = createMockMesh('box-mesh', [prim]);
      const doc = createMockDocument({ meshes: [mesh], materials: [texturedMat] });

      const report = runTexcoordPreflight(doc);
      expect(report.valid).toBe(true);
    });

    it('untextured material passes preflight regardless of UV presence', () => {
      const untexturedMat = createMockMaterial('plain-mat', { hasBaseColorTexture: false });
      const prim = createMockPrimitive(untexturedMat, { hasTexcoord: false });
      const mesh = createMockMesh('plain-mesh', [prim]);
      const doc = createMockDocument({ meshes: [mesh], materials: [untexturedMat] });

      const report = runTexcoordPreflight(doc);
      expect(report.valid).toBe(true);
      expect(report.issues).toEqual([]);
    });
  });

  describe('Triangulation fallback evidence flow: tracker → fidelity metrics', () => {
    it('fallback tracker count flows into triangulationFallbackRate', () => {
      const tracker = createTriangulationFallbackTracker();
      expect(tracker.count).toBe(0);

      // Simulate triangulation failure → fallback to box
      const geometry = createEmptyGeometry();
      const outerRing = [
        [0, 0, 0],
        [10, 0, 0],
        [10, 0, 10],
        [0, 0, 10],
      ] as [number, number, number][];
      const failingTriangulate = mock(() => []);

      pushExtrudedPolygon(
        geometry,
        outerRing,
        [],
        0,
        10,
        failingTriangulate,
        'fallback-building',
        tracker,
      );

      expect(tracker.count).toBe(1);

      // Now verify the count flows into the fidelity metrics report
      const meta = makeMinimalSceneMeta({ buildings: [
        makeBuilding('b1', 'simple_extrude'),
      ]});
      const detail = makeMinimalSceneDetail();

      const report = buildSceneFidelityMetricsReport(meta, detail, {
        triangulationFallbackCount: tracker.count,
      });

      expect(report.quality.triangulationFallbackRate).toBe(1);
    });

    it('multiple fallbacks accumulate and produce correct rate', () => {
      const tracker = createTriangulationFallbackTracker();
      const geometry = createEmptyGeometry();
      const outerRing = [
        [0, 0, 0],
        [5, 0, 0],
        [5, 0, 5],
        [0, 0, 5],
      ] as [number, number, number][];
      const failingTriangulate = mock(() => []);

      // 3 buildings all fail triangulation
      pushExtrudedPolygon(geometry, outerRing, [], 0, 8, failingTriangulate, 'b1', tracker);
      pushExtrudedPolygon(geometry, outerRing, [], 0, 12, failingTriangulate, 'b2', tracker);
      pushExtrudedPolygon(geometry, outerRing, [], 0, 6, failingTriangulate, 'b3', tracker);

      expect(tracker.count).toBe(3);

      const meta = makeMinimalSceneMeta({
        buildings: [
          makeBuilding('b1', 'simple_extrude'),
          makeBuilding('b2', 'simple_extrude'),
          makeBuilding('b3', 'simple_extrude'),
        ],
      });
      const detail = makeMinimalSceneDetail();

      const report = buildSceneFidelityMetricsReport(meta, detail, {
        triangulationFallbackCount: tracker.count,
      });

      // 3 fallbacks / 3 buildings = 1.0
      expect(report.quality.triangulationFallbackRate).toBe(1);
    });

    it('triangulationFallbackRate is independent of fallbackProceduralRate', () => {
      const meta = makeMinimalSceneMeta({
        buildings: [
          makeBuilding('b1', 'simple_extrude'),
          makeBuilding('b2', 'fallback_massing'),
          makeBuilding('b3', 'simple_extrude'),
          makeBuilding('b4', 'simple_extrude'),
        ],
      });
      const detail = makeMinimalSceneDetail();

      // 2 triangulation fallbackes (separate from procedural fallback)
      const report = buildSceneFidelityMetricsReport(meta, detail, {
        triangulationFallbackCount: 2,
      });

      // fallbackProceduralRate = 1/4 = 0.25 (from geometryStrategy)
      expect(report.quality.fallbackProceduralRate).toBe(0.25);
      // triangulationFallbackRate = 2/4 = 0.5
      expect(report.quality.triangulationFallbackRate).toBe(0.5);
      // They are different metrics
      expect(report.quality.triangulationFallbackRate).not.toBe(
        report.quality.fallbackProceduralRate,
      );
    });
  });

  describe('correctedRatio advisory signal — boundary and edge cases', () => {
    it('advisory triggers at 0.5001 (just above threshold)', () => {
      expect(
        hasAdvisoryHighCorrectionRatio({
          geometryDiagnostics: [
            { objectId: '__geometry_correction__', correctedRatio: 0.5001 } as any,
          ],
        }),
      ).toBe(true);
    });

    it('advisory does NOT trigger at 0.4999 (just below threshold)', () => {
      expect(
        hasAdvisoryHighCorrectionRatio({
          geometryDiagnostics: [
            { objectId: '__geometry_correction__', correctedRatio: 0.4999 } as any,
          ],
        }),
      ).toBe(false);
    });

    it('advisory does NOT trigger at exactly 0.5 (strict greater-than)', () => {
      expect(
        hasAdvisoryHighCorrectionRatio({
          geometryDiagnostics: [
            { objectId: '__geometry_correction__', correctedRatio: 0.5 } as any,
          ],
        }),
      ).toBe(false);
    });

    it('advisory triggers at 1.0 (maximum)', () => {
      expect(
        hasAdvisoryHighCorrectionRatio({
          geometryDiagnostics: [
            { objectId: '__geometry_correction__', correctedRatio: 1.0 } as any,
          ],
        }),
      ).toBe(true);
    });

    it('advisory does NOT trigger at 0.0 (no corrections)', () => {
      expect(
        hasAdvisoryHighCorrectionRatio({
          geometryDiagnostics: [
            { objectId: '__geometry_correction__', correctedRatio: 0.0 } as any,
          ],
        }),
      ).toBe(false);
    });

    it('findGeometryCorrectionDiagnostics returns null for non-matching objectId', () => {
      const result = findGeometryCorrectionDiagnostics([
        { objectId: 'some-other-id', correctedRatio: 0.9 } as any,
      ]);
      expect(result).toBeNull();
    });

    it('findGeometryCorrectionDiagnostics extracts correctedRatio from matching entry', () => {
      const result = findGeometryCorrectionDiagnostics([
        { objectId: '__geometry_correction__', correctedRatio: 0.75 } as any,
      ]);
      expect(result).not.toBeNull();
      expect(result!.correctedRatio).toBe(0.75);
    });
  });

  describe('Full pipeline regression: all 4 units together', () => {
    it('successful build path: UVs present, preflight passes, no fallbacks, low correctedRatio', () => {
      // Unit 1: Geometry with UVs
      const geo = createEmptyGeometry();
      pushTriangle(geo, [0, 0, 0], [1, 0, 0], [0, 0, 1]);
      expect(geo.uvs!.length).toBe(6);

      // Unit 2: Preflight passes (textured material + TEXCOORD_0)
      const texturedMat = createMockMaterial('good-mat', { hasBaseColorTexture: true });
      const prim = createMockPrimitive(texturedMat, { hasTexcoord: true });
      const mesh = createMockMesh('good-mesh', [prim]);
      const doc = createMockDocument({ meshes: [mesh], materials: [texturedMat] });
      const preflight = runTexcoordPreflight(doc);
      expect(preflight.valid).toBe(true);

      // Unit 3: No triangulation fallbacks
      const meta = makeMinimalSceneMeta();
      const detail = makeMinimalSceneDetail();
      const fidelityReport = buildSceneFidelityMetricsReport(meta, detail, {
        triangulationFallbackCount: 0,
      });
      expect(fidelityReport.quality.triangulationFallbackRate).toBe(0);

      // Unit 4: Low correctedRatio — no advisory
      const advisory = hasAdvisoryHighCorrectionRatio({
        geometryDiagnostics: [
          { objectId: '__geometry_correction__', correctedRatio: 0.1 } as any,
        ],
      });
      expect(advisory).toBe(false);
    });

    it('degraded build path: preflight fails, fallbacks present, high correctedRatio advisory', () => {
      // Unit 2: Preflight fails (textured material without TEXCOORD_0)
      const badMat = createMockMaterial('bad-mat', { hasBaseColorTexture: true });
      const badPrim = createMockPrimitive(badMat, { hasTexcoord: false });
      const badMesh = createMockMesh('bad-mesh', [badPrim]);
      const badDoc = createMockDocument({ meshes: [badMesh], materials: [badMat] });
      const preflight = runTexcoordPreflight(badDoc);
      expect(preflight.valid).toBe(false);

      // Error message is human-readable
      const errorMsg = formatTexcoordPreflightError(preflight);
      expect(errorMsg).toContain('TEXCOORD_0 preflight failed');
      expect(errorMsg).toContain('1 textured primitive(s)');

      // Unit 3: High triangulation fallback rate
      const meta = makeMinimalSceneMeta();
      const detail = makeMinimalSceneDetail();
      const fidelityReport = buildSceneFidelityMetricsReport(meta, detail, {
        triangulationFallbackCount: 2,
      });
      expect(fidelityReport.quality.triangulationFallbackRate).toBe(1);

      // Unit 4: High correctedRatio triggers advisory
      const advisory = hasAdvisoryHighCorrectionRatio({
        geometryDiagnostics: [
          { objectId: '__geometry_correction__', correctedRatio: 0.93 } as any,
        ],
      });
      expect(advisory).toBe(true);
    });

    it('mixed scenario: some buildings fallback, correctedRatio at advisory threshold', () => {
      const tracker = createTriangulationFallbackTracker();
      const geometry = createEmptyGeometry();
      const outerRing = [
        [0, 0, 0],
        [8, 0, 0],
        [8, 0, 8],
        [0, 0, 8],
      ] as [number, number, number][];
      const failingTriangulate = mock(() => []);
      const goodTriangulate = mock((vertices: number[]) => {
        const pointCount = vertices.length / 2;
        const indices: number[] = [];
        for (let i = 1; i < pointCount - 1; i += 1) {
          indices.push(0, i, i + 1);
        }
        return indices;
      });

      // 1 building succeeds, 1 falls back
      pushExtrudedPolygon(geometry, outerRing, [], 0, 10, goodTriangulate, 'good-bldg', tracker);
      pushExtrudedPolygon(geometry, outerRing, [], 0, 10, failingTriangulate, 'bad-bldg', tracker);

      expect(tracker.count).toBe(1);

      const meta = makeMinimalSceneMeta({
        buildings: [
          makeBuilding('good-bldg', 'simple_extrude'),
          makeBuilding('bad-bldg', 'simple_extrude'),
        ],
      });
      const detail = makeMinimalSceneDetail();
      const fidelityReport = buildSceneFidelityMetricsReport(meta, detail, {
        triangulationFallbackCount: tracker.count,
      });

      expect(fidelityReport.quality.triangulationFallbackRate).toBe(0.5);

      // correctedRatio at exactly 0.5 — advisory should NOT fire (strict >)
      const advisory = hasAdvisoryHighCorrectionRatio({
        geometryDiagnostics: [
          { objectId: '__geometry_correction__', correctedRatio: 0.5 } as any,
        ],
      });
      expect(advisory).toBe(false);
    });
  });

  describe('Evidence collection: preflight error formatting', () => {
    it('formatTexcoordPreflightError produces actionable message for single issue', () => {
      const report: TexcoordPreflightReport = {
        valid: false,
        issues: [
          { meshName: 'building-shell-1', materialName: 'facade-texture', missingAttribute: 'TEXCOORD_0' },
        ],
      };
      const msg = formatTexcoordPreflightError(report);
      expect(msg).toContain('TEXCOORD_0 preflight failed');
      expect(msg).toContain('1 textured primitive(s)');
      expect(msg).toContain('mesh="building-shell-1"');
      expect(msg).toContain('material="facade-texture"');
      expect(msg).toContain('missing=TEXCOORD_0');
    });

    it('formatTexcoordPreflightError handles multiple issues with distinct meshes', () => {
      const report: TexcoordPreflightReport = {
        valid: false,
        issues: [
          { meshName: 'mesh-a', materialName: 'mat-a', missingAttribute: 'TEXCOORD_0' },
          { meshName: 'mesh-b', materialName: 'mat-b', missingAttribute: 'TEXCOORD_0' },
          { meshName: 'mesh-c', materialName: 'mat-a', missingAttribute: 'TEXCOORD_0' },
        ],
      };
      const msg = formatTexcoordPreflightError(report);
      expect(msg).toContain('3 textured primitive(s)');
      expect(msg).toContain('mesh="mesh-a"');
      expect(msg).toContain('mesh="mesh-b"');
      expect(msg).toContain('mesh="mesh-c"');
    });

    it('formatTexcoordPreflightError handles empty issues (edge case)', () => {
      const report: TexcoordPreflightReport = {
        valid: true,
        issues: [],
      };
      const msg = formatTexcoordPreflightError(report);
      expect(msg).toContain('0 textured primitive(s)');
    });
  });
});

// --- Mock helpers (reused from phase3-texcoord-preflight.spec.ts) ---

function createMockMaterial(
  name: string,
  options: { hasBaseColorTexture?: boolean } = {},
): Record<string, unknown> {
  const material: Record<string, unknown> = {
    getName: () => name,
  };
  if (options.hasBaseColorTexture) {
    material.getBaseColorTexture = () => ({ uri: 'test.png' });
  } else {
    material.getBaseColorTexture = () => null;
  }
  return material;
}

function createMockPrimitive(
  material: Record<string, unknown>,
  options: { hasTexcoord?: boolean; noGetAttribute?: boolean } = {},
): Record<string, unknown> {
  const prim: Record<string, unknown> = {
    getMaterial: () => material,
  };
  if (options.noGetAttribute) {
    // No getAttribute method at all
  } else if (options.hasTexcoord) {
    prim.getAttribute = (attr: string) => (attr === 'TEXCOORD_0' ? {} : null);
  } else {
    prim.getAttribute = () => null;
  }
  return prim;
}

function createMockMesh(
  name: string,
  primitives: Record<string, unknown>[],
): Record<string, unknown> {
  return {
    getName: () => name,
    listPrimitives: () => primitives,
  };
}

function createMockDocument(options: {
  meshes: Record<string, unknown>[];
  materials: Record<string, unknown>[];
}): Record<string, unknown> {
  const root: Record<string, unknown> = {
    listMeshes: () => options.meshes,
    listMaterials: () => options.materials,
  };
  return {
    getRoot: () => root,
  };
}

// --- Scene fixture helpers (reused from phase3-triangulation-fallback-metric.spec.ts) ---

function makeBuilding(
  objectId: string,
  geometryStrategy: string,
): SceneMeta['buildings'][number] {
  return {
    objectId,
    outerRing: [
      { lat: 37.5665, lng: 126.978 },
      { lat: 37.5666, lng: 126.978 },
      { lat: 37.5666, lng: 126.979 },
      { lat: 37.5665, lng: 126.979 },
    ],
    holes: [],
    heightMeters: 10,
    geometryStrategy: geometryStrategy as SceneMeta['buildings'][number]['geometryStrategy'],
    osmWayId: '1',
    preset: 'small_lowrise',
    roofType: 'flat',
    name: objectId,
    footprint: [],
    usage: 'MIXED',
    groundOffsetM: 0,
    terrainOffsetM: 0,
  };
}

function makeMinimalSceneMeta(overrides?: Partial<SceneMeta>): SceneMeta {
  const buildings = overrides?.buildings ?? [
    makeBuilding('b1', 'simple_extrude'),
    makeBuilding('b2', 'fallback_massing'),
  ];
  return {
    sceneId: 'test-scene',
    placeId: 'test-place',
    name: 'test-scene',
    generatedAt: '2026-01-01T00:00:00.000Z',
    detailStatus: 'FULL',
    origin: { lat: 37.5665, lng: 126.978 },
    camera: {
      topView: { x: 0, y: 100, z: 0 },
      walkViewStart: { x: 0, y: 2, z: 10 },
    },
    bounds: {
      radiusM: 500,
      northEast: { lat: 37.57, lng: 126.982 },
      southWest: { lat: 37.563, lng: 126.974 },
    },
    stats: {
      buildingCount: buildings.length,
      roadCount: 0,
      walkwayCount: 0,
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
    visualCoverage: {
      structure: 0,
      streetDetail: 0,
      landmark: 0,
      signage: 0,
    },
    buildings,
    roads: [],
    walkways: [],
    pois: [],
    materialClasses: [],
    landmarkAnchors: [],
    assetProfile: {
      preset: 'SMALL',
      selected: {
        buildingCount: buildings.length,
        roadCount: 0,
        crossingCount: 0,
        trafficLightCount: 0,
        streetLightCount: 0,
        signPoleCount: 0,
        treeClusterCount: 0,
        walkwayCount: 0,
        poiCount: 0,
        billboardPanelCount: 0,
      },
      budget: {
        buildingCount: 100,
        roadCount: 100,
        crossingCount: 50,
        trafficLightCount: 100,
        streetLightCount: 100,
        signPoleCount: 100,
        treeClusterCount: 100,
        walkwayCount: 50,
        poiCount: 50,
        billboardPanelCount: 50,
      },
    },
    structuralCoverage: {
      selectedBuildingCoverage: 0.8,
      coreAreaBuildingCoverage: 0.7,
      fallbackMassingRate: 0.5,
      footprintPreservationRate: 0.9,
      heroLandmarkCoverage: 0.1,
    },
    ...overrides,
  };
}

function makeMinimalSceneDetail(overrides?: Partial<SceneDetail>): SceneDetail {
  return {
    sceneId: 'test-scene',
    placeId: 'test-place',
    generatedAt: '2026-01-01T00:00:00.000Z',
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
    geometryDiagnostics: [],
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
