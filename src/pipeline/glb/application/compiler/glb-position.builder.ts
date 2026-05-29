import type { TypedArray } from '@gltf-transform/core';
import { type Accessor, type Buffer, type Document } from '@gltf-transform/core';
import earcut from 'earcut';

import type { MeshPlanNode } from '../../../../shared/contracts';
import type {
  BuildingMeshGeometry,
  MeshGeometry,
  PoiMeshGeometry,
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
  // Embed the base below the (coarse) ground grid so the building/ground seam
  // is hidden even when DEM interpolation leaves a small mismatch.
  const EMBED = 1.0;
  const bottomY = baseY - EMBED;

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
    if (ccw) positions.push(a.x, bottomY, a.z, b.x, bottomY, b.z, c.x, bottomY, c.z);
    else positions.push(a.x, bottomY, a.z, c.x, bottomY, c.z, b.x, bottomY, b.z);
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
      positions.push(p0.x, bottomY, p0.z, p1.x, topY, p1.z, p1.x, bottomY, p1.z);
      positions.push(p0.x, bottomY, p0.z, p0.x, topY, p0.z, p1.x, topY, p1.z);
    } else {
      positions.push(p0.x, bottomY, p0.z, p1.x, bottomY, p1.z, p1.x, topY, p1.z);
      positions.push(p0.x, bottomY, p0.z, p1.x, topY, p1.z, p0.x, topY, p0.z);
    }
  }

  const roofRise = geometry.roofRise ?? 0;
  const roofShape = geometry.roofShape ?? 'unknown';
  if (roofRise > 0.1 && outer.length >= 3 && roofShape !== 'flat' && roofShape !== 'stepped') {
    const apexY = topY + roofRise;
    const cx = outer.reduce((sum, point) => sum + point.x, 0) / outer.length;
    const cz = outer.reduce((sum, point) => sum + point.z, 0) / outer.length;

    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const p of outer) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.z < minZ) minZ = p.z;
      if (p.z > maxZ) maxZ = p.z;
    }
    const xPrincipal = maxX - minX >= maxZ - minZ;

    const pushTri = (
      ax: number, ay: number, az: number,
      bx: number, by: number, bz: number,
      ccx: number, ccy: number, ccz: number,
    ): void => {
      if (ccw) positions.push(ax, ay, az, bx, by, bz, ccx, ccy, ccz);
      else positions.push(ax, ay, az, ccx, ccy, ccz, bx, by, bz);
    };

    if (roofShape === 'gable' || roofShape === 'shed') {
      // Ridge segment along the principal axis through the centroid.
      // Gable: both ends at apex. Shed: only the far end raised (single slope).
      const r0 = xPrincipal ? { x: minX, z: cz } : { x: cx, z: minZ };
      const r1 = xPrincipal ? { x: maxX, z: cz } : { x: cx, z: maxZ };
      const r0y = roofShape === 'shed' ? topY : apexY;
      const r1y = apexY;
      const ridgeDist = (px: number, pz: number, r: { x: number; z: number }): number =>
        (px - r.x) * (px - r.x) + (pz - r.z) * (pz - r.z);

      for (let j = 0; j < n; j++) {
        const p0 = outer[j]!;
        const p1 = outer[(j + 1) % n]!;
        const mx = (p0.x + p1.x) / 2;
        const mz = (p0.z + p1.z) / 2;
        const useR0 = ridgeDist(mx, mz, r0) <= ridgeDist(mx, mz, r1);
        const r = useR0 ? r0 : r1;
        const ry = useR0 ? r0y : r1y;
        pushTri(p0.x, topY, p0.z, p1.x, topY, p1.z, r.x, ry, r.z);
      }
    } else {
      // hip / pyramidal / unknown — apex over the centroid.
      for (let j = 0; j < n; j++) {
        const p0 = outer[j]!;
        const p1 = outer[(j + 1) % n]!;
        pushTri(p0.x, topY, p0.z, p1.x, topY, p1.z, cx, apexY, cz);
      }
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

  // Extruded slab: top driving surface + curb side walls + end caps.
  // Layering: ground(dem-0.05) < terrain(dem+0.05) < walkway top(dem+0.10) < road top(dem+0.20).
  // Bottom sits at the centerline DEM height, so the curb wall is `yLift` tall.
  const yLift = geometry.kind === 'walkway' ? 0.1 : 0.2;

  type V = { x: number; y: number; z: number };
  const left: V[] = [];
  const right: V[] = [];
  for (let i = 0; i < centerline.length; i++) {
    const point = centerline[i]!;
    const prev = i > 0 ? centerline[i - 1]! : point;
    const next = i < centerline.length - 1 ? centerline[i + 1]! : point;
    const dx = next.x - prev.x;
    const dz = next.z - prev.z;
    const len = Math.sqrt(dx * dx + dz * dz) || 1;
    const px = -(dz / len) * halfWidth;
    const pz = (dx / len) * halfWidth;
    const topY = point.y + yLift;
    left.push({ x: point.x - px, y: topY, z: point.z - pz });
    right.push({ x: point.x + px, y: topY, z: point.z + pz });
  }

  const positions: number[] = [];
  const tri = (a: V, b: V, c: V): void => {
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  };
  const lower = (v: V): V => ({ x: v.x, y: v.y - yLift, z: v.z });

  for (let i = 0; i < centerline.length - 1; i++) {
    const l0 = left[i]!;
    const r0 = right[i]!;
    const l1 = left[i + 1]!;
    const r1 = right[i + 1]!;
    const lb0 = lower(l0);
    const rb0 = lower(r0);
    const lb1 = lower(l1);
    const rb1 = lower(r1);

    // Top surface (normal up).
    tri(l0, r0, r1);
    tri(l0, r1, l1);
    // Left curb wall.
    tri(l0, l1, lb1);
    tri(l0, lb1, lb0);
    // Right curb wall.
    tri(r0, rb0, rb1);
    tri(r0, rb1, r1);
  }

  // End caps.
  const lStart = left[0]!;
  const rStart = right[0]!;
  tri(lStart, lower(lStart), lower(rStart));
  tri(lStart, lower(rStart), rStart);
  const n = centerline.length - 1;
  const lEnd = left[n]!;
  const rEnd = right[n]!;
  tri(rEnd, lower(rEnd), lower(lEnd));
  tri(rEnd, lower(lEnd), lEnd);

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

/**
 * Simple tree: square trunk prism + octahedron canopy. Two-tone via COLOR_0.
 * Built in local space (centred at 0,0,0); the node's pivot translation places
 * it at the POI point, so positions must NOT include the absolute point coords.
 */
function createTreePositions(document: Document, buffer: Buffer, geometry: PoiMeshGeometry): Accessor {
  // Per-tree deterministic variance from the point coords so a stand of trees
  // is not visually identical.
  const { x, z } = geometry.point;
  const raw = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
  const rnd = raw - Math.floor(raw); // 0..1
  const scale = 0.7 + rnd * 0.8; // 0.7x .. 1.5x
  const lean = (rnd - 0.5) * 0.6; // slight canopy offset

  const TRUNK_H = 1.6 * scale;
  const TRUNK_R = 0.22 * (0.8 + rnd * 0.4);
  const CANOPY_R = 1.9 * scale;
  const CANOPY_H = 3.6 * scale;
  const trunkTop = TRUNK_H;
  const canopyCenterY = trunkTop + CANOPY_H / 2;
  const hy = CANOPY_H / 2;

  const positions: number[] = [];
  const tri = (
    ax: number, ay: number, az: number,
    bx: number, by: number, bz: number,
    cx: number, cy: number, cz: number,
  ): void => {
    positions.push(ax, ay, az, bx, by, bz, cx, cy, cz);
  };

  // Trunk — 4 walls (each 2 triangles).
  const corners = [
    { dx: -TRUNK_R, dz: -TRUNK_R },
    { dx: TRUNK_R, dz: -TRUNK_R },
    { dx: TRUNK_R, dz: TRUNK_R },
    { dx: -TRUNK_R, dz: TRUNK_R },
  ];
  for (let i = 0; i < 4; i++) {
    const a = corners[i]!;
    const b = corners[(i + 1) % 4]!;
    tri(a.dx, 0, a.dz, b.dx, trunkTop, b.dz, b.dx, 0, b.dz);
    tri(a.dx, 0, a.dz, a.dx, trunkTop, a.dz, b.dx, trunkTop, b.dz);
  }

  // Canopy — octahedron around (lean, canopyCenterY, 0), offset off trunk axis.
  const cx = lean * CANOPY_R;
  const T = { x: cx, y: canopyCenterY + hy, z: 0 };
  const B = { x: cx, y: canopyCenterY - hy, z: 0 };
  const ring = [
    { x: cx + CANOPY_R, z: 0 },
    { x: cx, z: CANOPY_R },
    { x: cx - CANOPY_R, z: 0 },
    { x: cx, z: -CANOPY_R },
  ];
  for (let i = 0; i < 4; i++) {
    const p = ring[i]!;
    const q = ring[(i + 1) % 4]!;
    tri(T.x, T.y, T.z, p.x, canopyCenterY, p.z, q.x, canopyCenterY, q.z);
    tri(B.x, B.y, B.z, q.x, canopyCenterY, q.z, p.x, canopyCenterY, p.z);
  }

  return document
    .createAccessor('tree-positions')
    .setArray(new Float32Array(positions) as TypedArray)
    .setType('VEC3')
    .setBuffer(buffer);
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
    case 'poi':
      return createTreePositions(document, buffer, geometry);
    default:
      return createPlaceholderPositions(document, buffer, type, pivot);
  }
}
