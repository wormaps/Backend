import type { Coordinate } from '../../../places/types/place.types';
import type { SceneVegetationDetail } from '../../../scene/types/scene.types';
import {
  createEmptyGeometry,
  type GeometryBuffers,
} from '../road/road-mesh.builder';
import {
  isFiniteVec3,
  pushBox,
  pushCone,
  pushCylinder,
  pushSphere,
  pushUmbrellaCrown,
  toLocalPoint,
} from './vegetation-mesh-geometry.utils';
import {
  DEFAULT_SCENE_VARIATION_PROFILE,
  SceneVariationProfile,
} from '../scene-variation';

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
  variationProfile: SceneVariationProfile,
): TreeVariationParams {
  const detailScale = clamp(variationProfile.vegetationDetailBoost, 0.9, 1.25);
  const densityScale = clamp(variationProfile.vegetationDensityBoost, 0.9, 1.2);
  const baseRadius = Math.max(0.8, item.radiusMeters * 0.5);

  const silhouettes: TreeSilhouette[] = [
    'cone',
    'sphere',
    'cylinder',
    'umbrella',
  ];
  const silhouette = silhouettes[variant % silhouettes.length];

  const sizes: TreeSize[] = ['small', 'medium', 'large'];
  const size = sizes[variant % sizes.length]!;

  const sizeMultipliers: Record<
    TreeSize,
    { trunk: number; crown: number; height: number }
  > = {
    small: { trunk: 0.7, crown: 0.6, height: 0.6 },
    medium: { trunk: 1.0, crown: 1.0, height: 1.0 },
    large: { trunk: 1.3, crown: 1.4, height: 1.5 },
  };

  const multiplier = sizeMultipliers[size]!;

  const baseTrunkHeight = 1.4 + (variant % 3) * 0.3;
  const baseCrownRadius = baseRadius * (1.2 + (variant % 4) * 0.15);
  const baseCrownHeight = 1.8 + (variant % 3) * 0.4;

  return {
    silhouette: silhouette!,
    size,
    trunkHeight:
      baseTrunkHeight * multiplier.trunk * (0.96 + (detailScale - 1) * 0.4),
    crownRadius: baseCrownRadius * multiplier.crown * densityScale,
    crownHeight: baseCrownHeight * multiplier.height * detailScale,
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
  variationProfile: SceneVariationProfile = DEFAULT_SCENE_VARIATION_PROFILE,
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

    const variantPool = Math.max(
      12,
      Math.round(12 * clamp(variationProfile.vegetationDetailBoost, 1, 1.5)),
    );
    const variant = stableVariant(item.objectId, variantPool);
    const params = resolveTreeParams(item, variant, variationProfile);

    const trunkRadius = 0.08 + (params.size === 'large' ? 0.04 : 0);
    const trunkSegments =
      variationProfile.vegetationDetailBoost >= 1.15
        ? 10
        : variationProfile.vegetationDetailBoost >= 1.02
          ? 8
          : 6;

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
    const crownSegments =
      variationProfile.vegetationDetailBoost >= 1.18
        ? 12
        : variationProfile.vegetationDetailBoost >= 1.08
          ? 10
          : 8;

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
          variationProfile.vegetationDetailBoost >= 1.15 ? 8 : 6,
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
  variationProfile: SceneVariationProfile = DEFAULT_SCENE_VARIATION_PROFILE,
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

    const variant = stableVariant(
      item.objectId,
      Math.max(
        6,
        Math.round(8 * clamp(variationProfile.vegetationDetailBoost, 1, 1.5)),
      ),
    );
    const baseRadius = Math.max(0.4, item.radiusMeters * 0.3);

    const params: BushVariationParams = {
      radius: baseRadius * (0.8 + (variant % 3) * 0.2),
      height: 0.6 + (variant % 4) * 0.2,
      density:
        variant % 3 === 0 ? 'sparse' : variant % 3 === 1 ? 'normal' : 'dense',
    };

    const baseClusterCount =
      params.density === 'sparse' ? 2 : params.density === 'normal' ? 3 : 4;
    const clusterCount = Math.max(
      2,
      Math.min(
        6,
        Math.round(baseClusterCount * variationProfile.vegetationDensityBoost),
      ),
    );
    const segments = variationProfile.vegetationDetailBoost >= 1.12 ? 8 : 6;

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
        variationProfile.vegetationDetailBoost >= 1.12 ? 6 : 4,
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
  variationProfile: SceneVariationProfile = DEFAULT_SCENE_VARIATION_PROFILE,
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

    const variant = stableVariant(
      item.objectId,
      Math.max(
        8,
        Math.round(10 * clamp(variationProfile.vegetationDetailBoost, 1, 1.5)),
      ),
    );
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

    const flowerCount = Math.max(
      3,
      Math.min(
        8,
        Math.round(
          (3 + (params.colorVariation % 3)) *
            variationProfile.vegetationDensityBoost,
        ),
      ),
    );
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
        variationProfile.vegetationDetailBoost >= 1.12 ? 6 : 5,
        variationProfile.vegetationDetailBoost >= 1.12 ? 4 : 3,
      );
    }

    const centerFlowerRadius = 0.12;
    pushSphere(
      geometry,
      center[0],
      bedHeight + flowerHeight * 0.6,
      center[2],
      centerFlowerRadius,
      variationProfile.vegetationDetailBoost >= 1.12 ? 6 : 5,
      variationProfile.vegetationDetailBoost >= 1.12 ? 4 : 3,
    );
  }

  return geometry;
}

