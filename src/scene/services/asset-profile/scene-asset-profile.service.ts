import { Injectable } from '@nestjs/common';
import { averageCoordinate } from '../../../common/geo/coordinate-utils.utils';
import { Coordinate } from '../../../places/types/place.types';
import { midpoint } from '../../../places/utils/geo.utils';
import {
  SceneBuildingMeta,
  SceneCrossingDetail,
  SceneDetail,
  SceneEvidenceProfile,
  SceneFidelityMode,
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
import { resolveSceneFidelityModeSignal } from '../../utils/scene-fidelity-mode-signal.utils';

@Injectable()
export class SceneAssetProfileService {
  buildSceneAssetSelection(
    sceneMeta: SceneMeta,
    sceneDetail: SceneDetail,
    scale: SceneScale,
  ): SceneAssetSelection {
    const budget = this.resolveAdaptiveAssetBudget(
      this.resolveAssetBudget(scale),
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

  buildSceneMetaWithAssetSelection(
    sceneMeta: SceneMeta,
    selection: Pick<
      SceneAssetSelection,
      'budget' | 'selected' | 'structuralCoverage'
    >,
    sceneDetail?: SceneDetail,
  ): SceneMeta {
    const evidenceProfile = sceneDetail
      ? this.buildEvidenceProfile(sceneDetail)
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
    const facadeHints = sceneDetail.facadeHints ?? [];
    const weakEvidenceRatio =
      facadeHints.length > 0
        ? facadeHints.filter((hint) => hint.weakEvidence).length /
          facadeHints.length
        : 0;

    const hasDistrictCluster = facadeHints.some((h) => h.districtCluster);
    const hasMapillary = sceneDetail.provenance?.mapillaryUsed ?? false;

    let evidenceSource: SceneEvidenceProfile['evidenceSource'] =
      'STATIC_DEFAULT';
    let confidence = 0.5;

    if (hasMapillary) {
      evidenceSource = 'MAPILLARY_DIRECT';
      confidence = 0.9;
    } else if (weakEvidenceRatio > 0.5) {
      evidenceSource = 'PLACE_CHARACTER_FALLBACK';
      confidence = 0.3;
    } else if (hasDistrictCluster) {
      evidenceSource = 'DISTRICT_TYPE_FALLBACK';
      confidence = 0.5;
    }

    return {
      weakEvidenceRatio: Number(weakEvidenceRatio.toFixed(3)),
      evidenceSource,
      confidence,
    };
  }

  private resolveAssetBudget(
    scale: SceneScale,
  ): SceneMeta['assetProfile']['budget'] {
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
      buildingCount: 760,
      roadCount: 260,
      walkwayCount: 320,
      poiCount: 120,
      crossingCount: 156,
      trafficLightCount: 48,
      streetLightCount: 64,
      signPoleCount: 80,
      treeClusterCount: 56,
      billboardPanelCount: 72,
    };
  }

  private resolveAdaptiveAssetBudget(
    baseBudget: SceneMeta['assetProfile']['budget'],
    targetMode?: SceneFidelityMode,
    sceneMeta?: SceneMeta,
  ): SceneMeta['assetProfile']['budget'] {
    let scaledBudget = baseBudget;

    if (targetMode) {
      const multiplier =
        resolveSceneFidelityModeSignal(targetMode).budgetMultiplier;
      const isLandmarkTarget = targetMode === 'LANDMARK_ENRICHED';
      const targetMultiplier = isLandmarkTarget ? 1.1 : multiplier;
      if (targetMultiplier !== 1) {
        scaledBudget = {
          buildingCount: scaleCount(baseBudget.buildingCount, targetMultiplier),
          roadCount: scaleCount(baseBudget.roadCount, targetMultiplier),
          walkwayCount: scaleCount(baseBudget.walkwayCount, targetMultiplier),
          poiCount: scaleCount(baseBudget.poiCount, targetMultiplier),
          crossingCount: scaleCount(baseBudget.crossingCount, targetMultiplier),
          trafficLightCount: scaleCount(
            baseBudget.trafficLightCount,
            targetMultiplier * (isLandmarkTarget ? 1.14 : 1),
          ),
          streetLightCount: scaleCount(
            baseBudget.streetLightCount,
            targetMultiplier * (isLandmarkTarget ? 1.18 : 1),
          ),
          signPoleCount: scaleCount(
            baseBudget.signPoleCount,
            targetMultiplier * (isLandmarkTarget ? 1.2 : 1),
          ),
          treeClusterCount: scaleCount(
            baseBudget.treeClusterCount,
            targetMultiplier,
          ),
          billboardPanelCount: scaleCount(
            baseBudget.billboardPanelCount,
            targetMultiplier * (isLandmarkTarget ? 1.16 : 1),
          ),
        };

        if (isLandmarkTarget) {
          const boostedCrossingFloor = Math.max(
            scaledBudget.crossingCount,
            Math.round(baseBudget.crossingCount * 1.38),
          );
          scaledBudget = {
            ...scaledBudget,
            crossingCount: boostedCrossingFloor,
          };
        }
      }
    }

    if (!sceneMeta) {
      return scaledBudget;
    }

    return this.applyDensityRecoveryFloor(sceneMeta, scaledBudget);
  }

  private applyDensityRecoveryFloor(
    sceneMeta: SceneMeta,
    budget: SceneMeta['assetProfile']['budget'],
  ): SceneMeta['assetProfile']['budget'] {
    const floorRatio = 0.56;
    const walkwayFloorRatio = 0.52;
    const buildingCountFloor = Math.max(
      budget.buildingCount,
      Math.round(sceneMeta.buildings.length * floorRatio),
    );
    const roadCountFloor = Math.max(
      budget.roadCount,
      Math.round(sceneMeta.roads.length * floorRatio),
    );
    const walkwayCountFloor = Math.max(
      budget.walkwayCount,
      Math.round(sceneMeta.walkways.length * walkwayFloorRatio),
    );
    const poiCountFloor = Math.max(
      budget.poiCount,
      Math.round(sceneMeta.pois.length * 0.16),
    );

    return {
      ...budget,
      buildingCount: buildingCountFloor,
      roadCount: roadCountFloor,
      walkwayCount: walkwayCountFloor,
      poiCount: poiCountFloor,
    };
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

  private buildStructuralCoverage(
    sceneMeta: SceneMeta,
    selectedBuildings: SceneBuildingMeta[],
    coreRadiusMeters: number,
  ): SceneMeta['structuralCoverage'] {
    const totalBuildings = Math.max(1, sceneMeta.buildings.length);
    const selectedIds = new Set(
      selectedBuildings.map((building) => building.objectId),
    );
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
      selectedBuildingCoverage: roundRatio(
        selectedBuildings.length,
        totalBuildings,
      ),
      coreAreaBuildingCoverage:
        coreBuildings.length === 0
          ? 1
          : roundRatio(coreSelectedCount, coreBuildings.length),
      fallbackMassingRate: roundRatio(fallbackCount, totalBuildings),
      footprintPreservationRate: roundRatio(
        preservedFootprints,
        totalBuildings,
      ),
      heroLandmarkCoverage: roundRatio(
        heroLandmarks.filter((building) => selectedIds.has(building.objectId))
          .length,
        Math.max(1, heroLandmarks.length),
      ),
    };
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

function roundRatio(value: number, total: number): number {
  return Number((value / total).toFixed(3));
}

function scaleCount(value: number, multiplier: number): number {
  return Math.max(1, Math.round(value * multiplier));
}
