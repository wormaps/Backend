import type { GeometryBuffers, Vec3 } from '../road/road-mesh.builder';
import { isFiniteVec3 } from '../../../common/geo/coordinate-transform.utils';
export { isFiniteVec3, toLocalPoint } from '../../../common/geo/coordinate-transform.utils';
export { pushBox } from '../geometry/primitives/box.utils';

export function pushTriangle(
  geometry: GeometryBuffers,
  a: Vec3,
  b: Vec3,
  c: Vec3,
): void {
  const normal = computeNormal(a, b, c);
  if (normal === null) {
    return;
  }
  const baseIndex = geometry.positions.length / 3;
  geometry.positions.push(...a, ...b, ...c);
  geometry.normals.push(...normal, ...normal, ...normal);
  geometry.indices.push(baseIndex, baseIndex + 1, baseIndex + 2);
  if (geometry.uvs !== undefined) {
    geometry.uvs.push(a[0], a[2], b[0], b[2], c[0], c[2]);
  }
}

export function pushQuad(
  geometry: GeometryBuffers,
  a: Vec3,
  b: Vec3,
  c: Vec3,
  d: Vec3,
): void {
  pushTriangle(geometry, a, b, c);
  pushTriangle(geometry, a, c, d);
}

export function pushCylinder(
  geometry: GeometryBuffers,
  centerX: number,
  baseY: number,
  centerZ: number,
  radius: number,
  height: number,
  segments: number,
): void {
  const topY = baseY + height;

  for (let i = 0; i < segments; i += 1) {
    const angle0 = (i / segments) * Math.PI * 2;
    const angle1 = ((i + 1) / segments) * Math.PI * 2;

    const x0 = centerX + Math.cos(angle0) * radius;
    const z0 = centerZ + Math.sin(angle0) * radius;
    const x1 = centerX + Math.cos(angle1) * radius;
    const z1 = centerZ + Math.sin(angle1) * radius;

    pushQuad(
      geometry,
      [x0, baseY, z0],
      [x1, baseY, z1],
      [x1, topY, z1],
      [x0, topY, z0],
    );
  }
}

export function pushCone(
  geometry: GeometryBuffers,
  centerX: number,
  baseY: number,
  centerZ: number,
  baseRadius: number,
  height: number,
  segments: number,
): void {
  const topY = baseY + height;
  const apex: Vec3 = [centerX, topY, centerZ];

  for (let i = 0; i < segments; i += 1) {
    const angle0 = (i / segments) * Math.PI * 2;
    const angle1 = ((i + 1) / segments) * Math.PI * 2;

    const x0 = centerX + Math.cos(angle0) * baseRadius;
    const z0 = centerZ + Math.sin(angle0) * baseRadius;
    const x1 = centerX + Math.cos(angle1) * baseRadius;
    const z1 = centerZ + Math.sin(angle1) * baseRadius;

    pushTriangle(geometry, [x0, baseY, z0], [x1, baseY, z1], apex);
  }
}

export function pushSphere(
  geometry: GeometryBuffers,
  centerX: number,
  centerY: number,
  centerZ: number,
  radius: number,
  segments: number,
  rings: number,
): void {
  for (let ring = 0; ring < rings; ring += 1) {
    const phi0 = (ring / rings) * Math.PI;
    const phi1 = ((ring + 1) / rings) * Math.PI;

    for (let seg = 0; seg < segments; seg += 1) {
      const theta0 = (seg / segments) * Math.PI * 2;
      const theta1 = ((seg + 1) / segments) * Math.PI * 2;

      const y0 = centerY + Math.cos(phi0) * radius;
      const y1 = centerY + Math.cos(phi1) * radius;
      const r0 = Math.sin(phi0) * radius;
      const r1 = Math.sin(phi1) * radius;

      const x00 = centerX + Math.cos(theta0) * r0;
      const z00 = centerZ + Math.sin(theta0) * r0;
      const x10 = centerX + Math.cos(theta1) * r0;
      const z10 = centerZ + Math.sin(theta1) * r0;
      const x01 = centerX + Math.cos(theta0) * r1;
      const z01 = centerZ + Math.sin(theta0) * r1;
      const x11 = centerX + Math.cos(theta1) * r1;
      const z11 = centerZ + Math.sin(theta1) * r1;

      pushQuad(
        geometry,
        [x00, y0, z00],
        [x10, y0, z10],
        [x11, y1, z11],
        [x01, y1, z01],
      );
    }
  }
}

export function pushUmbrellaCrown(
  geometry: GeometryBuffers,
  centerX: number,
  baseY: number,
  centerZ: number,
  radius: number,
  height: number,
  segments: number,
): void {
  const topY = baseY + height;
  const crownBaseY = baseY + height * 0.3;

  for (let i = 0; i < segments; i += 1) {
    const angle0 = (i / segments) * Math.PI * 2;
    const angle1 = ((i + 1) / segments) * Math.PI * 2;

    const x0 = centerX + Math.cos(angle0) * radius;
    const z0 = centerZ + Math.sin(angle0) * radius;
    const x1 = centerX + Math.cos(angle1) * radius;
    const z1 = centerZ + Math.sin(angle1) * radius;

    pushTriangle(
      geometry,
      [x0, crownBaseY, z0],
      [x1, crownBaseY, z1],
      [centerX, topY, centerZ],
    );
  }

  pushCylinder(
    geometry,
    centerX,
    crownBaseY - 0.2,
    centerZ,
    radius * 0.15,
    0.2,
    6,
  );
}

function computeNormal(a: Vec3, b: Vec3, c: Vec3): Vec3 | null {
  if (![a, b, c].every((point) => isFiniteVec3(point))) {
    return null;
  }

  const ab: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const ac: Vec3 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const cross: Vec3 = [
    ab[1] * ac[2] - ab[2] * ac[1],
    ab[2] * ac[0] - ab[0] * ac[2],
    ab[0] * ac[1] - ab[1] * ac[0],
  ];
  const length = Math.hypot(cross[0], cross[1], cross[2]);
  if (!Number.isFinite(length) || length <= 1e-6) {
    return null;
  }

  return [cross[0] / length, cross[1] / length, cross[2] / length];
}
