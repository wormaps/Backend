import type { Coordinate } from '../../../places/types/place.types';
import type { SceneMeta } from '../../../scene/types/scene.types';
import type { GeometryBuffers } from '../road/road-mesh.builder';
import { createEmptyGeometry } from '../road/road-mesh.builder';
import {
  computeBounds,
  normalizeLocalRing,
  toLocalRing,
} from './building-mesh-utils';
import { pushBox } from './building-mesh.geometry-primitives';
import {
  insetRing,
  resolveBuildingVerticalBase,
} from './building-mesh.shell.builder';

export function createBuildingRoofEquipmentGeometry(
  origin: Coordinate,
  buildings: SceneMeta['buildings'],
): GeometryBuffers {
  const geometry = createEmptyGeometry();

  for (const building of buildings) {
    const outerRing = normalizeLocalRing(
      toLocalRing(origin, building.outerRing),
      'CCW',
    );
    if (outerRing.length < 3) {
      continue;
    }

    const equipmentConfig = resolveRoofEquipmentConfig(building);
    if (equipmentConfig.unitCount === 0) {
      continue;
    }

    const inset = insetRing(outerRing, 0.15);
    const bounds = computeBounds(inset.length >= 3 ? inset : outerRing);
    const topHeight =
      resolveBuildingVerticalBase(building) +
      Math.max(4, building.heightMeters);

    pushRoofEquipmentAssembly(geometry, bounds, topHeight, equipmentConfig);
  }

  return geometry;
}

interface RoofEquipmentConfig {
  unitCount: number;
  unitType: 'ac' | 'antenna' | 'mixed';
  spacing: number;
}

function resolveRoofEquipmentConfig(
  building: SceneMeta['buildings'][number],
): RoofEquipmentConfig {
  const archetype = building.visualArchetype ?? 'commercial_midrise';
  const explicitUnits = building.roofSpec?.roofUnits ?? 0;
  const height = Math.max(4, building.heightMeters);
  const lodLevel =
    (building as { lodLevel?: 'HIGH' | 'MEDIUM' | 'LOW' }).lodLevel ?? 'HIGH';
  const isHeroBuilding =
    Boolean(building.visualRole) && building.visualRole !== 'generic';
  const lodScale = resolveRoofEquipmentLodScale(lodLevel, isHeroBuilding);
  const minimumUnits = isHeroBuilding ? 2 : 1;

  if (explicitUnits > 0) {
    return {
      unitCount: scaleRoofEquipmentUnits(
        explicitUnits + (building.visualRole === 'hero_landmark' ? 2 : 1),
        lodScale,
        minimumUnits,
      ),
      unitType: 'mixed' as const,
      spacing: 2.5,
    };
  }

  const baseConfig: RoofEquipmentConfig = {
    unitCount: 0,
    unitType: 'ac',
    spacing: 2.5,
  };

  switch (archetype) {
    case 'highrise_office':
      return {
        ...baseConfig,
        unitCount: scaleRoofEquipmentUnits(
          Math.max(3, Math.floor(height / 12)),
          lodScale,
          minimumUnits,
        ),
        unitType: 'mixed',
      };
    case 'commercial_midrise':
    case 'mall_podium':
      return {
        ...baseConfig,
        unitCount: scaleRoofEquipmentUnits(
          Math.max(4, Math.floor(height / 9)),
          lodScale,
          minimumUnits,
        ),
        unitType: 'ac',
      };
    case 'hotel_tower':
      return {
        ...baseConfig,
        unitCount: scaleRoofEquipmentUnits(
          Math.max(5, Math.floor(height / 10)),
          lodScale,
          minimumUnits,
        ),
        unitType: 'mixed',
      };
    case 'apartment_block':
      return {
        ...baseConfig,
        unitCount: scaleRoofEquipmentUnits(
          Math.max(1, Math.floor(height / 20)),
          lodScale,
          minimumUnits,
        ),
        unitType: 'ac',
      };
    case 'station_like':
    case 'landmark_special':
      return {
        ...baseConfig,
        unitCount: scaleRoofEquipmentUnits(
          Math.max(3, Math.floor(height / 7)),
          lodScale,
          minimumUnits,
        ),
        unitType: 'antenna',
      };
    default:
      return baseConfig;
  }
}

