import type { TypedArray } from '@gltf-transform/core';
import type { Accessor, Buffer, Document } from '@gltf-transform/core';

import type { MeshPlanNode } from '../../../../shared/contracts';

export function createIndices(document: Document, buffer: Buffer, positions: Accessor, _type: string) {
  const count = positions.getCount();

  const indices = count > 65535 ? new Uint32Array(count) : new Uint16Array(count);
  for (let i = 0; i < count; i++) {
    indices[i] = i;
  }

  return document.createAccessor('indices').setArray(indices).setType('SCALAR').setBuffer(buffer);
}

export function createNormals(
  document: Document,
  buffer: Buffer,
  positionsAccessor: Accessor,
  indicesAccessor: Accessor,
): Accessor {
  const positionsArray = positionsAccessor.getArray();
  const indicesArray = indicesAccessor.getArray();

  if (positionsArray === null || indicesArray === null) {
    return document.createAccessor('normals').setArray(new Float32Array(0) as TypedArray).setType('VEC3').setBuffer(buffer);
  }

  const vertexCount = positionsAccessor.getCount();
  const normals = new Float32Array(vertexCount * 3);

  for (let i = 0; i + 2 < indicesArray.length; i += 3) {
    const ia = Number(indicesArray[i]) * 3;
    const ib = Number(indicesArray[i + 1]) * 3;
    const ic = Number(indicesArray[i + 2]) * 3;

    const ax = Number(positionsArray[ia]);
    const ay = Number(positionsArray[ia + 1]);
    const az = Number(positionsArray[ia + 2]);
    const bx = Number(positionsArray[ib]);
    const by = Number(positionsArray[ib + 1]);
    const bz = Number(positionsArray[ib + 2]);
    const cx = Number(positionsArray[ic]);
    const cy = Number(positionsArray[ic + 1]);
    const cz = Number(positionsArray[ic + 2]);

    const ux = bx - ax;
    const uy = by - ay;
    const uz = bz - az;
    const vx = cx - ax;
    const vy = cy - ay;
    const vz = cz - az;

    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;

    normals[ia] = (normals[ia] ?? 0) + nx;
    normals[ia + 1] = (normals[ia + 1] ?? 0) + ny;
    normals[ia + 2] = (normals[ia + 2] ?? 0) + nz;
    normals[ib] = (normals[ib] ?? 0) + nx;
    normals[ib + 1] = (normals[ib + 1] ?? 0) + ny;
    normals[ib + 2] = (normals[ib + 2] ?? 0) + nz;
    normals[ic] = (normals[ic] ?? 0) + nx;
    normals[ic + 1] = (normals[ic + 1] ?? 0) + ny;
    normals[ic + 2] = (normals[ic + 2] ?? 0) + nz;
  }

  for (let i = 0; i < vertexCount; i++) {
    const offset = i * 3;
    const nx = normals[offset] ?? 0;
    const ny = normals[offset + 1] ?? 0;
    const nz = normals[offset + 2] ?? 0;
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz);

    if (len > 1e-9) {
      normals[offset] = nx / len;
      normals[offset + 1] = ny / len;
      normals[offset + 2] = nz / len;
    } else {
      normals[offset] = 0;
      normals[offset + 1] = 1;
      normals[offset + 2] = 0;
    }
  }

  return document.createAccessor('normals').setArray(normals as TypedArray).setType('VEC3').setBuffer(buffer);
}

/**
 * Per-window vertex colors (COLOR_0) to break the uniform procedural grid.
 * Each quad (6 verts) gets one deterministic colour hashed from its centroid:
 * a minority of warm "lit" panes, the rest cool dark glass with slight variance.
 * Material baseColorFactor is white so COLOR_0 carries the full hue.
 */
export function createWindowColors(document: Document, buffer: Buffer, positions: Accessor): Accessor {
  const arr = positions.getArray();
  const count = positions.getCount();

  if (arr === null || count === 0) {
    return document.createAccessor('window-colors').setArray(new Float32Array(0) as TypedArray).setType('VEC4').setBuffer(buffer);
  }

  const colors = new Float32Array(count * 4);
  const quads = Math.floor(count / 6);

  for (let q = 0; q < quads; q++) {
    const base = q * 6;
    const cx = Number(arr[base * 3]);
    const cy = Number(arr[base * 3 + 1]);
    const cz = Number(arr[base * 3 + 2]);

    const raw = Math.sin(cx * 12.9898 + cy * 78.233 + cz * 37.719) * 43758.5453;
    const rnd = raw - Math.floor(raw);

    let r: number;
    let g: number;
    let b: number;
    if (rnd < 0.28) {
      const k = 0.7 + (rnd / 0.28) * 0.3;
      r = 1.0 * k;
      g = 0.86 * k;
      b = 0.6 * k;
    } else {
      const v = 0.06 + (rnd - 0.28) * 0.12;
      r = v * 0.7;
      g = v * 0.95;
      b = v * 1.3;
    }

    for (let i = 0; i < 6; i++) {
      const o = (base + i) * 4;
      colors[o] = r;
      colors[o + 1] = g;
      colors[o + 2] = b;
      colors[o + 3] = 1;
    }
  }

  return document.createAccessor('window-colors').setArray(colors as TypedArray).setType('VEC4').setBuffer(buffer);
}

