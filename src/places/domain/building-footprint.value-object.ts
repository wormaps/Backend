import type { Coordinate } from '../types/place.types';

const CENTROID_EPSILON = 1e-9;
export const SAME_FOOTPRINT_IOU_THRESHOLD = 0.85;

interface LocalPoint {
  x: number;
  y: number;
}

export interface BuildingFootprintBBox {
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
}

export type BBox = BuildingFootprintBBox;

export class BuildingFootprintVo {
  readonly outerRing: Coordinate[];

  constructor(outerRing: Coordinate[]) {
    const sanitized = sanitizeRing(outerRing);
    if (sanitized.length < 3) {
      throw new Error(
        'BuildingFootprintVo는 최소 3개의 유효한 좌표가 필요합니다.',
      );
    }
    this.outerRing = sanitized;
  }

  centroid(): Coordinate {
    const anchor = this.outerRing[0];
    const localRing = this.toLocalRing(anchor);

    let crossSum = 0;
    let centroidX = 0;
    let centroidY = 0;

    for (let i = 0; i < localRing.length; i += 1) {
      const current = localRing[i];
      const next = localRing[(i + 1) % localRing.length];
      const cross = current.x * next.y - next.x * current.y;
      crossSum += cross;
      centroidX += (current.x + next.x) * cross;
      centroidY += (current.y + next.y) * cross;
    }

    const signedArea = crossSum / 2;
    if (Math.abs(signedArea) <= CENTROID_EPSILON) {
      const avg = localRing.reduce(
        (acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }),
        { x: 0, y: 0 },
      );
      return toCoordinate(anchor, {
        x: avg.x / localRing.length,
        y: avg.y / localRing.length,
      });
    }

    return toCoordinate(anchor, {
      x: centroidX / (6 * signedArea),
      y: centroidY / (6 * signedArea),
    });
  }

  boundingBox(): BBox {
    let minLat = Number.POSITIVE_INFINITY;
    let minLng = Number.POSITIVE_INFINITY;
    let maxLat = Number.NEGATIVE_INFINITY;
    let maxLng = Number.NEGATIVE_INFINITY;

    for (const point of this.outerRing) {
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

  overlapRatio(other: BuildingFootprintVo): number {
    const reference = averageCoordinate([
      ...this.outerRing,
      ...other.outerRing,
    ]);
    const left = this.toLocalRing(reference);
    const right = other.toLocalRing(reference);
    const bounds = resolveUnionBounds(left, right);
    const width = Math.max(0.01, bounds.maxX - bounds.minX);
    const height = Math.max(0.01, bounds.maxY - bounds.minY);

    const longest = Math.max(width, height);
    const cellsPerAxis = Math.max(28, Math.min(180, Math.ceil(longest / 1.25)));
    const stepX = width / cellsPerAxis;
    const stepY = height / cellsPerAxis;

    let intersectionCount = 0;
    let unionCount = 0;

    for (let xIndex = 0; xIndex < cellsPerAxis; xIndex += 1) {
      for (let yIndex = 0; yIndex < cellsPerAxis; yIndex += 1) {
        const sample: LocalPoint = {
          x: bounds.minX + (xIndex + 0.5) * stepX,
          y: bounds.minY + (yIndex + 0.5) * stepY,
        };

        const inLeft = isPointInsidePolygon(sample, left);
        const inRight = isPointInsidePolygon(sample, right);
        if (!inLeft && !inRight) {
          continue;
        }
        unionCount += 1;
        if (inLeft && inRight) {
          intersectionCount += 1;
        }
      }
    }

    if (unionCount === 0) {
      return 0;
    }

    return roundMetric(intersectionCount / unionCount, 4);
  }

  isSameFootprint(other: BuildingFootprintVo, toleranceM: number): boolean {
    if (!Number.isFinite(toleranceM) || toleranceM < 0) {
      throw new Error('toleranceM은 0 이상의 유한 숫자여야 합니다.');
    }
    const centroidDistance = distanceMeters(this.centroid(), other.centroid());
    if (centroidDistance > toleranceM) {
      return false;
    }
    return this.overlapRatio(other) >= SAME_FOOTPRINT_IOU_THRESHOLD;
  }

  private toLocalRing(reference: Coordinate): LocalPoint[] {
    return this.outerRing.map((point) => toLocalPoint(reference, point));
  }
}

export type { Coordinate };

export function isSameBuildingFootprint(
  leftRing: Coordinate[],
  rightRing: Coordinate[],
  toleranceM: number,
): boolean {
  return new BuildingFootprintVo(leftRing).isSameFootprint(
    new BuildingFootprintVo(rightRing),
    toleranceM,
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
    return !previous || !coordinatesAlmostEqual(previous, point);
  });

  if (deduped.length > 2) {
    const first = deduped[0];
    const last = deduped[deduped.length - 1];
    if (coordinatesAlmostEqual(first, last)) {
      deduped.pop();
    }
  }

  return deduped;
}