export function createShrubGeometry(
  origin: Coordinate,
  items: SceneVegetationDetail[],
  variationProfile: SceneVariationProfile = DEFAULT_SCENE_VARIATION_PROFILE,
): GeometryBuffers {
  const geometry = createEmptyGeometry();

  for (const item of items) {
    if (item.type !== 'SHRUB') {
      continue;
    }

    const center = toLocalPoint(origin, item.location);
    if (!isFiniteVec3(center)) {
      continue;
    }

    const variant = stableVariant(item.objectId, 6);
    const baseRadius = Math.max(0.3, item.radiusMeters * 0.4);
    const shrubHeight = 0.5 + (variant % 3) * 0.25;
    const segments = variationProfile.vegetationDetailBoost >= 1.1 ? 8 : 6;

    pushSphere(
      geometry,
      center[0],
      shrubHeight * 0.5,
      center[2],
      baseRadius,
      segments,
      variationProfile.vegetationDetailBoost >= 1.1 ? 6 : 4,
    );
  }

  return geometry;
}

export function createGrassPatchGeometry(
  origin: Coordinate,
  items: SceneVegetationDetail[],
  variationProfile: SceneVariationProfile = DEFAULT_SCENE_VARIATION_PROFILE,
): GeometryBuffers {
  const geometry = createEmptyGeometry();

  for (const item of items) {
    if (item.type !== 'GRASS') {
      continue;
    }

    const center = toLocalPoint(origin, item.location);
    if (!isFiniteVec3(center)) {
      continue;
    }

    const variant = stableVariant(item.objectId, 4);
    const patchRadius = Math.max(0.2, item.radiusMeters * 0.3);
    const patchHeight = 0.08 + (variant % 3) * 0.04;

    pushCylinder(
      geometry,
      center[0],
      patchHeight / 2,
      center[2],
      patchRadius,
      patchHeight,
      6,
    );
  }

  return geometry;
}

export function createHedgeGeometry(
  origin: Coordinate,
  items: SceneVegetationDetail[],
  variationProfile: SceneVariationProfile = DEFAULT_SCENE_VARIATION_PROFILE,
): GeometryBuffers {
  const geometry = createEmptyGeometry();

  for (const item of items) {
    if (item.type !== 'HEDGE') {
      continue;
    }

    const center = toLocalPoint(origin, item.location);
    if (!isFiniteVec3(center)) {
      continue;
    }

    const variant = stableVariant(item.objectId, 4);
    const hedgeWidth = 0.4 + (variant % 2) * 0.2;
    const hedgeHeight = 0.6 + (variant % 3) * 0.2;
    const hedgeDepth = 0.3;

    pushBox(
      geometry,
      [center[0] - hedgeWidth / 2, 0, center[2] - hedgeDepth / 2],
      [center[0] + hedgeWidth / 2, hedgeHeight, center[2] + hedgeDepth / 2],
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

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
