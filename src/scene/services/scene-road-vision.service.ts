import { Injectable } from '@nestjs/common';
import { midpoint } from '../../places/utils/geo.utils';
import type { ExternalPlaceDetail } from '../../places/types/external-place.types';
import type { Coordinate, PlacePackage } from '../../places/types/place.types';
import type {
  IntersectionProfile,
  SceneCrossingDetail,
  SceneIntersectionProfile,
  SceneRoadDecal,
  SceneRoadMarkingDetail,
} from '../types/scene.types';

@Injectable()
export class SceneRoadVisionService {
  buildCrossings(
    place: ExternalPlaceDetail,
    placePackage: PlacePackage,
  ): SceneCrossingDetail[] {
    return placePackage.crossings.map<SceneCrossingDetail>((crossing) => ({
      objectId: crossing.id,
      name: crossing.name,
      type: crossing.type,
      crossing: crossing.crossing,
      crossingRef: crossing.crossingRef,
      signalized: crossing.signalized,
      path: crossing.path,
      center: crossing.center,
      principal: this.isNearPlaceCenter(place.location, crossing.center, 60),
      style: crossing.signalized
        ? 'signalized'
        : crossing.crossing === 'zebra' || crossing.crossingRef === 'zebra'
          ? 'zebra'
          : 'unknown',
    }));
  }

  buildRoadMarkings(
    placePackage: PlacePackage,
    crossings: SceneCrossingDetail[],
  ): SceneRoadMarkingDetail[] {
    const laneLines = placePackage.roads.flatMap((road) => {
      if (road.laneCount < 2) {
        return [];
      }

      return [
        {
          objectId: `${road.id}-lane-line`,
          type: 'LANE_LINE' as const,
          color: '#f7f2a2',
          path: road.path,
        },
      ];
    });

    const crosswalks = crossings.map<SceneRoadMarkingDetail>((crossing) => ({
      objectId: `${crossing.objectId}-marking`,
      type: 'CROSSWALK',
      color: '#f5f5f5',
      path: crossing.path,
    }));

    const stopLines = crossings.map<SceneRoadMarkingDetail>((crossing) => ({
      objectId: `${crossing.objectId}-stop-line`,
      type: 'STOP_LINE',
      color: '#ffffff',
      path: crossing.path.slice(0, 2),
    }));

    return [...laneLines, ...crosswalks, ...stopLines];
  }

  buildIntersectionProfiles(
    place: ExternalPlaceDetail,
    crossings: SceneCrossingDetail[],
    placePackage: PlacePackage,
  ): SceneIntersectionProfile[] {
    return crossings.map((crossing) => {
      const nearRoadCount = placePackage.roads.filter(
        (road) => squaredDistance(midpoint(road.path) ?? place.location, crossing.center) <=
          28 ** 2,
      ).length;
      const profile: IntersectionProfile = crossing.principal
        ? 'scramble_major'
        : crossing.signalized || nearRoadCount >= 2
          ? 'signalized_standard'
          : 'minor_crossing';

      return {
        objectId: `${crossing.objectId}-intersection`,
        anchor: crossing.center,
        profile,
        crossingObjectIds: [crossing.objectId],
      };
    });
  }

  buildRoadDecals(
    placePackage: PlacePackage,
    crossings: SceneCrossingDetail[],
    roadMarkings: SceneRoadMarkingDetail[],
    intersectionProfiles: SceneIntersectionProfile[],
  ): SceneRoadDecal[] {
    const decals: SceneRoadDecal[] = [];

    for (const marking of roadMarkings) {
      decals.push({
        objectId: `${marking.objectId}-decal`,
        type:
          marking.type === 'LANE_LINE'
            ? 'LANE_OVERLAY'
            : marking.type === 'STOP_LINE'
              ? 'STOP_LINE'
              : 'CROSSWALK_OVERLAY',
        color: marking.color,
        emphasis: marking.type === 'CROSSWALK' ? 'hero' : 'standard',
        path: marking.path,
      });
    }

    for (const crossing of crossings) {
      if (!crossing.principal) {
        continue;
      }
      decals.push({
        objectId: `${crossing.objectId}-scramble-polygon`,
        type: 'CROSSWALK_OVERLAY',
        color: '#f8f8f6',
        emphasis: 'hero',
        polygon: buildBufferedCrossingPolygon(crossing.path, 9.5),
      });
    }

    for (const profile of intersectionProfiles) {
      if (profile.profile !== 'scramble_major') {
        continue;
      }
      decals.push({
        objectId: `${profile.objectId}-junction`,
        type: 'JUNCTION_OVERLAY',
        color: '#f1df8a',
        emphasis: 'hero',
        polygon: buildDiamondPolygon(profile.anchor, 10),
      });
    }

    if (decals.length === 0 && placePackage.roads.length > 0) {
      const primaryRoad = placePackage.roads[0];
      decals.push({
        objectId: `${primaryRoad.id}-fallback-lane`,
        type: 'LANE_OVERLAY',
        color: '#f7f2a2',
        emphasis: 'standard',
        path: primaryRoad.path,
      });
    }

    return decals;
  }

  isNearPlaceCenter(
    origin: Coordinate,
    point: Coordinate,
    radiusMeters: number,
  ): boolean {
    return squaredDistance(origin, point) <= radiusMeters ** 2;
  }
}

function squaredDistance(a: Coordinate, b: Coordinate): number {
  const dx = (a.lng - b.lng) * 111_320;
  const dy = (a.lat - b.lat) * 111_320;
  return dx * dx + dy * dy;
}

function buildBufferedCrossingPolygon(
  path: Coordinate[],
  widthMeters: number,
): Coordinate[] | undefined {
  if (path.length < 2) {
    return undefined;
  }
  const start = path[0];
  const end = path[path.length - 1];
  const dx = end.lng - start.lng;
  const dy = end.lat - start.lat;
  const metersPerLng = 111_320 * Math.cos((((start.lat + end.lat) / 2) * Math.PI) / 180);
  const length = Math.hypot(dx * metersPerLng, dy * 111_320);
  if (length <= 1e-6) {
    return undefined;
  }
  const nx = (-(dy * 111_320) / length) * (widthMeters / metersPerLng);
  const ny = ((dx * metersPerLng) / length) * (widthMeters / 111_320);

  return [
    { lat: start.lat - ny, lng: start.lng - nx },
    { lat: end.lat - ny, lng: end.lng - nx },
    { lat: end.lat + ny, lng: end.lng + nx },
    { lat: start.lat + ny, lng: start.lng + nx },
  ];
}

function buildDiamondPolygon(center: Coordinate, radiusMeters: number): Coordinate[] {
  const latDelta = radiusMeters / 111_320;
  const lngDelta =
    radiusMeters / (111_320 * Math.cos((center.lat * Math.PI) / 180));

  return [
    { lat: center.lat + latDelta, lng: center.lng },
    { lat: center.lat, lng: center.lng + lngDelta },
    { lat: center.lat - latDelta, lng: center.lng },
    { lat: center.lat, lng: center.lng - lngDelta },
  ];
}
