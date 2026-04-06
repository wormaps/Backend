import type { Coordinate } from '../../../places/types/place.types';
import type { SceneMeta } from '../../../scene/types/scene.types';
import type { GeometryBuffers } from '../road/road-mesh.builder';
import { createEmptyGeometry } from '../road/road-mesh.builder';
import { normalizeLocalRing, toLocalRing } from './building-mesh-utils';
import {
  buildFacadeFrame,
  resolveLongestEdgeIndex,
} from './building-mesh.facade-frame.utils';
import { pushBox, pushQuad } from './building-mesh.geometry-primitives';

export function createBuildingEntranceGeometry(
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

    const entranceConfig = resolveEntranceConfig(building);
    const height = Math.max(4, building.heightMeters);

    const mainEdgeIndex = resolveLongestEdgeIndex(outerRing);
    const frame = buildFacadeFrame(outerRing, mainEdgeIndex, height);
    if (!frame) {
      continue;
    }

    pushEntranceAssembly(geometry, frame, entranceConfig, height);
  }

  return geometry;
}

interface EntranceConfig {
  hasCanopy: boolean;
  canopyDepth: number;
  canopyHeight: number;
  entranceWidth: number;
  entranceHeight: number;
  doorCount: number;
  hasRecess: boolean;
}

function resolveEntranceConfig(
  building: SceneMeta['buildings'][number],
): EntranceConfig {
  const archetype = building.visualArchetype ?? 'commercial_midrise';
  const canopyEdges = building.podiumSpec?.canopyEdges ?? [];
  const hasCanopy = canopyEdges.length > 0;

  const baseConfig: EntranceConfig = {
    hasCanopy: false,
    canopyDepth: 2.0,
    canopyHeight: 3.5,
    entranceWidth: 3.0,
    entranceHeight: 3.0,
    doorCount: 2,
    hasRecess: false,
  };

  switch (archetype) {
    case 'highrise_office':
      return {
        ...baseConfig,
        hasCanopy: true,
        canopyDepth: 2.5,
        canopyHeight: 4.0,
        entranceWidth: 4.0,
        entranceHeight: 3.5,
        doorCount: 3,
        hasRecess: true,
      };
    case 'commercial_midrise':
    case 'mall_podium':
    case 'lowrise_shop':
      return {
        ...baseConfig,
        hasCanopy: hasCanopy || true,
        canopyDepth: 3.0,
        canopyHeight: 3.8,
        entranceWidth: 5.0,
        entranceHeight: 3.2,
        doorCount: 4,
        hasRecess: true,
      };
    case 'apartment_block':
      return {
        ...baseConfig,
        hasCanopy: false,
        entranceWidth: 2.5,
        entranceHeight: 2.8,
        doorCount: 1,
        hasRecess: true,
      };
    case 'hotel_tower':
      return {
        ...baseConfig,
        hasCanopy: true,
        canopyDepth: 4.0,
        canopyHeight: 4.5,
        entranceWidth: 6.0,
        entranceHeight: 4.0,
        doorCount: 4,
        hasRecess: true,
      };
    case 'station_like':
    case 'landmark_special':
      return {
        ...baseConfig,
        hasCanopy: true,
        canopyDepth: 5.0,
        canopyHeight: 5.0,
        entranceWidth: 8.0,
        entranceHeight: 4.5,
        doorCount: 6,
        hasRecess: false,
      };
    default:
      return baseConfig;
  }
}

