import { Injectable } from '@nestjs/common';
import { appendSceneDiagnosticsLog } from '../../storage/scene-storage.utils';
import type {
  SceneDetail,
  SceneMeta,
  SceneRoadMeta,
  SceneBuildingMeta,
} from '../../types/scene.types';

interface GeometryCorrectionResult {
  meta: SceneMeta;
  detail: SceneDetail;
}

interface GeometryCorrectionDiagnostic {
  objectId: '__geometry_correction__';
  strategy: 'fallback_massing';
  fallbackApplied: boolean;
  fallbackReason: 'NONE';
  hasHoles: false;
  polygonComplexity: 'simple';
  collisionRiskCount: number;
  groundedGapCount: number;
  averageGroundOffsetM: number;
  maxGroundOffsetM: number;
  openShellCount: number;
  roofWallGapCount: number;
  invalidSetbackJoinCount: number;
}

const COLLISION_NEAR_ROAD_METERS = 1.6;
const BASE_GROUND_OFFSET_ON_COLLISION_METERS = 0.06;
const MAX_GROUND_OFFSET_ON_COLLISION_METERS = 0.24;
const SEVERE_GROUNDED_GAP_OFFSET_THRESHOLD = 0.16;
const MIN_RING_VERTICES_FOR_CLOSURE = 3;
const MIN_SETBACK_USABLE_VERTICES = 3;
const MAX_SAFE_SETBACK_LEVELS_WITHOUT_COLLAPSE = 3;

@Injectable()
export class SceneGeometryCorrectionStep {
  execute(meta: SceneMeta, detail: SceneDetail): GeometryCorrectionResult {
    const roads = meta.roads;
    const correctedBuildings = meta.buildings.map((building) =>
      this.correctBuilding(building, roads),
    );

    const collisionRiskCount = correctedBuildings.filter(
      (building) => building.collisionRisk === 'road_overlap',
    ).length;
    const groundedGapCount = correctedBuildings.filter(
      (building) =>
        (building.groundOffsetM ?? 0) > SEVERE_GROUNDED_GAP_OFFSET_THRESHOLD,
    ).length;
    const appliedGroundOffsets = correctedBuildings
      .map((building) => building.groundOffsetM ?? 0)
      .filter((offset) => offset > 0);
    const averageGroundOffsetM =
      appliedGroundOffsets.length > 0
        ? Number(
            (
              appliedGroundOffsets.reduce((sum, value) => sum + value, 0) /
              appliedGroundOffsets.length
            ).toFixed(3),
          )
        : 0;
    const maxGroundOffsetM =
      appliedGroundOffsets.length > 0
        ? Number(Math.max(...appliedGroundOffsets).toFixed(3))
        : 0;
    const closureDiagnostics =
      this.resolveClosureDiagnostics(correctedBuildings);
    const { openShellCount, roofWallGapCount, invalidSetbackJoinCount } =
      closureDiagnostics;

    const correctedMeta: SceneMeta = {
      ...meta,
      buildings: correctedBuildings,
    };
    const existingDiagnostics = detail.geometryDiagnostics ?? [];
    const correctedDetail: SceneDetail = {
      ...detail,
      geometryDiagnostics: [
        ...existingDiagnostics,
        {
          objectId: '__geometry_correction__',
          strategy: 'fallback_massing',
          fallbackApplied:
            collisionRiskCount > 0 ||
            groundedGapCount > 0 ||
            openShellCount > 0 ||
            roofWallGapCount > 0 ||
            invalidSetbackJoinCount > 0,
          fallbackReason: 'NONE',
          hasHoles: false,
          polygonComplexity: 'simple',
          collisionRiskCount,
          groundedGapCount,
          averageGroundOffsetM,
          maxGroundOffsetM,
          openShellCount,
          roofWallGapCount,
          invalidSetbackJoinCount,
        } as GeometryCorrectionDiagnostic,
      ],
    };

    void appendSceneDiagnosticsLog(meta.sceneId, 'geometry_correction', {
      collisionRiskCount,
      groundedGapCount,
      averageGroundOffsetM,
      maxGroundOffsetM,
      openShellCount,
      roofWallGapCount,
      invalidSetbackJoinCount,
      buildingCount: correctedBuildings.length,
      correctedCount: correctedBuildings.filter(
        (building) => building.collisionRisk === 'road_overlap',
      ).length,
    });

    return {
      meta: correctedMeta,
      detail: correctedDetail,
    };
  }

