import type { TypedArray } from '@gltf-transform/core';
import { type Accessor, type Buffer, type Document } from '@gltf-transform/core';
import earcut from 'earcut';

import type { MeshPlanNode } from '../../../../shared/contracts';
import type {
  BuildingMeshGeometry,
  MeshGeometry,
  RoadMeshGeometry,
  TerrainMeshGeometry,
  WalkwayMeshGeometry,
} from '../../../../shared/core';

export function createPositions(document: Document, buffer: Buffer, node: MeshPlanNode): Accessor {
  const geometry = node.geometry;
  const type = node.primitive;
  const { x, y, z } = node.pivot;

  if (geometry !== undefined) {
    return createPositionsFromGeometry(document, buffer, geometry, type, { x, y, z });
  }

  return createPlaceholderPositions(document, buffer, type, { x, y, z });
}

function createPlaceholderPositions(
  document: Document,
  buffer: Buffer,
  primitive: string,
  _pivot: { x: number; y: number; z: number },
): Accessor {
  let positions: Float32Array;

  switch (primitive) {
    case 'building_massing':
    case 'building_windows':
      positions = new Float32Array([0, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 1]);
      break;
    case 'road':
    case 'walkway':
      positions = new Float32Array([
        -0.5, 0, 0, 0.5, 0, 0, 0.5, 0, 0.5,
        -0.5, 0, 0, 0.5, 0, 0.5, -0.5, 0, 0.5,
      ]);
      break;
    case 'terrain':
      positions = new Float32Array([
        -1, 0, -1, 1, 0, -1, 1, 0, 1,
        -1, 0, -1, 1, 0, 1, -1, 0, 1,
      ]);
      break;
    default:
      positions = new Float32Array([0, 0.5, 0, 0.3, 0, 0.3, -0.3, 0, -0.3]);
      break;
  }

  return document.createAccessor('positions').setArray(positions as TypedArray).setType('VEC3').setBuffer(buffer);
}

function createBuildingPositions(document: Document, buffer: Buffer, geometry: BuildingMeshGeometry): Accessor {
  const outer = geometry.footprint.outer;
  const baseY = geometry.baseY ?? 0;
  const height = geometry.height ?? 5;
  const topY = baseY + height;

  if (outer.length < 3) {
    return createPlaceholderPositions(document, buffer, 'building_massing', {
      x: outer[0]?.x ?? 0,
      y: baseY,
      z: outer[0]?.z ?? 0,
    });
  }

  const holes = geometry.footprint.holes;
  const allVerts = holes && holes.length > 0 ? [...outer, ...holes.flat()] : outer;
  const flatXZ: number[] = allVerts.flatMap(({ x, z }) => [x, z]);
  let holeIndices: number[] | undefined;
  if (holes && holes.length > 0) {
    holeIndices = [];
    let offset = outer.length;
    for (const hole of holes) {
      holeIndices.push(offset);
      offset += hole.length;
    }
  }
  const floorTris = earcut(flatXZ, holeIndices);

  let signedArea = 0;
  for (let i = 0; i < outer.length; i++) {
    const a = outer[i]!;
    const b = outer[(i + 1) % outer.length]!;
    signedArea += a.x * b.z - b.x * a.z;
  }
  const ccw = signedArea > 0;

  const positions: number[] = [];

  for (let i = 0; i < floorTris.length; i += 3) {
    const a = allVerts[floorTris[i]!]!;
    const b = allVerts[floorTris[i + 1]!]!;
    const c = allVerts[floorTris[i + 2]!]!;
    if (ccw) positions.push(a.x, baseY, a.z, b.x, baseY, b.z, c.x, baseY, c.z);
    else positions.push(a.x, baseY, a.z, c.x, baseY, c.z, b.x, baseY, b.z);
  }

  for (let i = 0; i < floorTris.length; i += 3) {
    const a = allVerts[floorTris[i]!]!;
    const b = allVerts[floorTris[i + 1]!]!;
    const c = allVerts[floorTris[i + 2]!]!;
    if (ccw) positions.push(a.x, topY, a.z, c.x, topY, c.z, b.x, topY, b.z);
    else positions.push(a.x, topY, a.z, b.x, topY, b.z, c.x, topY, c.z);
  }

  const n = outer.length;
  for (let j = 0; j < n; j++) {
    const p0 = outer[j]!;
    const p1 = outer[(j + 1) % n]!;
    if (ccw) {
      positions.push(p0.x, baseY, p0.z, p1.x, topY, p1.z, p1.x, baseY, p1.z);
      positions.push(p0.x, baseY, p0.z, p0.x, topY, p0.z, p1.x, topY, p1.z);
    } else {
      positions.push(p0.x, baseY, p0.z, p1.x, baseY, p1.z, p1.x, topY, p1.z);
      positions.push(p0.x, baseY, p0.z, p1.x, topY, p1.z, p0.x, topY, p0.z);
    }
  }

  const roofRise = geometry.roofRise ?? 0;
  if (roofRise > 0.1 && outer.length >= 3) {
    const cx = outer.reduce((sum, point) => sum + point.x, 0) / outer.length;
    const cz = outer.reduce((sum, point) => sum + point.z, 0) / outer.length;
    const apexY = topY + roofRise;

    for (let j = 0; j < n; j++) {
      const p0 = outer[j]!;
      const p1 = outer[(j + 1) % n]!;
      if (ccw) positions.push(p0.x, topY, p0.z, p1.x, topY, p1.z, cx, apexY, cz);
      else positions.push(p0.x, topY, p0.z, cx, apexY, cz, p1.x, topY, p1.z);
    }
  }

  return document
    .createAccessor('positions')
    .setArray(new Float32Array(positions) as TypedArray)
    .setType('VEC3')
    .setBuffer(buffer);
}