function resolveRoofEquipmentLodScale(
  lodLevel: 'HIGH' | 'MEDIUM' | 'LOW',
  isHeroBuilding: boolean,
): number {
  if (isHeroBuilding) {
    return 1;
  }
  if (lodLevel === 'LOW') {
    return 0.35;
  }
  if (lodLevel === 'MEDIUM') {
    return 0.65;
  }
  return 1;
}

function scaleRoofEquipmentUnits(
  baseUnitCount: number,
  lodScale: number,
  minimumUnits: number,
): number {
  if (baseUnitCount <= 0) {
    return 0;
  }
  return Math.max(minimumUnits, Math.round(baseUnitCount * lodScale));
}

function pushRoofEquipmentAssembly(
  geometry: GeometryBuffers,
  bounds: {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
    width: number;
    depth: number;
  },
  topHeight: number,
  config: RoofEquipmentConfig,
): void {
  const columns = Math.max(1, Math.ceil(Math.sqrt(config.unitCount)));
  const rows = Math.ceil(config.unitCount / columns);

  for (let index = 0; index < config.unitCount; index += 1) {
    const col = index % columns;
    const row = Math.floor(index / columns);

    const centerX = bounds.minX + ((col + 1) / (columns + 1)) * bounds.width;
    const centerZ = bounds.minZ + ((row + 1) / (rows + 1)) * bounds.depth;

    if (config.unitType === 'antenna') {
      pushAntennaUnit(geometry, centerX, centerZ, topHeight);
    } else if (config.unitType === 'ac') {
      pushACUnit(geometry, centerX, centerZ, topHeight);
    } else if (index % 2 === 0) {
      pushACUnit(geometry, centerX, centerZ, topHeight);
    } else {
      pushAntennaUnit(geometry, centerX, centerZ, topHeight);
    }
  }
}

function pushACUnit(
  geometry: GeometryBuffers,
  centerX: number,
  centerZ: number,
  baseY: number,
): void {
  const unitWidth = 1.4;
  const unitDepth = 0.8;
  const unitHeight = 1.2;

  pushBox(
    geometry,
    [centerX - unitWidth / 2, baseY + 0.1, centerZ - unitDepth / 2],
    [
      centerX + unitWidth / 2,
      baseY + 0.1 + unitHeight,
      centerZ + unitDepth / 2,
    ],
  );

  const fanRadius = 0.25;
  for (let i = 0; i < 2; i += 1) {
    const fanX = centerX + (i - 0.5) * 0.5;
    pushBox(
      geometry,
      [fanX - fanRadius, baseY + 0.1 + unitHeight - 0.05, centerZ - fanRadius],
      [fanX + fanRadius, baseY + 0.1 + unitHeight + 0.05, centerZ + fanRadius],
    );
  }
}

function pushAntennaUnit(
  geometry: GeometryBuffers,
  centerX: number,
  centerZ: number,
  baseY: number,
): void {
  const poleHeight = 2.5;
  const poleRadius = 0.06;

  pushBox(
    geometry,
    [centerX - poleRadius, baseY + 0.1, centerZ - poleRadius],
    [centerX + poleRadius, baseY + 0.1 + poleHeight, centerZ + poleRadius],
  );

  const dishRadius = 0.4;
  const dishHeight = 0.3;
  pushBox(
    geometry,
    [
      centerX - dishRadius,
      baseY + 0.1 + poleHeight * 0.6,
      centerZ - dishRadius,
    ],
    [
      centerX + dishRadius,
      baseY + 0.1 + poleHeight * 0.6 + dishHeight,
      centerZ + dishRadius,
    ],
  );

  const topBoxSize = 0.15;
  pushBox(
    geometry,
    [
      centerX - topBoxSize,
      baseY + 0.1 + poleHeight - 0.1,
      centerZ - topBoxSize,
    ],
    [
      centerX + topBoxSize,
      baseY + 0.1 + poleHeight + 0.1,
      centerZ + topBoxSize,
    ],
  );
}
