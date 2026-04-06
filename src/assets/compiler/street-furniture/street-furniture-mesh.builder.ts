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

export function createBenchGeometry(
  origin: Coordinate,
  items: SceneStreetFurnitureDetail[],
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
    const variant = stableVariant(item.objectId, 3);
    pushBenchAssembly(geometry, center, variant);
  }

  return geometry;
}

export function createBikeRackGeometry(
  origin: Coordinate,
  items: SceneStreetFurnitureDetail[],
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
    const variant = stableVariant(item.objectId, 2);
    pushBikeRackAssembly(geometry, center, variant);
  }

  return geometry;
}

export function createTrashCanGeometry(
  origin: Coordinate,
  items: SceneStreetFurnitureDetail[],
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
    const variant = stableVariant(item.objectId, 2);
    pushTrashCanAssembly(geometry, center, variant);
  }

  return geometry;
}

export function createFireHydrantGeometry(
  origin: Coordinate,
  items: SceneStreetFurnitureDetail[],
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
    pushFireHydrantAssembly(geometry, center);
  }

  return geometry;
}

export function createEnhancedStreetLightGeometry(
  origin: Coordinate,
  items: SceneStreetFurnitureDetail[],
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
    const variant = stableVariant(item.objectId, 4);
    pushEnhancedStreetLightAssembly(geometry, center, variant);
  }

  return geometry;
}

export function createEnhancedSignPoleGeometry(
  origin: Coordinate,
  items: SceneStreetFurnitureDetail[],
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
    const variant = stableVariant(item.objectId, 4);
    pushEnhancedSignPoleAssembly(geometry, center, variant);
  }

  return geometry;
}
