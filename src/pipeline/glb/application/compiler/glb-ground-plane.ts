import type { TypedArray } from '@gltf-transform/core';
import type { Buffer, Document } from '@gltf-transform/core';

import type { MeshPlan } from '../../../../shared/contracts';

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
): ReturnType<Document['createNode']> {
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
