import type { GeometryBuffers, Vec3 } from '../road/road-mesh.builder';
export { isFiniteVec3, toLocalPoint } from '../../../common/geo/coordinate-transform.utils';

export function pushBox(geometry: GeometryBuffers, min: Vec3, max: Vec3): void {
  const baseIndex = geometry.positions.length / 3;

  const vertices: Vec3[] = [
    [min[0], min[1], min[2]],
    [max[0], min[1], min[2]],
    [max[0], max[1], min[2]],
    [min[0], max[1], min[2]],
    [min[0], min[1], max[2]],
    [max[0], min[1], max[2]],
    [max[0], max[1], max[2]],
    [min[0], max[1], max[2]],
  ];

  for (const v of vertices) {
    geometry.positions.push(...v);
  }

  const faces: Array<{ normal: Vec3; indices: number[] }> = [
    { normal: [0, 0, -1], indices: [0, 1, 2, 3] },
    { normal: [0, 0, 1], indices: [4, 7, 6, 5] },
    { normal: [0, -1, 0], indices: [0, 4, 5, 1] },
    { normal: [0, 1, 0], indices: [2, 6, 7, 3] },
    { normal: [-1, 0, 0], indices: [0, 3, 7, 4] },
    { normal: [1, 0, 0], indices: [1, 5, 6, 2] },
  ];

  const vertexNormals: Vec3[] = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  const vertexNormalCounts = [0, 0, 0, 0, 0, 0, 0, 0];

  for (const face of faces) {
    for (const vertexIndex of face.indices) {
      vertexNormals[vertexIndex][0] += face.normal[0];
      vertexNormals[vertexIndex][1] += face.normal[1];
      vertexNormals[vertexIndex][2] += face.normal[2];
      vertexNormalCounts[vertexIndex] += 1;
    }
  }

  for (let i = 0; i < 8; i += 1) {
    const count = vertexNormalCounts[i];
    let normal: Vec3;
    if (count > 0) {
      const nx = vertexNormals[i][0] / count;
      const ny = vertexNormals[i][1] / count;
      const nz = vertexNormals[i][2] / count;
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
      normal = len > 0 ? [nx / len, ny / len, nz / len] : [0, 1, 0];
    } else {
      normal = [0, 1, 0];
    }
    geometry.normals.push(...normal);
  }

  geometry.indices.push(
    baseIndex + 0,
    baseIndex + 1,
    baseIndex + 2,
    baseIndex + 0,
    baseIndex + 2,
    baseIndex + 3,
  );
  geometry.indices.push(
    baseIndex + 4,
    baseIndex + 7,
    baseIndex + 6,
    baseIndex + 4,
    baseIndex + 6,
    baseIndex + 5,
  );
  geometry.indices.push(
    baseIndex + 0,
    baseIndex + 4,
    baseIndex + 5,
    baseIndex + 0,
    baseIndex + 5,
    baseIndex + 1,
  );
  geometry.indices.push(
    baseIndex + 2,
    baseIndex + 6,
    baseIndex + 7,
    baseIndex + 2,
    baseIndex + 7,
    baseIndex + 3,
  );
  geometry.indices.push(
    baseIndex + 0,
    baseIndex + 3,
    baseIndex + 7,
    baseIndex + 0,
    baseIndex + 7,
    baseIndex + 4,
  );
  geometry.indices.push(
    baseIndex + 1,
    baseIndex + 5,
    baseIndex + 6,
    baseIndex + 1,
    baseIndex + 6,
    baseIndex + 2,
  );
}

export function pushCylinder(
  geometry: GeometryBuffers,
  center: Vec3,
  radius: number,
  height: number,
  segments: number,
  orientation: 'vertical' | 'horizontal' = 'vertical',
): void {
  const baseIndex = geometry.positions.length / 3;
  const angleStep = (2 * Math.PI) / segments;
  const topY = orientation === 'vertical' ? center[1] + height : center[1];
  const bottomY =
    orientation === 'vertical' ? center[1] : center[1] - height / 2;

  for (let i = 0; i <= segments; i += 1) {
    const angle = i * angleStep;
    const x = center[0] + radius * Math.cos(angle);
    const z = center[2] + radius * Math.sin(angle);

    geometry.positions.push(x, bottomY, z);
    geometry.positions.push(x, topY, z);
    geometry.normals.push(Math.cos(angle), 0, Math.sin(angle));
    geometry.normals.push(Math.cos(angle), 0, Math.sin(angle));
  }

  for (let i = 0; i < segments; i += 1) {
    const current = baseIndex + i * 2;
    const next = baseIndex + (i + 1) * 2;
    geometry.indices.push(current, next, next + 1);
    geometry.indices.push(current, next + 1, current + 1);
  }
}

export function pushTaperedCylinder(
  geometry: GeometryBuffers,
  center: Vec3,
  bottomRadius: number,
  topRadius: number,
  height: number,
  segments: number,
): void {
  const baseIndex = geometry.positions.length / 3;
  const angleStep = (2 * Math.PI) / segments;

  for (let i = 0; i <= segments; i += 1) {
    const angle = i * angleStep;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const bottomX = center[0] + bottomRadius * cos;
    const bottomZ = center[2] + bottomRadius * sin;
    const topX = center[0] + topRadius * cos;
    const topZ = center[2] + topRadius * sin;

    geometry.positions.push(bottomX, center[1], bottomZ);
    geometry.positions.push(topX, center[1] + height, topZ);

    const normalY = (bottomRadius - topRadius) / height;
    const normalLen = Math.sqrt(cos * cos + normalY * normalY + sin * sin);
    geometry.normals.push(
      cos / normalLen,
      normalY / normalLen,
      sin / normalLen,
    );
    geometry.normals.push(
      cos / normalLen,
      normalY / normalLen,
      sin / normalLen,
    );
  }

  for (let i = 0; i < segments; i += 1) {
    const current = baseIndex + i * 2;
    const next = baseIndex + (i + 1) * 2;
    geometry.indices.push(current, next, next + 1);
    geometry.indices.push(current, next + 1, current + 1);
  }
}

export function stableVariant(seed: string, modulo: number): number {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return modulo > 0 ? hash % modulo : 0;
}
