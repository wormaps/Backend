import type { Coordinate } from '../../places/types/place.types';
import type { SceneVegetationDetail } from '../../scene/types/scene.types';
import {
  createEmptyGeometry,
  type GeometryBuffers,
  type Vec3,
} from './road-mesh.builder';

export type TreeSilhouette = 'cone' | 'sphere' | 'cylinder' | 'umbrella';
export type TreeSize = 'small' | 'medium' | 'large';

export interface TreeVariationParams {
  silhouette: TreeSilhouette;
  size: TreeSize;
  trunkHeight: number;
  crownRadius: number;
  crownHeight: number;
}

export interface BushVariationParams {
  radius: number;
  height: number;
  density: 'sparse' | 'normal' | 'dense';
}

export interface FlowerBedParams {
  radius: number;
  height: number;
  colorVariation: number;
}

function toLocalPoint(origin: Coordinate, point: Coordinate): Vec3 {
  const metersPerLat = 111_320;
  const metersPerLng = 111_320 * Math.cos((origin.lat * Math.PI) / 180);
  return [
    (point.lng - origin.lng) * metersPerLng,
    0,
    -(point.lat - origin.lat) * metersPerLat,
  ];
}

function isFiniteVec3(point: Vec3): boolean {
  return point.every((value) => Number.isFinite(value));
}

function pushTriangle(
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
}

