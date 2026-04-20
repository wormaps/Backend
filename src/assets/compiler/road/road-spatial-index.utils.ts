import type { Coordinate } from '../../../places/types/place.types';
import type { SceneMeta } from '../../../scene/types/scene.types';
import { toLocalPoint } from './road-mesh.geometry.utils';

export interface RoadSpatialIndex {
  findNearest: (point: Coordinate) => { terrainOffset: number; distance: number };
}

export function buildRoadSpatialIndex(
  roads: SceneMeta['roads'],
  origin: Coordinate,
): RoadSpatialIndex {
  if (roads.length === 0) {
    return {
      findNearest: () => ({ terrainOffset: 0, distance: Number.POSITIVE_INFINITY }),
    };
  }

  const cellSize = 20;
  const grid = new Map<string, number[]>();

  function getCellKey(lat: number, lng: number): string {
    const cellLat = Math.floor(lat / (cellSize / 111_320));
    const cellLng = Math.floor(lng / (cellSize / (111_320 * Math.cos((lat * Math.PI) / 180))));
    return `${cellLat},${cellLng}`;
  }

  for (let i = 0; i < roads.length; i += 1) {
    const road = roads[i];
    if (!road) continue;
    for (const point of road.path) {
      const key = getCellKey(point.lat, point.lng);
      let cell = grid.get(key);
      if (!cell) {
        cell = [];
        grid.set(key, cell);
      }
      if (!cell.includes(i)) {
        cell.push(i);
      }
    }
  }

  function findNearest(point: Coordinate): { terrainOffset: number; distance: number } {
    const key = getCellKey(point.lat, point.lng);
    const candidates = new Set<number>();
    const [cellLat, cellLng] = key.split(',').map(Number);
    const clat = cellLat ?? 0;
    const clng = cellLng ?? 0;

    for (let dLat = -1; dLat <= 1; dLat += 1) {
      for (let dLng = -1; dLng <= 1; dLng += 1) {
        const neighborKey = `${clat + dLat},${clng + dLng}`;
        const cell = grid.get(neighborKey);
        if (cell) {
          for (const idx of cell) {
            candidates.add(idx);
          }
        }
      }
    }

    if (candidates.size === 0) {
      return { terrainOffset: 0, distance: Number.POSITIVE_INFINITY };
    }

    let nearestDistance = Number.POSITIVE_INFINITY;
    let nearestTerrainOffset = 0;

    for (const roadIndex of candidates) {
      const road = roads[roadIndex];
      if (!road) continue;
      const distance = distanceToPathMeters(point, road.path, origin);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestTerrainOffset = road.terrainOffsetM ?? 0;
      }
    }

    return { terrainOffset: nearestTerrainOffset, distance: nearestDistance };
  }

  return { findNearest };
}

function distanceToPathMeters(
  point: Coordinate,
  path: Coordinate[],
  origin: Coordinate,
): number {
  if (path.length < 2) {
    return Number.POSITIVE_INFINITY;
  }

  let minimum = Number.POSITIVE_INFINITY;
  for (let index = 0; index < path.length - 1; index += 1) {
    const segStart = path[index];
    const segEnd = path[index + 1];
    if (!segStart || !segEnd) continue;
    const start = toLocalPoint(origin, segStart);
    const end = toLocalPoint(origin, segEnd);
    if (!isFinite(start[0]) || !isFinite(start[2]) || !isFinite(end[0]) || !isFinite(end[2])) {
      continue;
    }
    minimum = Math.min(
      minimum,
      distancePointToSegment2d(
        [0, 0],
        [start[0], start[2]],
        [end[0], end[2]],
      ),
    );
  }
  return minimum;
}

function distancePointToSegment2d(
  point: [number, number],
  start: [number, number],
  end: [number, number],
): number {
  const abX = end[0] - start[0];
  const abY = end[1] - start[1];
  const apX = point[0] - start[0];
  const apY = point[1] - start[1];
  const denom = abX * abX + abY * abY;
  if (denom <= 1e-9) {
    return Math.hypot(apX, apY);
  }
  const t = Math.max(0, Math.min(1, (apX * abX + apY * abY) / denom));
  const closestX = start[0] + abX * t;
  const closestY = start[1] + abY * t;
  return Math.hypot(point[0] - closestX, point[1] - closestY);
}
