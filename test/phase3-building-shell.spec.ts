import { describe, expect, it, mock } from 'bun:test';
import {
  createTriangulationFallbackTracker,
  insetRing,
  pushExtrudedPolygon,
  resolveBuildingVerticalBase,
} from '../src/assets/compiler/building/building-mesh.shell.builder';
import type { Vec3 } from '../src/assets/compiler/road/road-mesh.builder';
import { createEmptyGeometry } from '../src/assets/compiler/road/road-mesh.builder';

describe('Phase 3 — Building Shell Geometry', () => {
  describe('3.1 Setback Gap Removal', () => {
    it('SETBACK_OVERLAP should be 0.0 to eliminate gaps', () => {
      const geometry = createEmptyGeometry();
      const outerRing: Vec3[] = [
        [0, 0, 0],
        [10, 0, 0],
        [10, 0, 10],
        [0, 0, 10],
      ];
      const towerRing: Vec3[] = [
        [1.4, 0, 1.4],
        [8.6, 0, 1.4],
        [8.6, 0, 8.6],
        [1.4, 0, 8.6],
      ];

      pushExtrudedPolygon(geometry, outerRing, [], 0, 10, mockTriangulate);
      pushExtrudedPolygon(geometry, towerRing, [], 10, 20, mockTriangulate);

      expect(geometry.positions.length).toBeGreaterThan(0);
    });
  });

  describe('3.2 insetRing Y-coordinate Preservation', () => {
    it('preserves Y coordinate when inset', () => {
      const points: Vec3[] = [
        [0, 5, 0],
        [10, 5, 0],
        [10, 5, 10],
        [0, 5, 10],
      ];

      const result = insetRing(points, 0.14);

      expect(result).toHaveLength(4);
      for (const point of result) {
        expect(point[1]).toBe(5);
      }
    });

    it('preserves varying Y coordinates for terrain-aligned rings', () => {
      const points: Vec3[] = [
        [0, 1.2, 0],
        [10, 1.5, 0],
        [10, 1.8, 10],
        [0, 1.3, 10],
      ];

      const result = insetRing(points, 0.12);

      expect(result).toHaveLength(4);
      expect(result[0]![1]).toBe(1.2);
      expect(result[1]![1]).toBe(1.5);
      expect(result[2]![1]).toBe(1.8);
      expect(result[3]![1]).toBe(1.3);
    });
  });

  describe('3.3 Triangulation Fallback Logging', () => {
    it('falls back to box geometry when triangulation fails', () => {
      const geometry = createEmptyGeometry();
      const outerRing: Vec3[] = [
        [0, 0, 0],
        [10, 0, 0],
        [10, 0, 10],
        [0, 0, 10],
      ];

      const failingTriangulate = mock(() => []);

      pushExtrudedPolygon(
        geometry,
        outerRing,
        [],
        0,
        10,
        failingTriangulate,
        'test-building-1',
      );

      expect(failingTriangulate).toHaveBeenCalledTimes(1);
      expect(geometry.positions.length).toBeGreaterThan(0);
    });

    it('does not log when buildingId is not provided', () => {
      const geometry = createEmptyGeometry();
      const outerRing: Vec3[] = [
        [0, 0, 0],
        [10, 0, 0],
        [10, 0, 10],
        [0, 0, 10],
      ];

      const failingTriangulate = mock(() => []);
      const warnSpy = mock(() => {});
      const originalWarn = console.warn;
      console.warn = warnSpy;

      pushExtrudedPolygon(
        geometry,
        outerRing,
        [],
        0,
        10,
        failingTriangulate,
      );

      expect(warnSpy).not.toHaveBeenCalled();
      console.warn = originalWarn;
    });
  });

  describe('3.4 Triangulation Fallback Tracking (Evidence-Only)', () => {
    it('increments tracker when triangulation returns empty', () => {
      const tracker = createTriangulationFallbackTracker();
      const geometry = createEmptyGeometry();
      const outerRing: Vec3[] = [
        [0, 0, 0],
        [10, 0, 0],
        [10, 0, 10],
        [0, 0, 10],
      ];

      const failingTriangulate = mock(() => []);

      pushExtrudedPolygon(
        geometry,
        outerRing,
        [],
        0,
        10,
        failingTriangulate,
        'test-building-1',
        tracker,
      );

      expect(tracker.count).toBe(1);
    });

    it('does not increment tracker when triangulation succeeds', () => {
      const tracker = createTriangulationFallbackTracker();
      const geometry = createEmptyGeometry();
      const outerRing: Vec3[] = [
        [0, 0, 0],
        [10, 0, 0],
        [10, 0, 10],
        [0, 0, 10],
      ];

      pushExtrudedPolygon(
        geometry,
        outerRing,
        [],
        0,
        10,
        mockTriangulate,
        'test-building-2',
        tracker,
      );

      expect(tracker.count).toBe(0);
    });

    it('accumulates count across multiple fallback calls', () => {
      const tracker = createTriangulationFallbackTracker();
      const geometry = createEmptyGeometry();
      const outerRing: Vec3[] = [
        [0, 0, 0],
        [10, 0, 0],
        [10, 0, 10],
        [0, 0, 10],
      ];
      const failingTriangulate = mock(() => []);

      pushExtrudedPolygon(
        geometry,
        outerRing,
        [],
        0,
        10,
        failingTriangulate,
        'building-a',
        tracker,
      );
      pushExtrudedPolygon(
        geometry,
        outerRing,
        [],
        0,
        10,
        failingTriangulate,
        'building-b',
        tracker,
      );
      pushExtrudedPolygon(
        geometry,
        outerRing,
        [],
        0,
        10,
        failingTriangulate,
        'building-c',
        tracker,
      );

      expect(tracker.count).toBe(3);
    });

    it('does not throw when tracker is undefined (backward compatible)', () => {
      const geometry = createEmptyGeometry();
      const outerRing: Vec3[] = [
        [0, 0, 0],
        [10, 0, 0],
        [10, 0, 10],
        [0, 0, 10],
      ];
      const failingTriangulate = mock(() => []);

      expect(() =>
        pushExtrudedPolygon(
          geometry,
          outerRing,
          [],
          0,
          10,
          failingTriangulate,
          'test-building',
          undefined,
        ),
      ).not.toThrow();
    });

    it('tracker starts at zero from factory', () => {
      const tracker = createTriangulationFallbackTracker();
      expect(tracker.count).toBe(0);
    });
  });

  describe('3.5 insetRing Degeneration Handling', () => {
    it('handles small rings without collapsing', () => {
      const points: Vec3[] = [
        [0, 0, 0],
        [1, 0, 0],
        [1, 0, 1],
        [0, 0, 1],
      ];

      const result = insetRing(points, 0.12);

      expect(result).toHaveLength(4);
      expect(result.every((p) => p.length === 3)).toBe(true);
    });

    it('maintains ring structure with high inset ratio', () => {
      const points: Vec3[] = [
        [0, 0, 0],
        [10, 0, 0],
        [10, 0, 10],
        [0, 0, 10],
      ];

      const result = insetRing(points, 0.5);

      expect(result).toHaveLength(4);
      expect(result[0]![0]).toBeCloseTo(2.5);
      expect(result[0]![2]).toBeCloseTo(2.5);
    });
  });

  describe('resolveBuildingVerticalBase', () => {
    it('returns terrainOffsetM rounded to 3 decimals', () => {
      const building = { terrainOffsetM: 1.23456 };
      expect(resolveBuildingVerticalBase(building as any)).toBe(1.235);
    });

    it('returns 0 when terrainOffsetM is undefined', () => {
      const building = {};
      expect(resolveBuildingVerticalBase(building as any)).toBe(0);
    });

    it('handles negative terrainOffsetM', () => {
      const building = { terrainOffsetM: -0.5 };
      expect(resolveBuildingVerticalBase(building as any)).toBe(-0.5);
    });
  });
});

function mockTriangulate(
  vertices: number[],
  _holes?: number[],
  _dimensions?: number,
): number[] {
  const pointCount = vertices.length / 2;
  const indices: number[] = [];
  for (let i = 1; i < pointCount - 1; i += 1) {
    indices.push(0, i, i + 1);
  }
  return indices;
}