function resolveUnionBounds(left: LocalPoint[], right: LocalPoint[]) {
  const all = [...left, ...right];
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const point of all) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
  };
}

function toLocalPoint(reference: Coordinate, point: Coordinate): LocalPoint {
  const metersPerLat = 111_320;
  const metersPerLng = 111_320 * Math.cos((reference.lat * Math.PI) / 180);
  return {
    x: (point.lng - reference.lng) * metersPerLng,
    y: (point.lat - reference.lat) * metersPerLat,
  };
}

function toCoordinate(reference: Coordinate, local: LocalPoint): Coordinate {
  const metersPerLat = 111_320;
  const metersPerLng = 111_320 * Math.cos((reference.lat * Math.PI) / 180);
  return {
    lat: reference.lat + local.y / metersPerLat,
    lng: reference.lng + local.x / metersPerLng,
  };
}

function distanceMeters(a: Coordinate, b: Coordinate): number {
  const metersPerLat = 111_320;
  const metersPerLng =
    111_320 * Math.cos((((a.lat + b.lat) / 2) * Math.PI) / 180);
  return Math.hypot(
    (a.lat - b.lat) * metersPerLat,
    (a.lng - b.lng) * metersPerLng,
  );
}

function isPointInsidePolygon(point: LocalPoint, polygon: LocalPoint[]): boolean {
  let inside = false;
  for (
    let i = 0, j = polygon.length - 1;
    i < polygon.length;
    j = i, i += 1
  ) {
    const current = polygon[i];
    const previous = polygon[j];
    if (isPointOnSegment(point, previous, current)) {
      return true;
    }

    const intersects =
      current.y > point.y !== previous.y > point.y &&
      point.x <
        ((previous.x - current.x) * (point.y - current.y)) /
          (previous.y - current.y + Number.EPSILON) +
          current.x;
    if (intersects) {
      inside = !inside;
    }
  }
  return inside;
}

function isPointOnSegment(
  point: LocalPoint,
  start: LocalPoint,
  end: LocalPoint,
): boolean {
  const cross =
    (point.y - start.y) * (end.x - start.x) -
    (point.x - start.x) * (end.y - start.y);
  if (Math.abs(cross) > 1e-7) {
    return false;
  }

  const dot =
    (point.x - start.x) * (end.x - start.x) +
    (point.y - start.y) * (end.y - start.y);
  if (dot < 0) {
    return false;
  }

  const squaredLength =
    (end.x - start.x) * (end.x - start.x) +
    (end.y - start.y) * (end.y - start.y);
  return dot <= squaredLength;
}

function averageCoordinate(points: Coordinate[]): Coordinate {
  const sums = points.reduce(
    (acc, point) => {
      acc.lat += point.lat;
      acc.lng += point.lng;
      return acc;
    },
    { lat: 0, lng: 0 },
  );
  return {
    lat: sums.lat / points.length,
    lng: sums.lng / points.length,
  };
}

function coordinatesAlmostEqual(a: Coordinate, b: Coordinate): boolean {
  return Math.abs(a.lat - b.lat) < 1e-9 && Math.abs(a.lng - b.lng) < 1e-9;
}

function roundMetric(value: number, precision: number): number {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}
