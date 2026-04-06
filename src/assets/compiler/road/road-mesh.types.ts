export type Vec3 = [number, number, number];

export interface GeometryBuffers {
  positions: number[];
  normals: number[];
  indices: number[];
}

export function createEmptyGeometry(): GeometryBuffers {
  return {
    positions: [],
    normals: [],
    indices: [],
  };
}

export function mergeGeometryBuffers(
  buffers: GeometryBuffers[],
): GeometryBuffers {
  const merged = createEmptyGeometry();

  for (const buffer of buffers) {
    const baseIndex = merged.positions.length / 3;
    merged.positions.push(...buffer.positions);
    merged.normals.push(...buffer.normals);
    merged.indices.push(...buffer.indices.map((index) => index + baseIndex));
  }

  return merged;
}