function pushQuad(
  geometry: GeometryBuffers,
  a: Vec3,
  b: Vec3,
  c: Vec3,
  d: Vec3,
): void {
  pushTriangle(geometry, a, b, c);
  pushTriangle(geometry, a, c, d);
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

function pushCylinder(
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

function pushCone(
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

function pushSphere(
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

function pushUmbrellaCrown(
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

function resolveTreeParams(
  item: SceneVegetationDetail,
  variant: number,
): TreeVariationParams {
  const baseRadius = Math.max(0.8, item.radiusMeters * 0.5);

  const silhouettes: TreeSilhouette[] = [
    'cone',
    'sphere',
    'cylinder',
    'umbrella',
  ];
  const silhouette = silhouettes[variant % silhouettes.length];

  const sizes: TreeSize[] = ['small', 'medium', 'large'];
  const size = sizes[variant % sizes.length];

  const sizeMultipliers: Record<
    TreeSize,
    { trunk: number; crown: number; height: number }
  > = {
    small: { trunk: 0.7, crown: 0.6, height: 0.6 },
    medium: { trunk: 1.0, crown: 1.0, height: 1.0 },
    large: { trunk: 1.3, crown: 1.4, height: 1.5 },
  };

  const multiplier = sizeMultipliers[size];

  const baseTrunkHeight = 1.4 + (variant % 3) * 0.3;
  const baseCrownRadius = baseRadius * (1.2 + (variant % 4) * 0.15);
  const baseCrownHeight = 1.8 + (variant % 3) * 0.4;

  return {
    silhouette,
    size,
    trunkHeight: baseTrunkHeight * multiplier.trunk,
    crownRadius: baseCrownRadius * multiplier.crown,
    crownHeight: baseCrownHeight * multiplier.height,
  };
}

function stableVariant(seed: string, modulo: number): number {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return modulo > 0 ? hash % modulo : 0;
}

export function createTreeVariationGeometry(
  origin: Coordinate,
  items: SceneVegetationDetail[],
): GeometryBuffers {
  const geometry = createEmptyGeometry();

  for (const item of items) {
    if (item.type !== 'TREE') {
      continue;
    }

    const center = toLocalPoint(origin, item.location);
    if (!isFiniteVec3(center)) {
      continue;
    }

    const variant = stableVariant(item.objectId, 12);
    const params = resolveTreeParams(item, variant);

    const trunkRadius = 0.08 + (params.size === 'large' ? 0.04 : 0);
    const trunkSegments = 6;

    pushCylinder(
      geometry,
      center[0],
      0,
      center[2],
      trunkRadius,
      params.trunkHeight,
      trunkSegments,
    );

    const crownBaseY = params.trunkHeight;
    const crownSegments = 8;

    switch (params.silhouette) {
      case 'cone':
        pushCone(
          geometry,
          center[0],
          crownBaseY,
          center[2],
          params.crownRadius,
          params.crownHeight,
          crownSegments,
        );
        break;

      case 'sphere':
        pushSphere(
          geometry,
          center[0],
          crownBaseY + params.crownRadius * 0.6,
          center[2],
          params.crownRadius,
          crownSegments,
          6,
        );
        break;

      case 'cylinder':
        pushCylinder(
          geometry,
          center[0],
          crownBaseY,
          center[2],
          params.crownRadius * 0.8,
          params.crownHeight,
          crownSegments,
        );
        pushCone(
          geometry,
          center[0],
          crownBaseY + params.crownHeight * 0.7,
          center[2],
          params.crownRadius * 0.6,
          params.crownHeight * 0.3,
          crownSegments,
        );
        break;

      case 'umbrella':
        pushUmbrellaCrown(
          geometry,
          center[0],
          crownBaseY,
          center[2],
          params.crownRadius,
          params.crownHeight,
          crownSegments,
        );
        break;
    }
  }

  return geometry;
}

export function createBushGeometry(
  origin: Coordinate,
  items: SceneVegetationDetail[],
): GeometryBuffers {
  const geometry = createEmptyGeometry();

  for (const item of items) {
    if (item.type !== 'GREEN_PATCH') {
      continue;
    }

    const center = toLocalPoint(origin, item.location);
    if (!isFiniteVec3(center)) {
      continue;
    }

    const variant = stableVariant(item.objectId, 6);
    const baseRadius = Math.max(0.4, item.radiusMeters * 0.3);

    const params: BushVariationParams = {
      radius: baseRadius * (0.8 + (variant % 3) * 0.2),
      height: 0.6 + (variant % 4) * 0.2,
      density:
        variant % 3 === 0 ? 'sparse' : variant % 3 === 1 ? 'normal' : 'dense',
    };

    const clusterCount =
      params.density === 'sparse' ? 2 : params.density === 'normal' ? 3 : 4;
    const segments = 6;

    for (let cluster = 0; cluster < clusterCount; cluster += 1) {
      const angle = (cluster / clusterCount) * Math.PI * 2 + variant * 0.5;
      const offsetRadius = params.radius * 0.4;
      const clusterX = center[0] + Math.cos(angle) * offsetRadius;
      const clusterZ = center[2] + Math.sin(angle) * offsetRadius;
      const clusterRadius = params.radius * (0.5 + (cluster % 2) * 0.3);
      const clusterHeight = params.height * (0.7 + (cluster % 3) * 0.15);

      pushSphere(
        geometry,
        clusterX,
        clusterHeight * 0.5,
        clusterZ,
        clusterRadius,
        segments,
        4,
      );
    }

    const bushBaseRadius = params.radius * 0.3;
    pushCylinder(geometry, center[0], 0, center[2], bushBaseRadius, 0.15, 5);
  }

  return geometry;
}

export function createFlowerBedGeometry(
  origin: Coordinate,
  items: SceneVegetationDetail[],
): GeometryBuffers {
  const geometry = createEmptyGeometry();

  for (const item of items) {
    if (item.type !== 'PLANTER') {
      continue;
    }

    const center = toLocalPoint(origin, item.location);
    if (!isFiniteVec3(center)) {
      continue;
    }

    const variant = stableVariant(item.objectId, 8);
    const baseRadius = Math.max(0.3, item.radiusMeters * 0.4);

    const params: FlowerBedParams = {
      radius: baseRadius * (0.9 + (variant % 4) * 0.1),
      height: 0.25 + (variant % 3) * 0.08,
      colorVariation: variant,
    };

    const bedHeight = params.height;
    const bedRadius = params.radius;
    const segments = 8;

    pushCylinder(
      geometry,
      center[0],
      0,
      center[2],
      bedRadius,
      bedHeight,
      segments,
    );

    const flowerCount = 3 + (params.colorVariation % 3);
    const flowerHeight = 0.15 + (params.colorVariation % 4) * 0.05;

    for (let flower = 0; flower < flowerCount; flower += 1) {
      const angle =
        (flower / flowerCount) * Math.PI * 2 + params.colorVariation * 0.3;
      const flowerOffset = bedRadius * 0.5;
      const flowerX = center[0] + Math.cos(angle) * flowerOffset;
      const flowerZ = center[2] + Math.sin(angle) * flowerOffset;
      const flowerRadius = 0.08 + (flower % 2) * 0.03;

      pushSphere(
        geometry,
        flowerX,
        bedHeight + flowerHeight * 0.5,
        flowerZ,
        flowerRadius,
        5,
        3,
      );
    }

    const centerFlowerRadius = 0.12;
    pushSphere(
      geometry,
      center[0],
      bedHeight + flowerHeight * 0.6,
      center[2],
      centerFlowerRadius,
      5,
      3,
    );
  }

  return geometry;
}

export function createVegetationGeometry(
  origin: Coordinate,
  items: SceneVegetationDetail[],
): GeometryBuffers {
  const geometry = createEmptyGeometry();

  for (const item of items) {
    const center = toLocalPoint(origin, item.location);
    if (!isFiniteVec3(center)) {
      continue;
    }
    const radius = Math.max(0.8, item.radiusMeters * 0.5);

    pushCylinder(geometry, center[0], 0, center[2], 0.08, 1.4, 4);

    if (geometry.indices.length % 2 === 0) {
      pushBox(
        geometry,
        [center[0] - radius, 1.1, center[2] - radius * 0.85],
        [center[0] + radius, 2.5, center[2] + radius * 0.85],
      );
      pushBox(
        geometry,
        [center[0] - radius * 0.72, 2.15, center[2] - radius * 0.72],
        [center[0] + radius * 0.72, 3.2, center[2] + radius * 0.72],
      );
    } else {
      pushBox(
        geometry,
        [center[0] - radius * 0.7, 1.2, center[2] - radius],
        [center[0] + radius * 0.7, 2.7, center[2] + radius],
      );
      pushBox(
        geometry,
        [center[0] - radius, 1.8, center[2] - radius * 0.55],
        [center[0] + radius, 2.9, center[2] + radius * 0.55],
      );
    }
  }

  return geometry;
}

function pushBox(geometry: GeometryBuffers, min: Vec3, max: Vec3): void {
  const [x0, y0, z0] = min;
  const [x1, y1, z1] = max;
  pushQuad(geometry, [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]);
  pushQuad(geometry, [x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]);
  pushQuad(geometry, [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]);
  pushQuad(geometry, [x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]);
  pushQuad(geometry, [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]);
  pushQuad(geometry, [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]);
}
