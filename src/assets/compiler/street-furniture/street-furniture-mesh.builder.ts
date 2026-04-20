import type { Coordinate } from '../../../places/types/place.types';
import type { SceneStreetFurnitureDetail } from '../../../scene/types/scene.types';
import {
  createEmptyGeometry,
  type GeometryBuffers,
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
  pushPostBoxAssembly,
  pushPublicPhoneAssembly,
  pushAdvertisingAssembly,
  pushVendingMachineAssembly,
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
        4,
        Math.round(6 * clamp(variationProfile.furnitureVariantBoost, 1, 1.6)),
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
        3,
        Math.round(5 * clamp(variationProfile.furnitureVariantBoost, 1, 1.6)),
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
        3,
        Math.round(5 * clamp(variationProfile.furnitureVariantBoost, 1, 1.6)),
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
        5,
        Math.round(7 * clamp(variationProfile.furnitureVariantBoost, 1, 1.6)),
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
        5,
        Math.round(7 * clamp(variationProfile.furnitureVariantBoost, 1, 1.6)),
      ),
    );
    pushEnhancedSignPoleAssembly(geometry, center, variant, variationProfile);
  }

  return geometry;
}

export function createPostBoxGeometry(
  origin: Coordinate,
  items: SceneStreetFurnitureDetail[],
  variationProfile: SceneVariationProfile = DEFAULT_SCENE_VARIATION_PROFILE,
): GeometryBuffers {
  const geometry = createEmptyGeometry();

  for (const item of items) {
    if (item.type !== 'POST_BOX') {
      continue;
    }
    const center = toLocalPoint(origin, item.location);
    if (!isFiniteVec3(center)) {
      continue;
    }
    const variant = stableVariant(item.objectId, 4);
    pushPostBoxAssembly(geometry, center, variant, variationProfile);
  }

  return geometry;
}

export function createPublicPhoneGeometry(
  origin: Coordinate,
  items: SceneStreetFurnitureDetail[],
  variationProfile: SceneVariationProfile = DEFAULT_SCENE_VARIATION_PROFILE,
): GeometryBuffers {
  const geometry = createEmptyGeometry();

  for (const item of items) {
    if (item.type !== 'PUBLIC_PHONE') {
      continue;
    }
    const center = toLocalPoint(origin, item.location);
    if (!isFiniteVec3(center)) {
      continue;
    }
    const variant = stableVariant(item.objectId, 3);
    pushPublicPhoneAssembly(geometry, center, variant, variationProfile);
  }

  return geometry;
}

export function createAdvertisingGeometry(
  origin: Coordinate,
  items: SceneStreetFurnitureDetail[],
  variationProfile: SceneVariationProfile = DEFAULT_SCENE_VARIATION_PROFILE,
): GeometryBuffers {
  const geometry = createEmptyGeometry();

  for (const item of items) {
    if (item.type !== 'ADVERTISING') {
      continue;
    }
    const center = toLocalPoint(origin, item.location);
    if (!isFiniteVec3(center)) {
      continue;
    }
    const variant = stableVariant(
      item.objectId,
      Math.max(3, Math.round(5 * clamp(variationProfile.furnitureVariantBoost, 1, 1.6))),
    );
    pushAdvertisingAssembly(geometry, center, variant, variationProfile);
  }

  return geometry;
}

export function createVendingMachineGeometry(
  origin: Coordinate,
  items: SceneStreetFurnitureDetail[],
  variationProfile: SceneVariationProfile = DEFAULT_SCENE_VARIATION_PROFILE,
): GeometryBuffers {
  const geometry = createEmptyGeometry();

  for (const item of items) {
    if (item.type !== 'VENDING_MACHINE') {
      continue;
    }
    const center = toLocalPoint(origin, item.location);
    if (!isFiniteVec3(center)) {
      continue;
    }
    const variant = stableVariant(item.objectId, 3);
    pushVendingMachineAssembly(geometry, center, variant, variationProfile);
  }

  return geometry;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
