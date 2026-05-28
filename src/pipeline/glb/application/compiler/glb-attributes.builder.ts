import type { TypedArray } from '@gltf-transform/core';
import type { Accessor, Buffer, Document } from '@gltf-transform/core';

import type { MeshPlanNode } from '../../../../shared/contracts';

export function createIndices(document: Document, buffer: Buffer, positions: Accessor, type: string) {
  const count = positions.getCount();

  if (type === 'road' || type === 'walkway') {
    const pairCount = Math.floor(count / 2);
    if (pairCount < 2) {
      return document.createAccessor('indices').setArray(new Uint16Array(0)).setType('SCALAR').setBuffer(buffer);
    }

    const triCount = (pairCount - 1) * 2;
    const indexCount = triCount * 3;
    const indices = indexCount > 65535 ? new Uint32Array(indexCount) : new Uint16Array(indexCount);
    let idx = 0;
    for (let i = 0; i < pairCount - 1; i++) {
      const a = 2 * i;
      const b = 2 * i + 1;
      const c = 2 * i + 2;
      const d = 2 * i + 3;
      indices[idx++] = a;
      indices[idx++] = c;
      indices[idx++] = d;
      indices[idx++] = a;
      indices[idx++] = d;
      indices[idx++] = b;
    }

    return document.createAccessor('indices').setArray(indices).setType('SCALAR').setBuffer(buffer);
  }

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

export function createTexcoords(
  document: Document,
  buffer: Buffer,
  positionsAccessor: Accessor,
  primitive: MeshPlanNode['primitive'],
): Accessor {
  const positionsArray = positionsAccessor.getArray();
  const vertexCount = positionsAccessor.getCount();

  if (positionsArray === null || vertexCount === 0) {
    return document.createAccessor('texcoords').setArray(new Float32Array(0) as TypedArray).setType('VEC2').setBuffer(buffer);
  }

  const texcoords = new Float32Array(vertexCount * 2);

  if (primitive === 'road' || primitive === 'walkway') {
    const pairCount = Math.floor(vertexCount / 2);
    let cumulative = 0;
    const repeatPerMeter = 0.25;

    for (let i = 0; i < pairCount; i++) {
      if (i > 0) {
        const prev = i - 1;
        const prevCx = (Number(positionsArray[prev * 6]) + Number(positionsArray[prev * 6 + 3])) * 0.5;
        const prevCy = (Number(positionsArray[prev * 6 + 1]) + Number(positionsArray[prev * 6 + 4])) * 0.5;
        const prevCz = (Number(positionsArray[prev * 6 + 2]) + Number(positionsArray[prev * 6 + 5])) * 0.5;
        const cx = (Number(positionsArray[i * 6]) + Number(positionsArray[i * 6 + 3])) * 0.5;
        const cy = (Number(positionsArray[i * 6 + 1]) + Number(positionsArray[i * 6 + 4])) * 0.5;
        const cz = (Number(positionsArray[i * 6 + 2]) + Number(positionsArray[i * 6 + 5])) * 0.5;
        const dx = cx - prevCx;
        const dy = cy - prevCy;
        const dz = cz - prevCz;
        cumulative += Math.sqrt(dx * dx + dy * dy + dz * dz);
      }

      const v = cumulative * repeatPerMeter;
      texcoords[i * 4] = 0;
      texcoords[i * 4 + 1] = v;
      texcoords[i * 4 + 2] = 1;
      texcoords[i * 4 + 3] = v;
    }
  } else {
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
  }

  return document.createAccessor('texcoords').setArray(texcoords as TypedArray).setType('VEC2').setBuffer(buffer);
}
