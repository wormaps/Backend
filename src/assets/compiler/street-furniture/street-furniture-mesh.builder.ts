import type { Coordinate } from '../../../places/types/place.types';
import type { SceneStreetFurnitureDetail } from '../../../scene/types/scene.types';
import {
  createEmptyGeometry,
  type GeometryBuffers,
  type Vec3,
} from '../road/road-mesh.builder';
import {
  isFiniteVec3,
  stableVariant,
  toLocalPoint,
} from './street-furniture-mesh.geometry.utils';
import {
  pushBenchAssembly,
  pushBikeRackAssembly,
  pushEnhancedSignPoleAssembly,
  pushEnhancedStreetLightAssembly,
  pushFireHydrantAssembly,
  pushTrashCanAssembly,
} from './street-furniture-mesh.assembly';
import {
  DEFAULT_SCENE_VARIATION_PROFILE,
  SceneVariationProfile,
} from '../scene-variation';

export function createBenchGeometry(
  origin: Coordinate,
  items: SceneStreetFurnitureDetail[],
  variationProfile: SceneVariationProfile = DEFAULT_SCENE_VARIATION_PROFILE,
): GeometryBuffers {
  const geometry = createEmptyGeometry();

  for (const item of items) {
    if (item.type !== 'BENCH') {
      continue;
    }
    const center = toLocalPoint(origin, item.location);
    if (!isFiniteVec3(center)) {
      continue;
    }
    const variant = stableVariant(
      item.objectId,
      Math.max(
        3,
        Math.round(4 * clamp(variationProfile.furnitureVariantBoost, 1, 1.5)),
      ),
    );
    pushBenchAssembly(geometry, center, variant, variationProfile);
  }

  return geometry;
}

export function createBikeRackGeometry(
  origin: Coordinate,
  items: SceneStreetFurnitureDetail[],
  variationProfile: SceneVariationProfile = DEFAULT_SCENE_VARIATION_PROFILE,
): GeometryBuffers {
  const geometry = createEmptyGeometry();

  for (const item of items) {
    if (item.type !== 'BIKE_RACK') {
      continue;
    }
    const center = toLocalPoint(origin, item.location);
    if (!isFiniteVec3(center)) {
      continue;
    }
    const variant = stableVariant(
      item.objectId,
      Math.max(
        2,
        Math.round(3 * clamp(variationProfile.furnitureVariantBoost, 1, 1.5)),
      ),
    );
    pushBikeRackAssembly(geometry, center, variant, variationProfile);
  }

  return geometry;
}

export function createTrashCanGeometry(
  origin: Coordinate,
  items: SceneStreetFurnitureDetail[],
  variationProfile: SceneVariationProfile = DEFAULT_SCENE_VARIATION_PROFILE,
): GeometryBuffers {
  const geometry = createEmptyGeometry();

  for (const item of items) {
    if (item.type !== 'TRASH_CAN') {
      continue;
    }
    const center = toLocalPoint(origin, item.location);
    if (!isFiniteVec3(center)) {
      continue;
    }
    const variant = stableVariant(
      item.objectId,
      Math.max(
        2,
        Math.round(3 * clamp(variationProfile.furnitureVariantBoost, 1, 1.5)),
      ),
    );
    pushTrashCanAssembly(geometry, center, variant, variationProfile);
  }

  return geometry;
}

export function createFireHydrantGeometry(
  origin: Coordinate,
  items: SceneStreetFurnitureDetail[],
  variationProfile: SceneVariationProfile = DEFAULT_SCENE_VARIATION_PROFILE,
): GeometryBuffers {
  const geometry = createEmptyGeometry();

  for (const item of items) {
    if (item.type !== 'FIRE_HYDRANT') {
      continue;
    }
    const center = toLocalPoint(origin, item.location);
    if (!isFiniteVec3(center)) {
      continue;
    }
    pushFireHydrantAssembly(geometry, center, variationProfile);
  }

  return geometry;
}

export function createEnhancedStreetLightGeometry(
  origin: Coordinate,
  items: SceneStreetFurnitureDetail[],
  variationProfile: SceneVariationProfile = DEFAULT_SCENE_VARIATION_PROFILE,
): GeometryBuffers {
  const geometry = createEmptyGeometry();

  for (const item of items) {
    if (item.type !== 'STREET_LIGHT') {
      continue;
    }
    const center = toLocalPoint(origin, item.location);
    if (!isFiniteVec3(center)) {
      continue;
    }
    const variant = stableVariant(
      item.objectId,
      Math.max(
        4,
        Math.round(5 * clamp(variationProfile.furnitureVariantBoost, 1, 1.5)),
      ),
    );
    pushEnhancedStreetLightAssembly(
      geometry,
      center,
      variant,
      variationProfile,
    );
  }

  return geometry;
}

export function createEnhancedSignPoleGeometry(
  origin: Coordinate,
  items: SceneStreetFurnitureDetail[],
  variationProfile: SceneVariationProfile = DEFAULT_SCENE_VARIATION_PROFILE,
): GeometryBuffers {
  const geometry = createEmptyGeometry();

  for (const item of items) {
    if (item.type !== 'SIGN_POLE') {
      continue;
    }
    const center = toLocalPoint(origin, item.location);
    if (!isFiniteVec3(center)) {
      continue;
    }
    const variant = stableVariant(
      item.objectId,
      Math.max(
        4,
        Math.round(5 * clamp(variationProfile.furnitureVariantBoost, 1, 1.5)),
      ),
    );
    pushEnhancedSignPoleAssembly(geometry, center, variant, variationProfile);
  }

  return geometry;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
