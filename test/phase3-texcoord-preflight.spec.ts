import { describe, expect, it } from 'bun:test';
import { Document, Accessor } from '@gltf-transform/core';
import {
  runTexcoordPreflight,
  formatTexcoordPreflightError,
  type TexcoordPreflightReport,
} from '../src/assets/internal/glb-build/glb-build-texcoord-preflight';

/**
 * Phase 3 Unit 2 — Texture Compatibility Preflight Tests
 *
 * Verifies that the preflight:
 * 1. Detects textured materials (actual bound textures, not config intent)
 * 2. Fails closed when textured primitives lack TEXCOORD_0
 * 3. Passes when untextured primitives lack TEXCOORD_0 (no issue)
 * 4. Passes when textured primitives have TEXCOORD_0
 */
describe('Phase 3 Unit 2 — Texture Compatibility Preflight', () => {
  describe('runTexcoordPreflight', () => {
    it('returns valid=true for empty document (no meshes)', () => {
      const doc = createMockDocument({ meshes: [], materials: [] });
      const report = runTexcoordPreflight(doc);
      expect(report.valid).toBe(true);
      expect(report.issues).toEqual([]);
    });

    it('returns valid=true for untextured primitive without TEXCOORD_0', () => {
      const untexturedMat = createMockMaterial('plain-material');
      const prim = createMockPrimitive(untexturedMat, { hasTexcoord: false });
      const mesh = createMockMesh('plain-mesh', [prim]);
      const doc = createMockDocument({ meshes: [mesh], materials: [untexturedMat] });

      const report = runTexcoordPreflight(doc);
      expect(report.valid).toBe(true);
      expect(report.issues).toEqual([]);
    });

    it('returns valid=true for textured primitive WITH TEXCOORD_0', () => {
      const texturedMat = createMockMaterial('textured-material', { hasBaseColorTexture: true });
      const prim = createMockPrimitive(texturedMat, { hasTexcoord: true });
      const mesh = createMockMesh('textured-mesh', [prim]);
      const doc = createMockDocument({ meshes: [mesh], materials: [texturedMat] });

      const report = runTexcoordPreflight(doc);
      expect(report.valid).toBe(true);
      expect(report.issues).toEqual([]);
    });

    it('fails closed: textured primitive WITHOUT TEXCOORD_0', () => {
      const texturedMat = createMockMaterial('textured-material', { hasBaseColorTexture: true });
      const prim = createMockPrimitive(texturedMat, { hasTexcoord: false });
      const mesh = createMockMesh('textured-mesh', [prim]);
      const doc = createMockDocument({ meshes: [mesh], materials: [texturedMat] });

      const report = runTexcoordPreflight(doc);
      expect(report.valid).toBe(false);
      expect(report.issues).toHaveLength(1);
      expect(report.issues[0]).toEqual({
        meshName: 'textured-mesh',
        materialName: 'textured-material',
        missingAttribute: 'TEXCOORD_0',
      });
    });

    it('detects multiple textured primitives missing TEXCOORD_0', () => {
      const texMat1 = createMockMaterial('tex-mat-1', { hasBaseColorTexture: true });
      const texMat2 = createMockMaterial('tex-mat-2', { hasBaseColorTexture: true });
      const prim1 = createMockPrimitive(texMat1, { hasTexcoord: false });
      const prim2 = createMockPrimitive(texMat2, { hasTexcoord: false });
      const mesh1 = createMockMesh('mesh-1', [prim1]);
      const mesh2 = createMockMesh('mesh-2', [prim2]);
      const doc = createMockDocument({
        meshes: [mesh1, mesh2],
        materials: [texMat1, texMat2],
      });

      const report = runTexcoordPreflight(doc);
      expect(report.valid).toBe(false);
      expect(report.issues).toHaveLength(2);
    });

    it('mixed: textured+TEXCOORD passes, textured-no-TEXCOORD fails', () => {
      const texMatGood = createMockMaterial('tex-good', { hasBaseColorTexture: true });
      const texMatBad = createMockMaterial('tex-bad', { hasBaseColorTexture: true });
      const primGood = createMockPrimitive(texMatGood, { hasTexcoord: true });
      const primBad = createMockPrimitive(texMatBad, { hasTexcoord: false });
      const mesh = createMockMesh('mixed-mesh', [primGood, primBad]);
      const doc = createMockDocument({
        meshes: [mesh],
        materials: [texMatGood, texMatBad],
      });

      const report = runTexcoordPreflight(doc);
      expect(report.valid).toBe(false);
      expect(report.issues).toHaveLength(1);
      expect(report.issues[0]!.materialName).toBe('tex-bad');
    });

    it('handles document without getRoot gracefully', () => {
      const doc = {};
      const report = runTexcoordPreflight(doc);
      expect(report.valid).toBe(true);
    });

    it('handles material without getBaseColorTexture (not textured)', () => {
      const mat = createMockMaterial('no-texture-method');
      // No getBaseColorTexture → not considered textured
      const prim = createMockPrimitive(mat, { hasTexcoord: false });
      const mesh = createMockMesh('no-method-mesh', [prim]);
      const doc = createMockDocument({ meshes: [mesh], materials: [mat] });

      const report = runTexcoordPreflight(doc);
      expect(report.valid).toBe(true);
    });

    it('handles primitive without getAttribute (treated as no TEXCOORD_0)', () => {
      const texMat = createMockMaterial('tex-mat', { hasBaseColorTexture: true });
      const prim = createMockPrimitive(texMat, { hasTexcoord: false, noGetAttribute: true });
      const mesh = createMockMesh('no-attr-mesh', [prim]);
      const doc = createMockDocument({ meshes: [mesh], materials: [texMat] });

      const report = runTexcoordPreflight(doc);
      expect(report.valid).toBe(false);
      expect(report.issues).toHaveLength(1);
    });

    it('fails closed when inspection itself throws — sets inspectionFailed sentinel', () => {
      // Simulate a document whose getRoot throws unexpectedly.
      const doc = {
        getRoot: () => {
          throw new Error('unexpected internal error');
        },
      };

      const report = runTexcoordPreflight(doc);
      expect(report.valid).toBe(false);
      expect(report.issues).toHaveLength(1);
      expect(report.issues[0]!.inspectionFailed).toBe(true);
      expect(report.issues[0]!.meshName).toBe('preflight');
      expect(report.issues[0]!.materialName).toBe('preflight');
    });
  });

  describe('runTexcoordPreflight with real @gltf-transform/core Document', () => {
    it('does NOT throw on a real gltf-transform Document with untextured material', async () => {
      const doc = new Document();
      const buffer = doc.createBuffer('test-buffer');
      const material = doc.createMaterial('plain-material');
      const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
      const prim = doc.createPrimitive()
        .setMaterial(material)
        .setAttribute('POSITION', doc.createAccessor().setArray(positions).setType(Accessor.Type.VEC3!));
      const mesh = doc.createMesh('test-mesh').addPrimitive(prim);
      doc.createScene('test-scene').addChild(doc.createNode('test-node').setMesh(mesh));

      // This previously threw due to `this` binding loss on getBaseColorTexture.
      const report = runTexcoordPreflight(doc);
      expect(report.valid).toBe(true);
      expect(report.issues).toEqual([]);
    });

    it('does NOT throw on a real gltf-transform Document with textured material + TEXCOORD_0', async () => {
      const doc = new Document();
      const texture = doc.createTexture('test-texture').setURI('test.png').setMimeType('image/png');
      const material = doc.createMaterial('textured-material').setBaseColorTexture(texture);
      const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
      const uvs = new Float32Array([0, 0, 1, 0, 0, 1]);
      const prim = doc.createPrimitive()
        .setMaterial(material)
        .setAttribute('POSITION', doc.createAccessor().setArray(positions).setType(Accessor.Type.VEC3!))
        .setAttribute('TEXCOORD_0', doc.createAccessor().setArray(uvs).setType(Accessor.Type.VEC2!));
      const mesh = doc.createMesh('textured-mesh').addPrimitive(prim);
      doc.createScene('test-scene').addChild(doc.createNode('test-node').setMesh(mesh));

      const report = runTexcoordPreflight(doc);
      expect(report.valid).toBe(true);
      expect(report.issues).toEqual([]);
    });

    it('fails closed: textured material WITHOUT TEXCOORD_0 on real Document', async () => {
      const doc = new Document();
      const texture = doc.createTexture('test-texture').setURI('test.png').setMimeType('image/png');
      const material = doc.createMaterial('textured-material').setBaseColorTexture(texture);
      const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
      const prim = doc.createPrimitive()
        .setMaterial(material)
        .setAttribute('POSITION', doc.createAccessor().setArray(positions).setType(Accessor.Type.VEC3!));
      const mesh = doc.createMesh('textured-mesh').addPrimitive(prim);
      doc.createScene('test-scene').addChild(doc.createNode('test-node').setMesh(mesh));

      const report = runTexcoordPreflight(doc);
      expect(report.valid).toBe(false);
      expect(report.issues).toHaveLength(1);
      expect(report.issues[0]!.meshName).toBe('textured-mesh');
      expect(report.issues[0]!.materialName).toBe('textured-material');
      expect(report.issues[0]!.missingAttribute).toBe('TEXCOORD_0');
      expect(report.issues[0]!.inspectionFailed).toBeUndefined();
    });

    it('handles primitive with no material on real Document', async () => {
      const doc = new Document();
      const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
      const prim = doc.createPrimitive()
        .setAttribute('POSITION', doc.createAccessor().setArray(positions).setType(Accessor.Type.VEC3!));
      // No material set
      const mesh = doc.createMesh('no-mat-mesh').addPrimitive(prim);
      doc.createScene('test-scene').addChild(doc.createNode('test-node').setMesh(mesh));

      const report = runTexcoordPreflight(doc);
      expect(report.valid).toBe(true);
      expect(report.issues).toEqual([]);
    });

    it('handles multiple meshes with mixed materials on real Document', async () => {
      const doc = new Document();
      const texture = doc.createTexture('test-texture').setURI('test.png').setMimeType('image/png');
      const texturedMat = doc.createMaterial('textured-mat').setBaseColorTexture(texture);
      const plainMat = doc.createMaterial('plain-mat');

      const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);

      // Textured mesh WITH TEXCOORD_0 → passes
      const uvs = new Float32Array([0, 0, 1, 0, 0, 1]);
      const texturedPrim = doc.createPrimitive()
        .setMaterial(texturedMat)
        .setAttribute('POSITION', doc.createAccessor().setArray(positions).setType(Accessor.Type.VEC3!))
        .setAttribute('TEXCOORD_0', doc.createAccessor().setArray(uvs).setType(Accessor.Type.VEC2!));
      const texturedMesh = doc.createMesh('textured-mesh').addPrimitive(texturedPrim);

      // Plain mesh without TEXCOORD_0 → passes (no texture)
      const plainPrim = doc.createPrimitive()
        .setMaterial(plainMat)
        .setAttribute('POSITION', doc.createAccessor().setArray(positions).setType(Accessor.Type.VEC3!));
      const plainMesh = doc.createMesh('plain-mesh').addPrimitive(plainPrim);

      doc.createScene('test-scene')
        .addChild(doc.createNode('node1').setMesh(texturedMesh))
        .addChild(doc.createNode('node2').setMesh(plainMesh));

      const report = runTexcoordPreflight(doc);
      expect(report.valid).toBe(true);
      expect(report.issues).toEqual([]);
    });
  });

  describe('formatTexcoordPreflightError', () => {
    it('formats single issue', () => {
      const report: TexcoordPreflightReport = {
        valid: false,
        issues: [{ meshName: 'm1', materialName: 'mat1', missingAttribute: 'TEXCOORD_0' }],
      };
      const msg = formatTexcoordPreflightError(report);
      expect(msg).toContain('1 textured primitive(s)');
      expect(msg).toContain('mesh="m1"');
      expect(msg).toContain('material="mat1"');
    });

    it('formats multiple issues', () => {
      const report: TexcoordPreflightReport = {
        valid: false,
        issues: [
          { meshName: 'm1', materialName: 'mat1', missingAttribute: 'TEXCOORD_0' },
          { meshName: 'm2', materialName: 'mat2', missingAttribute: 'TEXCOORD_0' },
        ],
      };
      const msg = formatTexcoordPreflightError(report);
      expect(msg).toContain('2 textured primitive(s)');
      expect(msg).toContain('mesh="m1"');
      expect(msg).toContain('mesh="m2"');
    });

    it('formats inspection-failure report with distinct non-misleading message', () => {
      const report: TexcoordPreflightReport = {
        valid: false,
        issues: [
          { meshName: 'preflight', materialName: 'preflight', missingAttribute: 'TEXCOORD_0', inspectionFailed: true },
        ],
      };
      const msg = formatTexcoordPreflightError(report);
      // Must NOT read like a genuine missing-TEXCOORD diagnosis.
      expect(msg).not.toContain('textured primitive(s)');
      // Must explicitly signal that the inspection itself failed.
      expect(msg).toContain('inspection failed unexpectedly');
      expect(msg).toContain('failing closed');
      expect(msg).toContain('NOT a confirmed missing-TEXCOORD_0 issue');
    });
  });
});

// --- Mock helpers ---

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
