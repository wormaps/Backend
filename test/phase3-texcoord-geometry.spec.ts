import { describe, expect, it, mock } from 'bun:test';
import { createEmptyGeometry } from '../src/assets/compiler/road/road-mesh.types';
import { mergeGeometryBuffers } from '../src/assets/compiler/road/road-mesh.types';
import { pushTriangle, pushQuad, pushBox } from '../src/assets/internal/glb-build/geometry/glb-build-geometry-primitives.utils';
import { pushBox as pushBoxShared } from '../src/assets/compiler/geometry/primitives/box.utils';
import { pushBox as pushBoxSF } from '../src/assets/compiler/street-furniture/street-furniture-mesh.geometry.utils';
import { pushTriangle as pushTriangleRoad } from '../src/assets/compiler/road/road-mesh.geometry.utils';
import { pushTriangle as pushTriangleBuilding } from '../src/assets/compiler/building/building-mesh.geometry-primitives';
import { pushTriangle as pushTriangleVegetation } from '../src/assets/compiler/vegetation/vegetation-mesh-geometry.utils';
import { isGeometryValid } from '../src/assets/internal/glb-build/glb-build-mesh-node';

describe('Phase 3 Unit 1 — TEXCOORD_0 Geometry Plumbing', () => {
  describe('GeometryBuffers type carries uvs', () => {
    it('createEmptyGeometry initializes uvs array', () => {
      const geo = createEmptyGeometry();
      expect(geo.uvs).toBeDefined();
      expect(geo.uvs).toEqual([]);
    });

    it('mergeGeometryBuffers carries uvs from source buffers', () => {
      const a = createEmptyGeometry();
      a.positions.push(0, 0, 0, 1, 0, 0, 0.5, 1, 0);
      a.normals.push(0, 1, 0, 0, 1, 0, 0, 1, 0);
      a.indices.push(0, 1, 2);
      a.uvs!.push(0, 0, 1, 0, 0.5, 1);

      const b = createEmptyGeometry();
      b.positions.push(2, 0, 0, 3, 0, 0, 2.5, 1, 0);
      b.normals.push(0, 1, 0, 0, 1, 0, 0, 1, 0);
      b.indices.push(0, 1, 2);
      b.uvs!.push(0, 0, 1, 0, 0.5, 1);

      const merged = mergeGeometryBuffers([a, b]);

      expect(merged.uvs).toBeDefined();
      expect(merged.uvs!.length).toBe(12);
      expect(merged.uvs).toEqual([0, 0, 1, 0, 0.5, 1, 0, 0, 1, 0, 0.5, 1]);
    });

    it('mergeGeometryBuffers handles buffers without uvs', () => {
      const a = createEmptyGeometry();
      a.positions.push(0, 0, 0);
      a.normals.push(0, 1, 0);
      a.indices.push(0);

      const b = createEmptyGeometry();
      b.positions.push(1, 0, 0);
      b.normals.push(0, 1, 0);
      b.indices.push(0);

      const merged = mergeGeometryBuffers([a, b]);
      expect(merged.uvs).toBeDefined();
      expect(merged.uvs!.length).toBe(0);
    });
  });

  describe('pushTriangle emits UVs (XZ planar projection)', () => {
    it('shared glb-build pushTriangle emits 6 UV values per triangle', () => {
      const geo = createEmptyGeometry();
      pushTriangle(geo, [0, 0, 0], [1, 0, 0], [0, 0, 1]);

      expect(geo.uvs!.length).toBe(6);
      expect(geo.uvs).toEqual([0, 0, 1, 0, 0, 1]);
    });

    it('road-mesh pushTriangle emits UVs', () => {
      const geo = createEmptyGeometry();
      pushTriangleRoad(geo, [2, 0, 3], [4, 0, 3], [2, 0, 5]);

      expect(geo.uvs!.length).toBe(6);
      expect(geo.uvs).toEqual([2, 3, 4, 3, 2, 5]);
    });

    it('building-mesh pushTriangle emits UVs', () => {
      const geo = createEmptyGeometry();
      pushTriangleBuilding(geo, [10, 5, 20], [12, 5, 20], [10, 5, 22]);

      expect(geo.uvs!.length).toBe(6);
      expect(geo.uvs).toEqual([10, 20, 12, 20, 10, 22]);
    });

    it('vegetation pushTriangle emits UVs', () => {
      const geo = createEmptyGeometry();
      pushTriangleVegetation(geo, [0, 0, 0], [1, 0, 0], [0, 0, 1]);

      expect(geo.uvs!.length).toBe(6);
      expect(geo.uvs).toEqual([0, 0, 1, 0, 0, 1]);
    });
  });

  describe('pushQuad emits UVs for both triangles', () => {
    it('shared glb-build pushQuad emits 12 UV values', () => {
      const geo = createEmptyGeometry();
      pushQuad(geo, [0, 0, 0], [2, 0, 0], [2, 0, 2], [0, 0, 2]);

      expect(geo.uvs!.length).toBe(12);
    });
  });

  describe('pushBox (fallback geometry) emits UVs', () => {
    it('shared box.utils pushBox emits UVs matching vertex count', () => {
      const geo = createEmptyGeometry();
      pushBoxShared(geo, [0, 0, 0], [4, 2, 3]);

      expect(geo.uvs).toBeDefined();
      expect(geo.positions.length).toBe(36 * 3);
      expect(geo.uvs!.length).toBe(geo.positions.length / 3 * 2);
    });

    it('street-furniture pushBox emits UVs for 8 vertices', () => {
      const geo = createEmptyGeometry();
      pushBoxSF(geo, [0, 0, 0], [4, 2, 3]);

      expect(geo.uvs).toBeDefined();
      expect(geo.positions.length).toBe(8 * 3);
      expect(geo.uvs!.length).toBe(16);
      expect(geo.uvs!.length).toBe(geo.positions.length / 3 * 2);
    });

    it('street-furniture box UVs are normalized to 0-1 within footprint', () => {
      const geo = createEmptyGeometry();
      pushBoxSF(geo, [10, 0, 20], [14, 2, 23]);

      const uvs = geo.uvs!;
      for (let i = 0; i < uvs.length; i += 2) {
        expect(uvs[i]!).toBeGreaterThanOrEqual(0);
        expect(uvs[i]!).toBeLessThanOrEqual(1);
        expect(uvs[i + 1]!).toBeGreaterThanOrEqual(0);
        expect(uvs[i + 1]!).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('isGeometryValid validates UV buffer shape', () => {
    it('accepts valid geometry with matching UVs', () => {
      const geo = createEmptyGeometry();
      geo.positions.push(0, 0, 0, 1, 0, 0, 0, 0, 1);
      geo.normals.push(0, 1, 0, 0, 1, 0, 0, 1, 0);
      geo.indices.push(0, 1, 2);
      geo.uvs!.push(0, 0, 1, 0, 0, 1);

      expect(() => isGeometryValid(geo)).not.toThrow();
    });

    it('rejects geometry with mismatched UV length', () => {
      const geo = createEmptyGeometry();
      geo.positions.push(0, 0, 0, 1, 0, 0, 0, 0, 1);
      geo.normals.push(0, 1, 0, 0, 1, 0, 0, 1, 0);
      geo.indices.push(0, 1, 2);
      geo.uvs!.push(0, 0, 1, 0);

      expect(() => isGeometryValid(geo)).toThrow('UV buffer length');
    });

    it('accepts geometry with empty uvs array', () => {
      const geo = createEmptyGeometry();
      geo.positions.push(0, 0, 0, 1, 0, 0, 0, 0, 1);
      geo.normals.push(0, 1, 0, 0, 1, 0, 0, 1, 0);
      geo.indices.push(0, 1, 2);

      expect(() => isGeometryValid(geo)).not.toThrow();
    });
  });

  describe('UV/position count invariant', () => {
    it('pushTriangle maintains uvs.length === positions.length / 3 * 2', () => {
      const geo = createEmptyGeometry();
      pushTriangle(geo, [0, 0, 0], [1, 0, 0], [0, 0, 1]);
      pushTriangle(geo, [1, 0, 0], [1, 0, 1], [0, 0, 1]);

      expect(geo.uvs!.length).toBe(geo.positions.length / 3 * 2);
    });

    it('pushQuad maintains uvs.length === positions.length / 3 * 2', () => {
      const geo = createEmptyGeometry();
      pushQuad(geo, [0, 0, 0], [2, 0, 0], [2, 0, 2], [0, 0, 2]);

      expect(geo.uvs!.length).toBe(geo.positions.length / 3 * 2);
    });

    it('pushBox maintains uvs.length === positions.length / 3 * 2', () => {
      const geo = createEmptyGeometry();
      pushBox(geo, [0, 0, 0], [1, 1, 1]);

      expect(geo.uvs!.length).toBe(geo.positions.length / 3 * 2);
    });
  });
});
