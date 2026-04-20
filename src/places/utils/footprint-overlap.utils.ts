import type { Coordinate } from '../types/place.types';
import { BuildingFootprintVo } from '../domain/building-footprint.value-object';

export interface FootprintOverlapResult {
  iou: number;
  intersectionM2: number;
  unionM2: number;
}

export interface FootprintBounds {
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
}

const METERS_PER_LAT = 111_320;

export function calculateFootprintIoU(
  ringA: Coordinate[],
  ringB: Coordinate[],
): FootprintOverlapResult {
  const left = new BuildingFootprintVo(ringA);
  const right = new BuildingFootprintVo(ringB);
  const iou = left.overlapRatio(right);
  const areaA = calculatePolygonAreaM2(left.outerRing);
  const areaB = calculatePolygonAreaM2(right.outerRing);

  if (iou <= 0) {
    return {
      iou: 0,
      intersectionM2: 0,
      unionM2: roundMetric(areaA + areaB, 4),
    };
  }

  const union = (areaA + areaB) / (1 + iou);
  const intersection = union * iou;

  return {
    iou: roundMetric(iou, 4),
    intersectionM2: roundMetric(intersection, 4),
    unionM2: roundMetric(union, 4),
  };
}

export function calculatePolygonAreaM2(ring: Coordinate[]): number {
  const normalized = sanitizeRing(ring);
  if (normalized.length < 3) {
    return 0;
  }

  const anchor = normalized[0]!;
  const metersPerLng =
    METERS_PER_LAT * Math.cos((anchor.lat * Math.PI) / 180);

  let signedArea = 0;
  for (let i = 0; i < normalized.length; i += 1) {
    const current = normalized[i]!;
    const next = normalized[(i + 1) % normalized.length]!;
    const currentX = (current.lng - anchor.lng) * metersPerLng;
    const currentY = (current.lat - anchor.lat) * METERS_PER_LAT;
    const nextX = (next.lng - anchor.lng) * metersPerLng;
    const nextY = (next.lat - anchor.lat) * METERS_PER_LAT;
    signedArea += currentX * nextY - nextX * currentY;
  }

  return roundMetric(Math.abs(signedArea / 2), 4);
}

export function calculateDistanceMeters(a: Coordinate, b: Coordinate): number {
  const metersPerLng =
    METERS_PER_LAT * Math.cos((((a.lat + b.lat) / 2) * Math.PI) / 180);
  return Math.hypot(
    (a.lat - b.lat) * METERS_PER_LAT,
    (a.lng - b.lng) * metersPerLng,
  );
}

export function resolveFootprintBounds(ring: Coordinate[]): FootprintBounds {
  let minLat = Number.POSITIVE_INFINITY;
  let minLng = Number.POSITIVE_INFINITY;
  let maxLat = Number.NEGATIVE_INFINITY;
  let maxLng = Number.NEGATIVE_INFINITY;

  for (const point of ring) {
    minLat = Math.min(minLat, point.lat);
    minLng = Math.min(minLng, point.lng);
    maxLat = Math.max(maxLat, point.lat);
    maxLng = Math.max(maxLng, point.lng);
  }

  return {
    minLat,
    minLng,
    maxLat,
    maxLng,
  };
}

export function areBoundsOverlapping(
  left: FootprintBounds,
  right: FootprintBounds,
): boolean {
  return !(
    left.maxLat < right.minLat ||
    right.maxLat < left.minLat ||
    left.maxLng < right.minLng ||
    right.maxLng < left.minLng
  );
}

function sanitizeRing(ring: Coordinate[]): Coordinate[] {
  const finite = ring
    .map((point) => ({ lat: Number(point.lat), lng: Number(point.lng) }))
    .filter(
      (point) => Number.isFinite(point.lat) && Number.isFinite(point.lng),
    );
  const deduped = finite.filter((point, index) => {
    const previous = finite[index - 1];
    return !previous || previous.lat !== point.lat || previous.lng !== point.lng;
  });

  if (deduped.length > 2) {
    const first = deduped[0]!;
    const last = deduped[deduped.length - 1]!;
    if (first.lat === last.lat && first.lng === last.lng) {
      deduped.pop();
    }
  }

  return deduped;
}

function roundMetric(value: number, precision: number): number {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}
