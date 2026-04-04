import { Coordinate } from '../places/place.types';
import { midpoint } from '../places/geo.utils';
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
} from './scene.types';

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
}

export function buildSceneAssetSelection(
  sceneMeta: SceneMeta,
  sceneDetail: SceneDetail,
  scale: SceneScale,
): SceneAssetSelection {
  const budget = resolveAssetBudget(scale);

  const buildings = selectSpatialSample(
    sceneMeta.buildings,
    budget.buildingCount,
    (building) => averageCoordinate(building.outerRing) ?? sceneMeta.origin,
    sceneMeta,
  );
  const roads = selectSpatialSample(
    sceneMeta.roads,
    budget.roadCount,
    (road) => road.center,
    sceneMeta,
  );
  const walkways = selectSpatialSample(
    sceneMeta.walkways,
    budget.walkwayCount,
    (walkway) => midpoint(walkway.path) ?? sceneMeta.origin,
    sceneMeta,
  );
  const landmarkPois = sceneMeta.pois.filter((poi) => poi.isLandmark);
  const remainingPois = sceneMeta.pois.filter((poi) => !poi.isLandmark);
  const poiBudget = Math.max(0, budget.poiCount - landmarkPois.length);
  const sampledPois = selectSpatialSample(
    remainingPois,
    poiBudget,
    (poi) => poi.location,
    sceneMeta,
  );
  const pois = [...landmarkPois, ...sampledPois];
  const crossings = selectSpatialSample(
    sceneDetail.crossings,
    budget.crossingCount,
    (crossing) => crossing.center,
    sceneMeta,
  );
  const trafficLights = selectSpatialSample(
    sceneDetail.streetFurniture.filter((item) => item.type === 'TRAFFIC_LIGHT'),
    budget.trafficLightCount,
    (item) => item.location,
    sceneMeta,
  );
  const streetLights = selectSpatialSample(
    sceneDetail.streetFurniture.filter((item) => item.type === 'STREET_LIGHT'),
    budget.streetLightCount,
    (item) => item.location,
    sceneMeta,
  );
  const signPoles = selectSpatialSample(
    sceneDetail.streetFurniture.filter((item) => item.type === 'SIGN_POLE'),
    budget.signPoleCount,
    (item) => item.location,
    sceneMeta,
  );
  const vegetation = selectSpatialSample(
    sceneDetail.vegetation,
    budget.treeClusterCount,
    (item) => item.location,
    sceneMeta,
  );
  const billboardPanels = selectSpatialSample(
    sceneDetail.signageClusters,
    budget.billboardPanelCount,
    (item) => item.anchor,
    sceneMeta,
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
  };
}

function resolveAssetBudget(scale: SceneScale): SceneMeta['assetProfile']['budget'] {
  if (scale === 'SMALL') {
    return {
      buildingCount: 300,
      roadCount: 120,
      walkwayCount: 180,
      poiCount: 140,
      crossingCount: 12,
      trafficLightCount: 24,
      streetLightCount: 36,
      signPoleCount: 48,
      treeClusterCount: 40,
      billboardPanelCount: 72,
    };
  }

  if (scale === 'LARGE') {
    return {
      buildingCount: 1200,
      roadCount: 300,
      walkwayCount: 420,
      poiCount: 260,
      crossingCount: 40,
      trafficLightCount: 100,
      streetLightCount: 140,
      signPoleCount: 180,
      treeClusterCount: 120,
      billboardPanelCount: 220,
    };
  }

  return {
    buildingCount: 700,
    roadCount: 220,
    walkwayCount: 320,
    poiCount: 220,
    crossingCount: 24,
    trafficLightCount: 60,
    streetLightCount: 90,
    signPoleCount: 120,
    treeClusterCount: 80,
    billboardPanelCount: 160,
  };
}

function selectSpatialSample<T>(
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
