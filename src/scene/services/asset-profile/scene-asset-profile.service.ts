import { Injectable } from '@nestjs/common';
import { averageCoordinate } from '../../../common/geo/coordinate-utils.utils';
import { Coordinate } from '../../../places/types/place.types';
import { midpoint } from '../../../places/utils/geo.utils';
import {
  SceneBuildingMeta,
  SceneCrossingDetail,
  SceneDetail,
  SceneEvidenceProfile,
  SceneMeta,
  SceneScale,
} from '../../types/scene.types';
import {
  distanceMeters,
  selectItemsNearPoints,
  selectItemsWithinRadius,
  selectPrioritizedSample,
  selectSpatialSample,
} from './scene-asset-selection.utils';
import { SceneAssetSelection } from './scene-asset-profile.types';
import { resolveAssetBudget, resolveAdaptiveAssetBudget } from './asset-budget.utils';
import { buildEvidenceProfile } from './asset-evidence-profile.utils';
import { AssetMaterialClassService } from './asset-material-class.service';

@Injectable()
export class SceneAssetProfileService {
  constructor(
    private readonly materialClassService: AssetMaterialClassService,
  ) {}

  buildSceneAssetSelection(
    sceneMeta: SceneMeta,
    sceneDetail: SceneDetail,
    scale: SceneScale,
  ): SceneAssetSelection {
    const budget = resolveAdaptiveAssetBudget(
      resolveAssetBudget(scale),
      sceneDetail.fidelityPlan?.targetMode,
      sceneMeta,
    );
    const landmarkLocations = sceneMeta.landmarkAnchors.map(
      (anchor) => anchor.location,
    );
    const coreRadiusMeters = scale === 'MEDIUM' ? 230 : 150;
    const crossingCoreRadiusMeters = scale === 'MEDIUM' ? 320 : 160;
    const roadCoreRadiusMeters = scale === 'MEDIUM' ? 360 : 180;
    const walkwayCoreRadiusMeters = scale === 'MEDIUM' ? 320 : 170;

    const allBuildingsWithDistance = sceneMeta.buildings.map((building) => {
      const center = averageCoordinate(building.outerRing) ?? sceneMeta.origin;
      return {
        ...building,
        _distanceM: distanceMeters(center, sceneMeta.origin),
      };
    });

    const buildings = selectPrioritizedSample(
      allBuildingsWithDistance,
      budget.buildingCount,
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
    const crossings = this.selectCrossings(
      sceneDetail.crossings,
      budget.crossingCount,
      sceneMeta,
      landmarkLocations,
      crossingCoreRadiusMeters,
      sceneDetail,
    );
    const priorityRoadAnchors = uniqueCoordinates([
      sceneMeta.origin,
      ...landmarkLocations,
      ...crossings
        .filter((crossing) => crossing.principal)
        .map((crossing) => crossing.center),
    ]);
    const roads = this.selectPathCollection(
      sceneMeta.roads,
      budget.roadCount,
      (road) => road.path,
      (road) => road.center,
      sceneMeta,
      [
        selectItemsWithinRadius(
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
        selectItemsWithinRadius(
          sceneMeta.walkways,
          sceneMeta.origin,
          (walkway) => midpoint(walkway.path) ?? sceneMeta.origin,
          walkwayCoreRadiusMeters,
        ),
        selectItemsNearPoints(
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
    const sampledPois = selectSpatialSample(
      remainingPois,
      poiBudget,
      (poi) => poi.location,
      sceneMeta,
    );
    const pois = [...landmarkPois, ...sampledPois];
    const allTrafficLights = sceneDetail.streetFurniture.filter(
      (item) => item.type === 'TRAFFIC_LIGHT',
    );
    const allStreetLights = sceneDetail.streetFurniture.filter(
      (item) => item.type === 'STREET_LIGHT',
    );
    const trafficLights = this.selectWithSourceFloor(
      allTrafficLights,
      budget.trafficLightCount,
      (item) => item.location,
      sceneMeta,
    );
    const streetLights = this.selectWithSourceFloor(
      allStreetLights,
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
    const structuralCoverage = this.materialClassService.buildStructuralCoverage(
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

  buildSceneMetaWithAssetSelection(
    sceneMeta: SceneMeta,
    selection: Pick<
      SceneAssetSelection,
      'budget' | 'selected' | 'structuralCoverage'
    >,
    sceneDetail?: SceneDetail,
  ): SceneMeta {
    const evidenceProfile = sceneDetail
      ? buildEvidenceProfile(sceneDetail)
      : undefined;
    return {
      ...sceneMeta,
      assetProfile: {
        ...sceneMeta.assetProfile,
        budget: selection.budget,
        selected: selection.selected,
        ...(evidenceProfile ? { evidenceProfile } : {}),
      },
      structuralCoverage: selection.structuralCoverage,
    };
  }

  buildEvidenceProfile(sceneDetail: SceneDetail): SceneEvidenceProfile {
    return buildEvidenceProfile(sceneDetail);
  }

  private selectCrossings(
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

  private selectWithSourceFloor<T>(
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
