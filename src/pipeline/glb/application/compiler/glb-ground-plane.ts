import type { TypedArray } from '@gltf-transform/core';
import type { Buffer, Document } from '@gltf-transform/core';

import type { MeshPlan } from '../../../../shared/contracts';

/**
 * DEM-sampled ground surface. Heights are relative to the scene-centre
 * elevation (same datum as building baseY and road vertex Y), so the grid
 * lines up with every other entity. Grid spans [-halfSize, halfSize] on x/z.
 */
export type GroundHeightfield = {
  halfSize: number;
  cols: number;
  rows: number;
  heights: number[];
  /** Optional satellite aerial image draped over the grid (baseColorTexture). */
  texture?: { bytes: Uint8Array; mimeType: string };
};

export function estimateSceneBaseY(meshPlan: MeshPlan): number {
  let minY = 0;
  for (const node of meshPlan.nodes) {
    const geometry = node.geometry;
    if (!geometry) continue;

    if (geometry.kind === 'building') {
      minY = Math.min(minY, geometry.baseY ?? 0);
      continue;
    }

    if (geometry.kind === 'road' || geometry.kind === 'walkway') {
      for (const point of geometry.centerline) {
        minY = Math.min(minY, point.y);
      }
      continue;
    }

    if (geometry.kind === 'terrain') {
      for (const point of geometry.samples) {
        minY = Math.min(minY, point.y);
      }
    }
  }

  return minY;
}

export function addGroundPlane(
  document: Document,
  buffer: Buffer,
  radius: number,
  y = -0.05,
  heightfield?: GroundHeightfield,
): ReturnType<Document['createNode']> {
  if (heightfield !== undefined && heightfield.cols >= 2 && heightfield.rows >= 2) {
    return addGroundGrid(document, buffer, heightfield, y);
  }

  const positions = new Float32Array([
    -radius, y, -radius,
    radius, y, -radius,
    radius, y, radius,
    -radius, y, -radius,
    radius, y, radius,
    -radius, y, radius,
  ]);
  const normals = new Float32Array([
    0, 1, 0, 0, 1, 0, 0, 1, 0,
    0, 1, 0, 0, 1, 0, 0, 1, 0,
  ]);
  const indices = new Uint16Array([0, 1, 2, 3, 4, 5]);
  const texcoords = new Float32Array([
    0, 0, 1, 0, 1, 1,
    0, 0, 1, 1, 0, 1,
  ]);

  const posAcc = document.createAccessor('ground-pos').setArray(positions as TypedArray).setType('VEC3').setBuffer(buffer);
  const normAcc = document.createAccessor('ground-norm').setArray(normals as TypedArray).setType('VEC3').setBuffer(buffer);
  const idxAcc = document.createAccessor('ground-idx').setArray(indices).setType('SCALAR').setBuffer(buffer);
  const uvAcc = document.createAccessor('ground-uv').setArray(texcoords as TypedArray).setType('VEC2').setBuffer(buffer);

  const material = document.createMaterial('ground');
  material.setBaseColorFactor([0.08, 0.08, 0.09, 1.0]);
  material.setMetallicFactor(0.0);
  material.setRoughnessFactor(0.95);

  const primitive = document.createPrimitive();
  primitive.setAttribute('POSITION', posAcc);
  primitive.setAttribute('NORMAL', normAcc);
  primitive.setIndices(idxAcc);
  primitive.setAttribute('TEXCOORD_0', uvAcc);
  primitive.setMaterial(material);
  primitive.setMode(4);

  const mesh = document.createMesh('ground-plane');
  mesh.addPrimitive(primitive);

  const node = document.createNode('ground-plane');
  node.setMesh(mesh);
  return node;
}

/** DEM-sampled subdivided ground grid. Per-vertex height + gradient normals. */
function addGroundGrid(
  document: Document,
  buffer: Buffer,
  hf: GroundHeightfield,
  yOffset: number,
): ReturnType<Document['createNode']> {
  const { halfSize, cols, rows, heights } = hf;
  const span = halfSize * 2;
  const cell = span / (cols - 1);
  const cellZ = span / (rows - 1);
  const vertCount = cols * rows;

  const positions = new Float32Array(vertCount * 3);
  const normals = new Float32Array(vertCount * 3);
  const texcoords = new Float32Array(vertCount * 2);

  const h = (r: number, c: number): number => {
    const rc = Math.min(rows - 1, Math.max(0, r));
    const cc = Math.min(cols - 1, Math.max(0, c));
    return heights[rc * cols + cc] ?? 0;
  };

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      const x = -halfSize + cell * c;
      const z = -halfSize + cellZ * r;
      positions[i * 3] = x;
      positions[i * 3 + 1] = h(r, c) + yOffset;
      positions[i * 3 + 2] = z;

      // Gradient normal from central differences (upward-facing).
      const dhdx = (h(r, c + 1) - h(r, c - 1)) / (2 * cell);
      const dhdz = (h(r + 1, c) - h(r - 1, c)) / (2 * cellZ);
      const nx = -dhdx;
      const ny = 1;
      const nz = -dhdz;
      const len = Math.hypot(nx, ny, nz) || 1;
      normals[i * 3] = nx / len;
      normals[i * 3 + 1] = ny / len;
      normals[i * 3 + 2] = nz / len;

      // V flipped: grid row 0 = south edge = bottom of the satellite image.
      texcoords[i * 2] = c / (cols - 1);
      texcoords[i * 2 + 1] = 1 - r / (rows - 1);
    }
  }

  const indices = new Uint16Array((cols - 1) * (rows - 1) * 6);
  let k = 0;
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const a = r * cols + c;
      const b = r * cols + c + 1;
      const d = (r + 1) * cols + c;
      const e = (r + 1) * cols + c + 1;
      // CCW from +Y so normals face up.
      indices[k++] = a;
      indices[k++] = d;
      indices[k++] = b;
      indices[k++] = b;
      indices[k++] = d;
      indices[k++] = e;
    }
  }

  const posAcc = document.createAccessor('ground-pos').setArray(positions as TypedArray).setType('VEC3').setBuffer(buffer);
  const normAcc = document.createAccessor('ground-norm').setArray(normals as TypedArray).setType('VEC3').setBuffer(buffer);
  const idxAcc = document.createAccessor('ground-idx').setArray(indices).setType('SCALAR').setBuffer(buffer);
  const uvAcc = document.createAccessor('ground-uv').setArray(texcoords as TypedArray).setType('VEC2').setBuffer(buffer);

  const material = document.createMaterial('ground');
  material.setMetallicFactor(0.0);
  material.setRoughnessFactor(0.95);
  if (hf.texture !== undefined) {
    const texture = document
      .createTexture('ground-satellite')
      .setImage(hf.texture.bytes)
      .setMimeType(hf.texture.mimeType);
    material.setBaseColorTexture(texture);
    material.setBaseColorFactor([1.0, 1.0, 1.0, 1.0]);
  } else {
    material.setBaseColorFactor([0.08, 0.08, 0.09, 1.0]);
  }

  const primitive = document.createPrimitive();
  primitive.setAttribute('POSITION', posAcc);
  primitive.setAttribute('NORMAL', normAcc);
  primitive.setIndices(idxAcc);
  primitive.setAttribute('TEXCOORD_0', uvAcc);
  primitive.setMaterial(material);
  primitive.setMode(4);

  const mesh = document.createMesh('ground-plane');
  mesh.addPrimitive(primitive);

  const node = document.createNode('ground-plane');
  node.setMesh(mesh);
  return node;
}