  private resolveClosureDiagnostics(buildings: SceneBuildingMeta[]): {
    openShellCount: number;
    roofWallGapCount: number;
    invalidSetbackJoinCount: number;
  } {
    let openShellCount = 0;
    let roofWallGapCount = 0;
    let invalidSetbackJoinCount = 0;

    for (const building of buildings) {
      const vertexCount = normalizeRingVertexCount(building.outerRing.length);
      if (vertexCount < MIN_RING_VERTICES_FOR_CLOSURE) {
        openShellCount += 1;
      }

      if (building.roofType === 'gable' && vertexCount < 4) {
        roofWallGapCount += 1;
      }

      const setbackLevels = Math.max(0, building.setbackLevels ?? 0);
      if (setbackLevels > 0) {
        const estimatedRemaining = Math.max(0, vertexCount - setbackLevels);
        const likelyInvalidJoin =
          estimatedRemaining < MIN_SETBACK_USABLE_VERTICES ||
          setbackLevels > MAX_SAFE_SETBACK_LEVELS_WITHOUT_COLLAPSE;
        if (likelyInvalidJoin) {
          invalidSetbackJoinCount += 1;
        }
      }
    }

    return {
      openShellCount,
      roofWallGapCount,
      invalidSetbackJoinCount,
    };
  }

  private correctBuilding(
    building: SceneBuildingMeta,
    roads: SceneRoadMeta[],
  ): SceneBuildingMeta {
    const anchors = resolveBuildingAnchors(building.outerRing);
    if (anchors.length === 0) {
      return {
        ...building,
        collisionRisk: 'none',
        groundOffsetM: 0,
      };
    }

    const nearestRoadDistance = anchors.reduce<number>((minimum, anchor) => {
      const anchorDistance = roads.reduce<number>((anchorMinimum, road) => {
        const distance = distanceToPathMeters(anchor, road.path);
        return Math.min(anchorMinimum, distance);
      }, Number.POSITIVE_INFINITY);
      return Math.min(minimum, anchorDistance);
    }, Number.POSITIVE_INFINITY);

    const minClearance = this.resolveRoadClearanceThreshold(roads, anchors);
    const nearRoad = Number.isFinite(nearestRoadDistance)
      ? nearestRoadDistance < minClearance
      : false;
    const collisionRisk = nearRoad ? 'road_overlap' : 'none';
    const gapRatio = nearRoad
      ? clamp01(
          (minClearance - nearestRoadDistance) / Math.max(0.25, minClearance),
        )
      : 0;
    const dynamicGroundOffset = Number(
      (
        BASE_GROUND_OFFSET_ON_COLLISION_METERS +
        gapRatio *
          (MAX_GROUND_OFFSET_ON_COLLISION_METERS -
            BASE_GROUND_OFFSET_ON_COLLISION_METERS)
      ).toFixed(3),
    );
    const groundOffsetM = nearRoad ? dynamicGroundOffset : 0;

    return {
      ...building,
      collisionRisk,
      groundOffsetM,
    };
  }

  private resolveRoadClearanceThreshold(
    roads: SceneRoadMeta[],
    anchors: Array<{ lat: number; lng: number }>,
  ): number {
    let nearestRoad: SceneRoadMeta | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;

    for (const road of roads) {
      const distance = anchors.reduce<number>((minimum, anchor) => {
        const candidate = distanceToPathMeters(anchor, road.path);
        return Math.min(minimum, candidate);
      }, Number.POSITIVE_INFINITY);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestRoad = road;
      }
    }

    if (!nearestRoad) {
      return COLLISION_NEAR_ROAD_METERS;
    }

    const laneWidthEstimate = Math.max(
      2.8,
      Math.min(
        4.2,
        nearestRoad.widthMeters / Math.max(1, nearestRoad.laneCount),
      ),
    );
    return Math.max(
      1,
      Math.min(COLLISION_NEAR_ROAD_METERS, laneWidthEstimate * 0.48),
    );
  }
}

function resolveBuildingAnchors(
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

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function averageCoordinate(
  points: Array<{ lat: number; lng: number }>,
): { lat: number; lng: number } | null {
  if (points.length === 0) {
    return null;
  }

  const sum = points.reduce(
    (acc, point) => ({
      lat: acc.lat + point.lat,
      lng: acc.lng + point.lng,
    }),
    { lat: 0, lng: 0 },
  );

  return {
    lat: sum.lat / points.length,
    lng: sum.lng / points.length,
  };
}

function distanceToPathMeters(
  point: { lat: number; lng: number },
  path: Array<{ lat: number; lng: number }>,
): number {
  if (path.length === 0) {
    return Number.POSITIVE_INFINITY;
  }
  if (path.length === 1) {
    return distanceMeters(point, path[0]);
  }

  let minDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < path.length - 1; index += 1) {
    const start = path[index];
    const end = path[index + 1];
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

function distanceMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const metersPerLat = 111_320;
  const metersPerLng =
    111_320 * Math.cos((((a.lat + b.lat) / 2) * Math.PI) / 180);
  return Math.hypot(
    (a.lat - b.lat) * metersPerLat,
    (a.lng - b.lng) * metersPerLng,
  );
}

function normalizeRingVertexCount(count: number): number {
  return Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
}
