import type { Coordinate } from '../../../places/types/place.types';
import type { SceneMeta } from '../../types/scene.types';

type SceneArea = Pick<SceneMeta, 'origin' | 'bounds'>;

export function selectSpatialSample<T>(
  items: T[],
  maxCount: number,
  getPoint: (item: T) => Coordinate,
  sceneMeta: SceneArea,
): T[] {
  if (items.length <= maxCount) {
    return items;
  }

  const prepared = items.map((item, index) => {
    const point = getPoint(item);
    const local = toLocalPoint(sceneMeta.origin, point);
    const distance = Math.hypot(local.x, local.z);

    return {
      item,
      index,
      local,
      distance,
    };
  });

  const min = toLocalPoint(sceneMeta.origin, sceneMeta.bounds.southWest);
  const max = toLocalPoint(sceneMeta.origin, sceneMeta.bounds.northEast);
  const minX = Math.min(min.x, max.x);
  const maxX = Math.max(min.x, max.x);
  const minZ = Math.min(min.z, max.z);
  const maxZ = Math.max(min.z, max.z);
  const grid = Math.max(1, Math.ceil(Math.sqrt(maxCount)));
  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxZ - minZ);
  const buckets = new Map<string, typeof prepared>();

  for (const entry of prepared) {
    const cellX = clampCell(
      Math.floor(((entry.local.x - minX) / width) * grid),
      grid,
    );
    const cellZ = clampCell(
      Math.floor(((entry.local.z - minZ) / height) * grid),
      grid,
    );
    const key = `${cellX}:${cellZ}`;
    const current = buckets.get(key) ?? [];
    current.push(entry);
    buckets.set(key, current);
  }

  const selected = new Set<number>();
  const chosen = [...buckets.values()]
    .map(
      (values) =>
        [...values].sort((left, right) => {
          if (left.distance !== right.distance) {
            return left.distance - right.distance;
          }

          return left.index - right.index;
        })[0],
    )
    .filter((entry): entry is NonNullable<typeof entry> => entry !== undefined);

  for (const entry of chosen) {
    if (selected.size >= maxCount) {
      break;
    }
    selected.add(entry.index);
  }

  if (selected.size < maxCount) {
    for (const entry of [...prepared].sort((left, right) => {
      if (left.distance !== right.distance) {
        return left.distance - right.distance;
      }

      return left.index - right.index;
    })) {
      if (selected.size >= maxCount) {
        break;
      }
      selected.add(entry.index);
    }
  }

  return prepared
    .filter((entry) => selected.has(entry.index))
    .sort((left, right) => left.index - right.index)
    .map((entry) => entry.item);
}

export function selectPrioritizedSample<T>(
  items: T[],
  maxCount: number,
  priorityGroups: T[][],
  getPoint: (item: T) => Coordinate,
  sceneMeta: SceneArea,
): T[] {
  if (items.length <= maxCount) {
    return items;
  }

  const reserved = new Set<T>();
  const reservedItems: T[] = [];
  const orderedGroups = priorityGroups.map((group) => group.filter(Boolean));
  const cursors = new Array(orderedGroups.length).fill(0);

  while (reserved.size < maxCount) {
    let progressed = false;
    for (
      let groupIndex = 0;
      groupIndex < orderedGroups.length;
      groupIndex += 1
    ) {
      const group = orderedGroups[groupIndex];
      if (!group) {
        continue;
      }
      const cursor = cursors[groupIndex];
      if (cursor >= group.length) {
        continue;
      }
      const item = group[cursor];
      if (item === undefined) {
        continue;
      }
      cursors[groupIndex] = cursor + 1;
      progressed = true;
      if (reserved.has(item)) {
        continue;
      }
      reserved.add(item);
      reservedItems.push(item);
      if (reserved.size >= maxCount) {
        break;
      }
    }
    if (!progressed) {
      break;
    }
  }

  if (reservedItems.length >= maxCount) {
    return reservedItems.slice(0, maxCount);
  }

  const remaining = items.filter((item) => !reserved.has(item));
  const sampled = selectSpatialSample(
    remaining,
    maxCount - reservedItems.length,
    getPoint,
    sceneMeta,
  );

  return [...reservedItems, ...sampled].slice(0, maxCount);
}

export function selectItemsNearPoints<T>(
  items: T[],
  points: Coordinate[],
  getPath: (item: T) => Coordinate[],
  radiusMeters: number,
): T[] {
  if (points.length === 0) {
    return [];
  }

  return items.filter((item) =>
    getPath(item).some((pathPoint) =>
      points.some(
        (anchor) => distanceMeters(pathPoint, anchor) <= radiusMeters,
      ),
    ),
  );
}

export function selectItemsWithinRadius<T>(
  items: T[],
  anchor: Coordinate,
  getPoint: (item: T) => Coordinate,
  radiusMeters: number,
): T[] {
  return items.filter(
    (item) => distanceMeters(getPoint(item), anchor) <= radiusMeters,
  );
}

export function distanceMeters(a: Coordinate, b: Coordinate): number {
  const metersPerLat = 111_320;
  const metersPerLng =
    111_320 * Math.cos((((a.lat + b.lat) / 2) * Math.PI) / 180);
  return Math.hypot(
    (a.lat - b.lat) * metersPerLat,
    (a.lng - b.lng) * metersPerLng,
  );
}

function toLocalPoint(
  origin: Coordinate,
  point: Coordinate,
): { x: number; z: number } {
  const metersPerLat = 111_320;
  const metersPerLng = 111_320 * Math.cos((origin.lat * Math.PI) / 180);

  return {
    x: (point.lng - origin.lng) * metersPerLng,
    z: -(point.lat - origin.lat) * metersPerLat,
  };
}

function clampCell(value: number, grid: number): number {
  return Math.max(0, Math.min(grid - 1, value));
}