/**
 * Two-tone tree vertex colors (COLOR_0): lower third = brown trunk, upper = green
 * canopy, split by relative Y within the mesh. Material baseColorFactor is white.
 */
export function createTreeColors(document: Document, buffer: Buffer, positions: Accessor): Accessor {
  const arr = positions.getArray();
  const count = positions.getCount();

  if (arr === null || count === 0) {
    return document.createAccessor('tree-colors').setArray(new Float32Array(0) as TypedArray).setType('VEC4').setBuffer(buffer);
  }

  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < count; i++) {
    const yv = Number(arr[i * 3 + 1]);
    if (yv < minY) minY = yv;
    if (yv > maxY) maxY = yv;
  }
  const split = minY + (maxY - minY) * 0.32;

  const colors = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    const yv = Number(arr[i * 3 + 1]);
    const o = i * 4;
    if (yv < split) {
      colors[o] = 0.36;
      colors[o + 1] = 0.24;
      colors[o + 2] = 0.13;
    } else {
      const t = maxY > split ? (yv - split) / (maxY - split) : 0;
      colors[o] = 0.16 + t * 0.10;
      colors[o + 1] = 0.40 + t * 0.18;
      colors[o + 2] = 0.13 + t * 0.06;
    }
    colors[o + 3] = 1;
  }

  return document.createAccessor('tree-colors').setArray(colors as TypedArray).setType('VEC4').setBuffer(buffer);
}

/**
 * Fake ambient occlusion for building walls via COLOR_0: a vertical gradient
 * that darkens the lower ~6 m (ground contact) and fades to full brightness
 * higher up. Multiplies the per-building baseColorFactor, grounding the massing.
 */
export function createBuildingAO(document: Document, buffer: Buffer, positions: Accessor): Accessor {
  const arr = positions.getArray();
  const count = positions.getCount();

  if (arr === null || count === 0) {
    return document.createAccessor('building-ao').setArray(new Float32Array(0) as TypedArray).setType('VEC4').setBuffer(buffer);
  }

  let minY = Infinity;
  for (let i = 0; i < count; i++) {
    const yv = Number(arr[i * 3 + 1]);
    if (yv < minY) minY = yv;
  }

  const AO_HEIGHT = 6;
  const AO_FLOOR = 0.55;

  const colors = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    const yv = Number(arr[i * 3 + 1]);
    const t = Math.min(1, Math.max(0, (yv - minY) / AO_HEIGHT));
    const ao = AO_FLOOR + (1 - AO_FLOOR) * t;
    const o = i * 4;
    colors[o] = ao;
    colors[o + 1] = ao;
    colors[o + 2] = ao;
    colors[o + 3] = 1;
  }

  return document.createAccessor('building-ao').setArray(colors as TypedArray).setType('VEC4').setBuffer(buffer);
}

export function createTexcoords(
  document: Document,
  buffer: Buffer,
  positionsAccessor: Accessor,
  _primitive: MeshPlanNode['primitive'],
): Accessor {
  const positionsArray = positionsAccessor.getArray();
  const vertexCount = positionsAccessor.getCount();

  if (positionsArray === null || vertexCount === 0) {
    return document.createAccessor('texcoords').setArray(new Float32Array(0) as TypedArray).setType('VEC2').setBuffer(buffer);
  }

  const texcoords = new Float32Array(vertexCount * 2);

  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  for (let i = 0; i < vertexCount; i++) {
    const x = Number(positionsArray[i * 3]);
    const z = Number(positionsArray[i * 3 + 2]);
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }

  const spanX = Math.max(1e-6, maxX - minX);
  const spanZ = Math.max(1e-6, maxZ - minZ);

  for (let i = 0; i < vertexCount; i++) {
    const x = Number(positionsArray[i * 3]);
    const z = Number(positionsArray[i * 3 + 2]);
    texcoords[i * 2] = (x - minX) / spanX;
    texcoords[i * 2 + 1] = (z - minZ) / spanZ;
  }

  return document.createAccessor('texcoords').setArray(texcoords as TypedArray).setType('VEC2').setBuffer(buffer);
}
