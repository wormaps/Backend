import { Injectable } from '@nestjs/common';
import { averageCoordinate } from '../../../common/geo/coordinate-utils.utils';
import { Coordinate } from '../../../places/types/place.types';
import {
  SceneBuildingMeta,
  SceneCrossingDetail,
  SceneDetail,
  SceneMeta,
} from '../../types/scene.types';
import {
  distanceMeters,
  selectItemsNearPoints,
  selectItemsWithinRadius,
  selectPrioritizedSample,
  selectSpatialSample,
} from './scene-asset-selection.utils';

export interface VisualArchetypeSelection {
  buildings: SceneBuildingMeta[];
  roads: SceneMeta['roads'];
  walkways: SceneMeta['walkways'];
  pois: SceneMeta['pois'];
  crossings: SceneCrossingDetail[];
  trafficLights: SceneDetail['streetFurniture'];
  streetLights: SceneDetail['streetFurniture'];
  signPoles: SceneDetail['streetFurniture'];
  vegetation: SceneDetail['vegetation'];
  billboardPanels: SceneDetail['signageClusters'];
}

@Injectable()
export class VisualArchetypeSelectionService {
  selectBuildings(
    sceneMeta: SceneMeta,
    buildingCount: number,
    coreRadiusMeters: number,
  ): SceneBuildingMeta[] {
    const allBuildingsWithDistance = sceneMeta.buildings.map((building) => {
      const center = averageCoordinate(building.outerRing) ?? sceneMeta.origin;
      return {
        ...building,
        _distanceM: distanceMeters(center, sceneMeta.origin),
      };
    });

    return selectPrioritizedSample(
      allBuildingsWithDistance,
      buildingCount,
      [
        selectItemsWithinRadius(
          allBuildingsWithDistance,
          sceneMeta.origin,
          (building) =>
            averageCoordinate(building.outerRing) ?? sceneMeta.origin,
          coreRadiusMeters,
        ),
        allBuildingsWithDistance.filter(
          (building) =>
            building.heightMeters >= 28 ||
            building.usage === 'COMMERCIAL' ||
            building.usage === 'TRANSIT',
        ),
        allBuildingsWithDistance.filter(
          (building) =>
            building.visualRole && building.visualRole !== 'generic',
        ),
      ],
      (building) => averageCoordinate(building.outerRing) ?? sceneMeta.origin,
      sceneMeta,
    ).map((building) => {
      const center = averageCoordinate(building.outerRing) ?? sceneMeta.origin;
      const dist = distanceMeters(center, sceneMeta.origin);
      const lodLevel: SceneBuildingMeta['lodLevel'] =
        dist <= 200 ? 'HIGH' : dist <= 400 ? 'MEDIUM' : 'LOW';
      return {
        ...building,
        lodLevel,
      };
    });
  }

  selectCrossings(
    items: SceneCrossingDetail[],
    maxCount: number,
    sceneMeta: Pick<SceneMeta, 'origin' | 'bounds'>,
    landmarkLocations: Coordinate[],
    coreRadiusMeters: number,
    sceneDetail: SceneDetail,
  ): SceneCrossingDetail[] {
    if (items.length <= maxCount) {
      return items;
    }

    const principal = items.filter((crossing) => crossing.principal);
    const decalIntersectionIds = new Set(
      (sceneDetail.roadDecals ?? [])
        .filter((decal) => decal.type === 'CROSSWALK_OVERLAY')
        .map((decal) => decal.intersectionId)
        .filter((value): value is string => Boolean(value)),
    );
    const decalAnchored = items.filter((crossing) =>
      decalIntersectionIds.has(`${crossing.objectId}-intersection`),
    );
    const signalized = items.filter((crossing) => crossing.signalized);
    const zebra = items.filter((crossing) => crossing.style === 'zebra');
    const anchorNear = selectItemsNearPoints(
      items,
      landmarkLocations,
      (crossing) => crossing.path,
      120,
    );
    return selectPrioritizedSample(
      items,
      maxCount,
      [
        principal,
        decalAnchored,
        signalized,
        zebra,
        anchorNear,
        selectItemsWithinRadius(
          items,
          sceneMeta.origin,
          (crossing) => crossing.center,
          coreRadiusMeters,
        ),
      ],
      (crossing) => crossing.center,
      sceneMeta,
    );
  }

  selectPathCollection<T>(
    items: T[],
    maxCount: number,
    getPath: (item: T) => Coordinate[],
    getPoint: (item: T) => Coordinate,
    sceneMeta: Pick<SceneMeta, 'origin' | 'bounds'>,
    priorityGroups: T[][],
    anchorPoints: Coordinate[],
    radiusMeters: number,
  ): T[] {
    return selectPrioritizedSample(
      items,
      maxCount,
      [
        ...priorityGroups,
        selectItemsNearPoints(items, anchorPoints, getPath, radiusMeters),
      ],
      getPoint,
      sceneMeta,
    );
  }

  selectWithSourceFloor<T>(
    items: T[],
    maxCount: number,
    getPoint: (item: T) => Coordinate,
    sceneMeta: Pick<SceneMeta, 'origin' | 'bounds'>,
  ): T[] {
    if (items.length === 0) {
      return [];
    }
    const minimumFloor = Math.max(1, Math.ceil(maxCount * 0.25));
    const floorCount = Math.min(items.length, minimumFloor);
    const effectiveMax = Math.max(maxCount, floorCount);
    return selectSpatialSample(items, effectiveMax, getPoint, sceneMeta);
  }

  selectPois(
    sceneMeta: SceneMeta,
    poiBudget: number,
  ): SceneMeta['pois'] {
    const landmarkPois = sceneMeta.pois.filter((poi) => poi.isLandmark);
    const remainingPois = sceneMeta.pois.filter((poi) => !poi.isLandmark);
    const effectiveBudget = Math.max(0, poiBudget - landmarkPois.length);
    const sampledPois = selectSpatialSample(
      remainingPois,
      effectiveBudget,
      (poi) => poi.location,
      sceneMeta,
    );
    return [...landmarkPois, ...sampledPois];
  }
}
