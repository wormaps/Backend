import { describe, expect, it } from 'bun:test';
import { buildSceneFidelityMetricsReport } from '../src/scene/utils/scene-fidelity-metrics.utils';
import type { SceneDetail, SceneMeta } from '../src/scene/types/scene.types';

function makeMinimalSceneMeta(overrides?: Partial<SceneMeta>): SceneMeta {
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
      buildingCount: 2,
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
    buildings: [
      {
        objectId: 'b1',
        outerRing: [
          { lat: 37.5665, lng: 126.978 },
          { lat: 37.5666, lng: 126.978 },
          { lat: 37.5666, lng: 126.979 },
          { lat: 37.5665, lng: 126.979 },
        ],
        holes: [],
        heightMeters: 10,
        geometryStrategy: 'simple_extrude',
        osmWayId: '1',
        preset: 'small_lowrise',
        roofType: 'flat',
        name: 'b1',
        footprint: [],
        usage: 'MIXED',
        groundOffsetM: 0,
        terrainOffsetM: 0,
      },
      {
        objectId: 'b2',
        outerRing: [
          { lat: 37.5667, lng: 126.978 },
          { lat: 37.5668, lng: 126.978 },
          { lat: 37.5668, lng: 126.979 },
          { lat: 37.5667, lng: 126.979 },
        ],
        holes: [],
        heightMeters: 15,
        geometryStrategy: 'fallback_massing',
        osmWayId: '2',
        preset: 'small_lowrise',
        roofType: 'flat',
        name: 'b2',
        footprint: [],
        usage: 'MIXED',
        groundOffsetM: 0,
        terrainOffsetM: 0,
      },
    ],
    roads: [],
    walkways: [],
    pois: [],
    materialClasses: [],
    landmarkAnchors: [],
    assetProfile: {
      preset: 'SMALL',
      selected: {
        buildingCount: 2,
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

describe('Phase 3 Unit 3 — Triangulation Fallback Metric', () => {
  describe('buildSceneFidelityMetricsReport', () => {
    it('produces triangulationFallbackRate = 0 when no override provided', () => {
      const meta = makeMinimalSceneMeta();
      const detail = makeMinimalSceneDetail();

      const report = buildSceneFidelityMetricsReport(meta, detail);

      expect(report.quality.triangulationFallbackRate).toBe(0);
    });

    it('produces triangulationFallbackRate from override count', () => {
      const meta = makeMinimalSceneMeta();
      const detail = makeMinimalSceneDetail();

      const report = buildSceneFidelityMetricsReport(meta, detail, {
        triangulationFallbackCount: 1,
      });

      // 1 fallback out of 2 buildings = 0.5
      expect(report.quality.triangulationFallbackRate).toBe(0.5);
    });

    it('keeps triangulationFallbackRate separate from fallbackProceduralRate', () => {
      const meta = makeMinimalSceneMeta();
      const detail = makeMinimalSceneDetail();

      const report = buildSceneFidelityMetricsReport(meta, detail, {
        triangulationFallbackCount: 2,
      });

      // fallbackProceduralRate counts geometryStrategy === 'fallback_massing' (1 out of 2)
      expect(report.quality.fallbackProceduralRate).toBe(0.5);
      // triangulationFallbackRate counts triangulation-triggered box fallbacks (2 out of 2)
      expect(report.quality.triangulationFallbackRate).toBe(1);
      // They are independent metrics with different values
      expect(report.quality.triangulationFallbackRate).not.toBe(
        report.quality.fallbackProceduralRate,
      );
    });

    it('handles zero buildings gracefully', () => {
      const meta = makeMinimalSceneMeta({ buildings: [] });
      const detail = makeMinimalSceneDetail();

      const report = buildSceneFidelityMetricsReport(meta, detail, {
        triangulationFallbackCount: 0,
      });

      expect(report.quality.triangulationFallbackRate).toBe(0);
    });

    it('does not become a hard gate — metric is evidence-only', () => {
      const meta = makeMinimalSceneMeta();
      const detail = makeMinimalSceneDetail();

      // Even with high triangulation fallback rate, the report is produced
      // without any gate-blocking behavior
      const report = buildSceneFidelityMetricsReport(meta, detail, {
        triangulationFallbackCount: 100,
      });

      expect(report.quality.triangulationFallbackRate).toBeGreaterThan(0);
      // The report structure is complete — no gate rejection
      expect(report.score.overall).toBeDefined();
      expect(report.score.breakdown.structure).toBeDefined();
    });
  });
});