function pushEntranceAssembly(
  geometry: GeometryBuffers,
  frame: NonNullable<ReturnType<typeof buildFacadeFrame>>,
  config: EntranceConfig,
  buildingHeight: number,
): void {
  const entranceY = 0;
  const entranceTopY = Math.min(
    entranceY + config.entranceHeight,
    buildingHeight * 0.15,
  );

  const edgeDx = frame.b[0] - frame.a[0];
  const edgeDz = frame.b[2] - frame.a[2];
  const edgeLength = Math.hypot(edgeDx, edgeDz);
  if (edgeLength <= 1e-6) {
    return;
  }

  const tangent = [edgeDx / edgeLength, 0, edgeDz / edgeLength] as const;
  const centerX = (frame.a[0] + frame.b[0]) / 2;
  const centerZ = (frame.a[2] + frame.b[2]) / 2;

  const halfEntranceWidth = Math.min(
    config.entranceWidth / 2,
    edgeLength * 0.4,
  );

  const leftX = centerX - tangent[0] * halfEntranceWidth;
  const leftZ = centerZ - tangent[2] * halfEntranceWidth;
  const rightX = centerX + tangent[0] * halfEntranceWidth;
  const rightZ = centerZ + tangent[2] * halfEntranceWidth;

  const recessDepth = config.hasRecess ? 0.8 : 0.1;
  const recessLeftX = leftX - frame.normal[0] * recessDepth;
  const recessLeftZ = leftZ - frame.normal[2] * recessDepth;
  const recessRightX = rightX - frame.normal[0] * recessDepth;
  const recessRightZ = rightZ - frame.normal[2] * recessDepth;

  pushQuad(
    geometry,
    [recessLeftX, entranceY, recessLeftZ],
    [recessRightX, entranceY, recessRightZ],
    [recessRightX, entranceTopY, recessRightZ],
    [recessLeftX, entranceTopY, recessLeftZ],
  );

  const doorWidth = config.entranceWidth / Math.max(1, config.doorCount);
  for (let i = 0; i < config.doorCount; i += 1) {
    const doorCenterT = (i + 0.5) / config.doorCount - 0.5;
    const doorCenterX =
      centerX + tangent[0] * doorCenterT * config.entranceWidth;
    const doorCenterZ =
      centerZ + tangent[2] * doorCenterT * config.entranceWidth;

    pushDoorFrame(
      geometry,
      frame,
      doorCenterX,
      doorCenterZ,
      entranceY,
      doorWidth * 0.8,
      entranceTopY * 0.85,
      recessDepth,
    );
  }

  if (config.hasCanopy) {
    pushCanopyStructure(
      geometry,
      frame,
      centerX,
      centerZ,
      entranceTopY,
      config.entranceWidth * 1.2,
      config.canopyDepth,
      config.canopyHeight,
    );
  }
}

function pushDoorFrame(
  geometry: GeometryBuffers,
  frame: NonNullable<ReturnType<typeof buildFacadeFrame>>,
  centerX: number,
  centerZ: number,
  y: number,
  doorWidth: number,
  doorHeight: number,
  recessDepth: number,
): void {
  const halfWidth = doorWidth / 2;
  const frameThickness = 0.06;

  const doorFrontX = centerX + frame.normal[0] * 0.02;
  const doorFrontZ = centerZ + frame.normal[2] * 0.02;
  const doorBackX = centerX - frame.normal[0] * recessDepth;
  const doorBackZ = centerZ - frame.normal[2] * recessDepth;

  pushBox(
    geometry,
    [doorFrontX - halfWidth, y, doorFrontZ - halfWidth * 0.3],
    [doorFrontX + halfWidth, y + doorHeight, doorFrontZ + halfWidth * 0.3],
  );

  pushQuad(
    geometry,
    [doorBackX - halfWidth - frameThickness, y, doorBackZ - frameThickness],
    [doorBackX + halfWidth + frameThickness, y, doorBackZ + frameThickness],
    [
      doorBackX + halfWidth + frameThickness,
      y + doorHeight + frameThickness,
      doorBackZ + frameThickness,
    ],
    [
      doorBackX - halfWidth - frameThickness,
      y + doorHeight + frameThickness,
      doorBackZ - frameThickness,
    ],
  );
}

function pushCanopyStructure(
  geometry: GeometryBuffers,
  frame: NonNullable<ReturnType<typeof buildFacadeFrame>>,
  centerX: number,
  centerZ: number,
  baseY: number,
  canopyWidth: number,
  canopyDepth: number,
  canopyHeight: number,
): void {
  const halfWidth = canopyWidth / 2;
  const canopyY = baseY + 0.3;
  const canopyTopY = canopyY + canopyHeight;

  const frontX = centerX + frame.normal[0] * canopyDepth;
  const frontZ = centerZ + frame.normal[2] * canopyDepth;

  pushBox(
    geometry,
    [frontX - halfWidth, canopyY, frontZ - 0.15],
    [frontX + halfWidth, canopyTopY, frontZ + 0.15],
  );

  const supportSpacing = canopyWidth / 3;
  for (let i = -1; i <= 1; i += 1) {
    const supportX = centerX + i * supportSpacing;
    const supportZ = centerZ;

    pushBox(
      geometry,
      [supportX - 0.08, 0, supportZ - 0.08],
      [supportX + 0.08, canopyY, supportZ + 0.08],
    );
  }
}
