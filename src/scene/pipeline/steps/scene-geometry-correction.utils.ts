import type { SceneMeta } from '../../types/scene.types';
import { distanceMeters } from '../../../common/geo/distance.utils';
import { averageCoordinate } from '../../../common/geo/coordinate-utils.utils';
export { averageCoordinate, distanceMeters };

const TERRAIN_RELIEF_SCALE = 0.5;

export function resolveTerrainHeightForPoints(
  meta: SceneMeta,
  points: Array<{ lat: number; lng: number }>,
): number | undefined {
  const terrainProfile = meta.terrainProfile;
  if (!terrainProfile || terrainProfile.samples.length === 0) {
    return undefined;
  }

  const anchors = points.length > 0 ? points : [meta.origin];
  const heights = anchors
    .map((point) => sampleTerrainHeight(meta, point))
    .filter((value): value is number => Number.isFinite(value));

  if (heights.length === 0) {
    return undefined;
  }
  return Number(
    (heights.reduce((sum, value) => sum + value, 0) / heights.length).toFixed(
      3,
    ),
  );
}

export function resolveTerrainOffsetForPoints(
  meta: SceneMeta,
  points: Array<{ lat: number; lng: number }>,
): number {
  const terrainProfile = meta.terrainProfile;
  if (!terrainProfile || terrainProfile.samples.length === 0) {
    return 0;
  }

  const sampledHeight = resolveTerrainHeightForPoints(meta, points);
  if (!Number.isFinite(sampledHeight)) {
    return 0;
  }

  const delta = (sampledHeight ?? 0) - terrainProfile.baseHeightMeters;
  return Number((delta * TERRAIN_RELIEF_SCALE).toFixed(3));
}

export function sampleTerrainHeight(
  meta: SceneMeta,
  point: { lat: number; lng: number },
): number | null {
  const terrainProfile = meta.terrainProfile;
  if (!terrainProfile || terrainProfile.samples.length === 0) {
    return null;
  }

  const weighted = terrainProfile.samples
    .map((sample) => {
      const distance = distanceMeters(point, sample.location);
      const weight = 1 / Math.max(0.5, distance);
      return {
        heightMeters: sample.heightMeters,
        weight,
      };
    })
    .sort((left, right) => right.weight - left.weight)
    .slice(0, 4);

  const totalWeight = weighted.reduce((sum, item) => sum + item.weight, 0);
  if (totalWeight <= 0) {
    return null;
  }

  return (
    weighted.reduce((sum, item) => sum + item.heightMeters * item.weight, 0) /
    totalWeight
  );
}

export function resolveBuildingAnchors(
  points: Array<{ lat: number; lng: number }>,
): Array<{ lat: number; lng: number }> {
  const anchors: Array<{ lat: number; lng: number }> = [];
  const center = averageCoordinate(points);
  if (center) {
    anchors.push(center);
  }
  anchors.push(...points);

  const uniqueAnchors = new Map<string, { lat: number; lng: number }>();
  for (const anchor of anchors) {
    const key = `${anchor.lat.toFixed(7)}:${anchor.lng.toFixed(7)}`;
    if (!uniqueAnchors.has(key)) {
      uniqueAnchors.set(key, anchor);
    }
  }
  return [...uniqueAnchors.values()];
}

export function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function distanceToPathMeters(
  point: { lat: number; lng: number },
  path: Array<{ lat: number; lng: number }>,
): number {
  if (path.length === 0) {
    return Number.POSITIVE_INFINITY;
  }
  if (path.length === 1) {
    const single = path[0];
    if (!single) return Number.POSITIVE_INFINITY;
    return distanceMeters(point, single);
  }

  let minDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < path.length - 1; index += 1) {
    const start = path[index];
    const end = path[index + 1];
    if (!start || !end) continue;
    const dist = distanceToSegmentMeters(point, start, end);
    if (dist < minDistance) {
      minDistance = dist;
    }
  }

  return minDistance;
}

function distanceToSegmentMeters(
  point: { lat: number; lng: number },
  start: { lat: number; lng: number },
  end: { lat: number; lng: number },
): number {
  const metersPerLat = 111_320;
  const metersPerLng =
    111_320 * Math.cos((((start.lat + end.lat) / 2) * Math.PI) / 180);
  const ax = start.lng * metersPerLng;
  const ay = start.lat * metersPerLat;
  const bx = end.lng * metersPerLng;
  const by = end.lat * metersPerLat;
  const px = point.lng * metersPerLng;
  const py = point.lat * metersPerLat;

  const vx = bx - ax;
  const vy = by - ay;
  const wx = px - ax;
  const wy = py - ay;
  const len2 = vx * vx + vy * vy;
  if (len2 <= 1e-6) {
    return Math.hypot(px - ax, py - ay);
  }
  const t = Math.max(0, Math.min(1, (wx * vx + wy * vy) / len2));
  const cx = ax + vx * t;
  const cy = ay + vy * t;
  return Math.hypot(px - cx, py - cy);
}

export function normalizeRingVertexCount(count: number): number {
  return Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
}
