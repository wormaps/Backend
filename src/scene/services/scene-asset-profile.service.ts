import { Injectable } from '@nestjs/common';
import { Coordinate } from '../../places/types/place.types';
import { midpoint } from '../../places/utils/geo.utils';
import {
  SceneBuildingMeta,
  SceneCrossingDetail,
  SceneDetail,
  SceneMeta,
  ScenePoiMeta,
  SceneRoadMeta,
  SceneScale,
  SceneStreetFurnitureDetail,
  SceneVegetationDetail,
  SceneWalkwayMeta,
} from '../types/scene.types';

export interface SceneAssetSelection {
  buildings: SceneBuildingMeta[];
  roads: SceneRoadMeta[];
  walkways: SceneWalkwayMeta[];
  pois: ScenePoiMeta[];
  crossings: SceneCrossingDetail[];
  trafficLights: SceneStreetFurnitureDetail[];
  streetLights: SceneStreetFurnitureDetail[];
  signPoles: SceneStreetFurnitureDetail[];
  vegetation: SceneVegetationDetail[];
  billboardPanels: SceneDetail['signageClusters'];
  budget: SceneMeta['assetProfile']['budget'];
  selected: SceneMeta['assetProfile']['selected'];
  structuralCoverage: SceneMeta['structuralCoverage'];
}

@Injectable()
export class SceneAssetProfileService {
  buildSceneAssetSelection(
    sceneMeta: SceneMeta,
    sceneDetail: SceneDetail,
    scale: SceneScale,
  ): SceneAssetSelection {
    const budget = this.resolveAssetBudget(scale);
    const landmarkLocations = sceneMeta.landmarkAnchors.map((anchor) => anchor.location);
    const coreRadiusMeters = scale === 'MEDIUM' ? 230 : 150;
    const crossingCoreRadiusMeters = scale === 'MEDIUM' ? 320 : 160;
    const roadCoreRadiusMeters = scale === 'MEDIUM' ? 360 : 180;
    const walkwayCoreRadiusMeters = scale === 'MEDIUM' ? 320 : 170;

    const buildings = this.selectPrioritizedSample(
      sceneMeta.buildings,
      budget.buildingCount,
      [
        this.selectItemsWithinRadius(
          sceneMeta.buildings,
          sceneMeta.origin,
          (building) => averageCoordinate(building.outerRing) ?? sceneMeta.origin,
          coreRadiusMeters,
        ),
        sceneMeta.buildings.filter(
          (building) =>
            building.heightMeters >= 28 ||
            building.usage === 'COMMERCIAL' ||
            building.usage === 'TRANSIT',
        ),
        sceneMeta.buildings.filter(
          (building) => building.visualRole && building.visualRole !== 'generic',
        ),
      ],
      (building) => averageCoordinate(building.outerRing) ?? sceneMeta.origin,
      sceneMeta,
    );
    const crossings = this.selectCrossings(
      sceneDetail.crossings,
      budget.crossingCount,
      sceneMeta,
      landmarkLocations,
      crossingCoreRadiusMeters,
    );
    const priorityRoadAnchors = uniqueCoordinates([
      sceneMeta.origin,
      ...landmarkLocations,
      ...crossings.filter((crossing) => crossing.principal).map((crossing) => crossing.center),
    ]);
    const roads = this.selectPathCollection(
      sceneMeta.roads,
      budget.roadCount,
      (road) => road.path,
      (road) => road.center,
      sceneMeta,
      [
        this.selectItemsWithinRadius(
          sceneMeta.roads,
          sceneMeta.origin,
          (road) => road.center,
          roadCoreRadiusMeters,
        ),
        sceneMeta.roads.filter(
          (road) =>
            road.roadClass.includes('primary') ||
            road.roadClass.includes('trunk') ||
            road.widthMeters >= 12,
        ),
      ],
      priorityRoadAnchors,
          240,
    );
    const walkways = this.selectPathCollection(
      sceneMeta.walkways,
      budget.walkwayCount,
      (walkway) => walkway.path,
      (walkway) => midpoint(walkway.path) ?? sceneMeta.origin,
      sceneMeta,
      [
        this.selectItemsWithinRadius(
          sceneMeta.walkways,
          sceneMeta.origin,
          (walkway) => midpoint(walkway.path) ?? sceneMeta.origin,
          walkwayCoreRadiusMeters,
        ),
        this.selectItemsNearPoints(
          sceneMeta.walkways,
          crossings.map((crossing) => crossing.center),
          (walkway) => walkway.path,
          120,
        ),
      ],
      priorityRoadAnchors,
      220,
    );
    const landmarkPois = sceneMeta.pois.filter((poi) => poi.isLandmark);
    const remainingPois = sceneMeta.pois.filter((poi) => !poi.isLandmark);
    const poiBudget = Math.max(0, budget.poiCount - landmarkPois.length);
    const sampledPois = this.selectSpatialSample(
      remainingPois,
      poiBudget,
      (poi) => poi.location,
      sceneMeta,
    );
    const pois = [...landmarkPois, ...sampledPois];
    const trafficLights = this.selectSpatialSample(
      sceneDetail.streetFurniture.filter((item) => item.type === 'TRAFFIC_LIGHT'),
      budget.trafficLightCount,
      (item) => item.location,
      sceneMeta,
    );
    const streetLights = this.selectSpatialSample(
      sceneDetail.streetFurniture.filter((item) => item.type === 'STREET_LIGHT'),
      budget.streetLightCount,
      (item) => item.location,
      sceneMeta,
    );
    const signPoles = this.selectSpatialSample(
      sceneDetail.streetFurniture.filter((item) => item.type === 'SIGN_POLE'),
      budget.signPoleCount,
      (item) => item.location,
      sceneMeta,
    );
    const vegetation = this.selectSpatialSample(
      sceneDetail.vegetation,
      budget.treeClusterCount,
      (item) => item.location,
      sceneMeta,
    );
    const billboardPanels = this.selectSpatialSample(
      sceneDetail.signageClusters,
      budget.billboardPanelCount,
      (item) => item.anchor,
      sceneMeta,
    );
    const structuralCoverage = this.buildStructuralCoverage(
      sceneMeta,
      buildings,
      coreRadiusMeters,
    );

    return {
      buildings,
      roads,
      walkways,
      pois,
      crossings,
      trafficLights,
      streetLights,
      signPoles,
      vegetation,
      billboardPanels,
      budget,
      selected: {
        buildingCount: buildings.length,
        roadCount: roads.length,
        walkwayCount: walkways.length,
        poiCount: pois.length,
        crossingCount: crossings.length,
        trafficLightCount: trafficLights.length,
        streetLightCount: streetLights.length,
        signPoleCount: signPoles.length,
        treeClusterCount: vegetation.length,
        billboardPanelCount: billboardPanels.length,
      },
      structuralCoverage,
    };
  }