function createWindowPositions(document: Document, buffer: Buffer, geometry: BuildingMeshGeometry): Accessor {
  const outer = geometry.footprint.outer;
  const baseY = geometry.baseY ?? 0;
  const height = geometry.height ?? 5;

  if (outer.length < 3) {
    return createPlaceholderPositions(document, buffer, 'building_windows', {
      x: outer[0]?.x ?? 0,
      y: baseY,
      z: outer[0]?.z ?? 0,
    });
  }

  const floors = Math.max(1, Math.floor(height / 3));
  const floorH = height / floors;
  const positions: number[] = [];
  const n = outer.length;
  let windowQuadCount = 0;

  const INSET = 0.25;
  const SIDE_MARGIN = 0.6;
  const WIN_SPACING = 2.5;
  const WIN_WIDTH = 1.2;
  const WIN_HEIGHT = 1.4;
  const BOTTOM_MARGIN = 0.8;
  const MIN_WALL_LEN = 2.5;
  const MAX_WINDOW_QUADS = 1200;

  let signedArea = 0;
  for (let i = 0; i < n; i++) {
    const a = outer[i]!;
    const b = outer[(i + 1) % n]!;
    signedArea += a.x * b.z - b.x * a.z;
  }
  const windingSign = signedArea > 0 ? 1 : -1;

  for (let j = 0; j < n; j++) {
    const p0 = outer[j]!;
    const p1 = outer[(j + 1) % n]!;
    const dx = p1.x - p0.x;
    const dz = p1.z - p0.z;
    const wallLen = Math.sqrt(dx * dx + dz * dz);
    if (wallLen < MIN_WALL_LEN) continue;

    const inX = (dz / wallLen) * INSET * windingSign;
    const inZ = (-dx / wallLen) * INSET * windingSign;
    const usableLen = wallLen - 2 * SIDE_MARGIN;
    if (usableLen < WIN_WIDTH) continue;

    const winsPerFloor = Math.max(1, Math.floor(usableLen / WIN_SPACING));
    const actualSpacing = usableLen / winsPerFloor;
    const halfW = Math.min(WIN_WIDTH / 2, actualSpacing * 0.4);

    for (let floor = 0; floor < floors; floor++) {
      const winBottomY = baseY + floor * floorH + BOTTOM_MARGIN;
      const winTopY = winBottomY + WIN_HEIGHT;
      if (winTopY > baseY + height - 0.3) continue;

      for (let w = 0; w < winsPerFloor; w++) {
        if (windowQuadCount >= MAX_WINDOW_QUADS) break;

        const tCenter = (SIDE_MARGIN + actualSpacing * (w + 0.5)) / wallLen;
        const t0 = tCenter - halfW / wallLen;
        const t1 = tCenter + halfW / wallLen;

        const x0 = p0.x + t0 * dx + inX;
        const z0 = p0.z + t0 * dz + inZ;
        const x1 = p0.x + t1 * dx + inX;
        const z1 = p0.z + t1 * dz + inZ;

        positions.push(x0, winBottomY, z0, x1, winBottomY, z1, x1, winTopY, z1);
        positions.push(x0, winBottomY, z0, x1, winTopY, z1, x0, winTopY, z0);
        windowQuadCount += 1;
      }
    }
  }

  if (positions.length === 0) {
    return createPlaceholderPositions(document, buffer, 'building_windows', {
      x: outer[0]?.x ?? 0,
      y: baseY,
      z: outer[0]?.z ?? 0,
    });
  }

  return document
    .createAccessor('window-positions')
    .setArray(new Float32Array(positions) as TypedArray)
    .setType('VEC3')
    .setBuffer(buffer);
}

