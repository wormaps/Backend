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
}

const COLLISION_NEAR_ROAD_METERS = 2.4;
const GROUND_OFFSET_ON_COLLISION_METERS = 0.06;

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
      (building) => (building.groundOffsetM ?? 0) > 0.06,
    ).length;

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
          fallbackApplied: collisionRiskCount > 0 || groundedGapCount > 0,
          fallbackReason: 'NONE',
          hasHoles: false,
          polygonComplexity: 'simple',
          collisionRiskCount,
          groundedGapCount,
        } as GeometryCorrectionDiagnostic,
      ],
    };

    void appendSceneDiagnosticsLog(meta.sceneId, 'geometry_correction', {
      collisionRiskCount,
      groundedGapCount,
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

  private correctBuilding(
    building: SceneBuildingMeta,
    roads: SceneRoadMeta[],
  ): SceneBuildingMeta {
    const center = averageCoordinate(building.outerRing);
    if (!center) {
      return {
        ...building,
        collisionRisk: 'none',
        groundOffsetM: 0,
      };
    }

    const nearestRoadDistance = roads.reduce<number>((minimum, road) => {
      const distance = distanceToPathMeters(center, road.path);
      return Math.min(minimum, distance);
    }, Number.POSITIVE_INFINITY);

    const nearRoad = Number.isFinite(nearestRoadDistance)
      ? nearestRoadDistance < COLLISION_NEAR_ROAD_METERS
      : false;
    const collisionRisk = nearRoad ? 'road_overlap' : 'none';
    const groundOffsetM = nearRoad ? GROUND_OFFSET_ON_COLLISION_METERS : 0;

    return {
      ...building,
      collisionRisk,
      groundOffsetM,
    };
  }
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
