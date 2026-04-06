import type { Coordinate } from '../../places/types/place.types';
import type { SceneVegetationDetail } from '../../scene/types/scene.types';
import { createEmptyGeometry, type GeometryBuffers } from './road-mesh.builder';
import {
  isFiniteVec3,
  pushBox,
  pushCone,
  pushCylinder,
  pushSphere,
  pushUmbrellaCrown,
  toLocalPoint,
} from './vegetation-mesh-geometry.utils';

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