function createRoadPositions(
  document: Document,
  buffer: Buffer,
  geometry: RoadMeshGeometry | WalkwayMeshGeometry,
): Accessor {
  const centerline = geometry.centerline;
  const halfWidth = (geometry as { width?: number }).width ?? 2.5;

  if (centerline.length < 2) {
    return createPlaceholderPositions(document, buffer, 'road', {
      x: centerline[0]?.x ?? 0,
      y: centerline[0]?.y ?? 0,
      z: centerline[0]?.z ?? 0,
    });
  }

  // Layer separation against terrain/ground/walkways to kill z-fighting.
  // ground grid: dem-0.05 < terrain: dem+0.05 < walkway: dem+0.10 < road: dem+0.20.
  const yLift = geometry.kind === 'walkway' ? 0.1 : 0.2;

  const positions: number[] = [];
  for (let i = 0; i < centerline.length; i++) {
    const point = centerline[i]!;
    const prev = i > 0 ? centerline[i - 1] : centerline[i];
    const next = i < centerline.length - 1 ? centerline[i + 1] : centerline[i];
    if (prev === undefined || next === undefined) continue;

    const dx = next.x - prev.x;
    const dz = next.z - prev.z;
    const len = Math.sqrt(dx * dx + dz * dz);

    if (len < 0.001) {
      positions.push(point.x - halfWidth, point.y + yLift, point.z, point.x + halfWidth, point.y + yLift, point.z);
      continue;
    }

    const nx = dx / len;
    const nz = dz / len;
    const px = -nz * halfWidth;
    const pz = nx * halfWidth;

    positions.push(point.x - px, point.y + yLift, point.z - pz);
    positions.push(point.x + px, point.y + yLift, point.z + pz);
  }

  return document
    .createAccessor('positions')
    .setArray(new Float32Array(positions) as TypedArray)
    .setType('VEC3')
    .setBuffer(buffer);
}

function createTerrainPositions(document: Document, buffer: Buffer, geometry: TerrainMeshGeometry): Accessor {
  const { samples } = geometry;
  if (samples.length < 3) {
    const point = samples[0] ?? { x: 0, y: 0, z: 0 };
    return createPlaceholderPositions(document, buffer, 'terrain', point);
  }

  const flatXZ = samples.flatMap((sample) => [sample.x, sample.z]);
  const triIndices = earcut(flatXZ);
  if (triIndices.length === 0) {
    const point = samples[0]!;
    return createPlaceholderPositions(document, buffer, 'terrain', point);
  }

  // Lift landuse polygons just above the DEM ground grid (at dem-0.05) so the
  // two opaque surfaces do not z-fight where they share the same footprint.
  const TERRAIN_LIFT = 0.05;
  const positions = new Float32Array(triIndices.length * 3);
  for (let i = 0; i < triIndices.length; i++) {
    const sample = samples[triIndices[i]!] ?? samples[0]!;
    positions[i * 3] = sample.x;
    positions[i * 3 + 1] = sample.y + TERRAIN_LIFT;
    positions[i * 3 + 2] = sample.z;
  }

  return document.createAccessor('terrain-positions').setArray(positions as TypedArray).setType('VEC3').setBuffer(buffer);
}

function createPositionsFromGeometry(
  document: Document,
  buffer: Buffer,
  geometry: MeshGeometry,
  type: string,
  pivot: { x: number; y: number; z: number },
): Accessor {
  switch (geometry.kind) {
    case 'building':
      return type === 'building_windows'
        ? createWindowPositions(document, buffer, geometry)
        : createBuildingPositions(document, buffer, geometry);
    case 'road':
    case 'walkway':
      return createRoadPositions(document, buffer, geometry);
    case 'terrain':
      return createTerrainPositions(document, buffer, geometry);
    default:
      return createPlaceholderPositions(document, buffer, type, pivot);
  }
}
