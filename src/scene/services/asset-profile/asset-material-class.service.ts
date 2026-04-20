import { Injectable } from '@nestjs/common';
import { averageCoordinate } from '../../../common/geo/coordinate-utils.utils';
import {
  SceneBuildingMeta,
  SceneMeta,
} from '../../types/scene.types';
import { distanceMeters } from './scene-asset-selection.utils';

@Injectable()
export class AssetMaterialClassService {
  buildStructuralCoverage(
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

function roundRatio(value: number, total: number): number {
  return Number((value / total).toFixed(3));
}