  private resolveAssetBudget(scale: SceneScale): SceneMeta['assetProfile']['budget'] {
    if (scale === 'SMALL') {
      return {
        buildingCount: 300,
        roadCount: 220,
        walkwayCount: 300,
        poiCount: 140,
        crossingCount: 32,
        trafficLightCount: 24,
        streetLightCount: 36,
        signPoleCount: 48,
        treeClusterCount: 40,
        billboardPanelCount: 72,
      };
    }

    if (scale === 'LARGE') {
      return {
        buildingCount: 1800,
        roadCount: 900,
        walkwayCount: 1100,
        poiCount: 340,
        crossingCount: 140,
        trafficLightCount: 140,
        streetLightCount: 200,
        signPoleCount: 240,
        treeClusterCount: 160,
        billboardPanelCount: 280,
      };
    }

    return {
      buildingCount: 1500,
      roadCount: 800,
      walkwayCount: 950,
      poiCount: 320,
      crossingCount: 120,
      trafficLightCount: 120,
      streetLightCount: 160,
      signPoleCount: 220,
      treeClusterCount: 120,
      billboardPanelCount: 220,
    };
  }

  private selectSpatialSample<T>(
    items: T[],
    maxCount: number,
    getPoint: (item: T) => Coordinate,
    sceneMeta: Pick<SceneMeta, 'origin' | 'bounds'>,
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
      .map((values) =>
        [...values].sort((left, right) => {
          if (left.distance !== right.distance) {
            return left.distance - right.distance;
          }

          return left.index - right.index;
        })[0],
      )
      .filter(Boolean);

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

  private selectCrossings(
    items: SceneCrossingDetail[],
    maxCount: number,
    sceneMeta: Pick<SceneMeta, 'origin' | 'bounds'>,
    landmarkLocations: Coordinate[],
    coreRadiusMeters: number,
  ): SceneCrossingDetail[] {
    return this.selectPrioritizedSample(
      items,
      maxCount,
      [
        items.filter((crossing) => crossing.principal),
        this.selectItemsNearPoints(
          items,
          landmarkLocations,
          (crossing) => crossing.path,
          120,
        ),
        this.selectItemsWithinRadius(
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

  private selectPathCollection<T>(
    items: T[],
    maxCount: number,
    getPath: (item: T) => Coordinate[],
    getPoint: (item: T) => Coordinate,
    sceneMeta: Pick<SceneMeta, 'origin' | 'bounds'>,
    priorityGroups: T[][],
    anchorPoints: Coordinate[],
    radiusMeters: number,
  ): T[] {
    return this.selectPrioritizedSample(
      items,
      maxCount,
      [
        ...priorityGroups,
        this.selectItemsNearPoints(items, anchorPoints, getPath, radiusMeters),
      ],
      getPoint,
      sceneMeta,
    );
  }

  private selectPrioritizedSample<T>(
    items: T[],
    maxCount: number,
    priorityGroups: T[][],
    getPoint: (item: T) => Coordinate,
    sceneMeta: Pick<SceneMeta, 'origin' | 'bounds'>,
  ): T[] {
    if (items.length <= maxCount) {
      return items;
    }

    const reserved = new Set<T>();
    const reservedItems: T[] = [];
    for (const group of priorityGroups) {
      for (const item of group) {
        if (reserved.size >= maxCount) {
          break;
        }
        if (reserved.has(item)) {
          continue;
        }
        reserved.add(item);
        reservedItems.push(item);
      }
      if (reserved.size >= maxCount) {
        break;
      }
    }

    if (reservedItems.length >= maxCount) {
      return reservedItems.slice(0, maxCount);
    }

    const remaining = items.filter((item) => !reserved.has(item));
    const sampled = this.selectSpatialSample(
      remaining,
      maxCount - reservedItems.length,
      getPoint,
      sceneMeta,
    );

    return [...reservedItems, ...sampled].slice(0, maxCount);
  }

  private selectItemsNearPoints<T>(
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
        points.some((anchor) => distanceMeters(pathPoint, anchor) <= radiusMeters),
      ),
    );
  }

  private selectItemsWithinRadius<T>(
    items: T[],
    anchor: Coordinate,
    getPoint: (item: T) => Coordinate,
    radiusMeters: number,
  ): T[] {
    return items.filter((item) => distanceMeters(getPoint(item), anchor) <= radiusMeters);
  }

  private buildStructuralCoverage(
    sceneMeta: SceneMeta,
    selectedBuildings: SceneBuildingMeta[],
    coreRadiusMeters: number,
  ): SceneMeta['structuralCoverage'] {
    const totalBuildings = Math.max(1, sceneMeta.buildings.length);
    const selectedIds = new Set(selectedBuildings.map((building) => building.objectId));
    const coreBuildings = sceneMeta.buildings.filter((building) => {
      const center = averageCoordinate(building.outerRing) ?? sceneMeta.origin;
      return distanceMeters(center, sceneMeta.origin) <= coreRadiusMeters;
    });
    const coreSelectedCount = coreBuildings.filter((building) =>
      selectedIds.has(building.objectId),
    ).length;
    const fallbackCount = sceneMeta.buildings.filter(
      (building) => building.geometryStrategy === 'fallback_massing',
    ).length;
    const heroLandmarks = sceneMeta.buildings.filter(
      (building) => building.visualRole && building.visualRole !== 'generic',
    );
    const preservedFootprints = sceneMeta.buildings.filter(
      (building) => building.geometryStrategy !== 'fallback_massing',
    ).length;

    return {
      selectedBuildingCoverage: roundRatio(selectedBuildings.length, totalBuildings),
      coreAreaBuildingCoverage:
        coreBuildings.length === 0
          ? 1
          : roundRatio(coreSelectedCount, coreBuildings.length),
      fallbackMassingRate: roundRatio(fallbackCount, totalBuildings),
      footprintPreservationRate: roundRatio(preservedFootprints, totalBuildings),
      heroLandmarkCoverage: roundRatio(
        heroLandmarks.filter((building) => selectedIds.has(building.objectId)).length,
        Math.max(1, heroLandmarks.length),
      ),
    };
  }
}

function averageCoordinate(points: Coordinate[]): Coordinate | null {
  if (points.length === 0) {
    return null;
  }

  const total = points.reduce(
    (acc, point) => ({
      lat: acc.lat + point.lat,
      lng: acc.lng + point.lng,
    }),
    { lat: 0, lng: 0 },
  );

  return {
    lat: total.lat / points.length,
    lng: total.lng / points.length,
  };
}

function toLocalPoint(origin: Coordinate, point: Coordinate): { x: number; z: number } {
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

function distanceMeters(a: Coordinate, b: Coordinate): number {
  const metersPerLat = 111_320;
  const metersPerLng = 111_320 * Math.cos((((a.lat + b.lat) / 2) * Math.PI) / 180);
  return Math.hypot((a.lat - b.lat) * metersPerLat, (a.lng - b.lng) * metersPerLng);
}

function uniqueCoordinates(points: Coordinate[]): Coordinate[] {
  const seen = new Set<string>();
  return points.filter((point) => {
    const key = `${point.lat}:${point.lng}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function roundRatio(value: number, total: number): number {
  return Number((value / total).toFixed(3));
}
