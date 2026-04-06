import type { Coordinate } from '../../../places/types/place.types';
import type {
  SceneFacadeHint,
  SceneMeta,
} from '../../../scene/types/scene.types';
import type { GeometryBuffers, Vec3 } from '../road/road-mesh.builder';
import { createEmptyGeometry } from '../road/road-mesh.builder';
import { normalizeLocalRing, toLocalRing } from './building-mesh-utils';
import type { FacadeFrame } from './building-mesh.facade-frame.utils';
import { buildFacadeFrame } from './building-mesh.facade-frame.utils';
import { pushBox, pushQuad } from './building-mesh.geometry-primitives';

export function createBuildingWindowGeometry(
  origin: Coordinate,
  buildings: SceneMeta['buildings'],
  facadeHints: SceneFacadeHint[],
): GeometryBuffers {
  const geometry = createEmptyGeometry();
  const hintMap = new Map(facadeHints.map((hint) => [hint.objectId, hint]));

  for (const building of buildings) {
    const hint = hintMap.get(building.objectId);
    if (!hint) {
      continue;
    }

    const outerRing = normalizeLocalRing(
      toLocalRing(origin, building.outerRing),
      'CCW',
    );
    if (outerRing.length < 3) {
      continue;
    }

    const windowConfig = resolveWindowConfig(building, hint);
    const height = Math.max(4, building.heightMeters);

    for (let edgeIndex = 0; edgeIndex < outerRing.length; edgeIndex += 1) {
      const frame = buildFacadeFrame(outerRing, edgeIndex, height);
      if (!frame) {
        continue;
      }

      pushWindowGrid(geometry, frame, windowConfig, height);
    }
  }

  return geometry;
}

interface WindowConfig {
  floorCount: number;
  windowsPerFloor: number;
  windowWidth: number;
  windowHeight: number;
  windowDepth: number;
  frameWidth: number;
  sillDepth: number;
  pattern: 'grid' | 'horizontal' | 'vertical' | 'scattered';
}

function resolveWindowConfig(
  building: SceneMeta['buildings'][number],
  hint: SceneFacadeHint,
): WindowConfig {
  const archetype = building.visualArchetype ?? 'commercial_midrise';
  const density = hint.windowPatternDensity ?? 'medium';
  const height = Math.max(4, building.heightMeters);

  const floorHeight = 3.2;
  const floorCount = Math.max(2, Math.floor(height / floorHeight));

  const baseConfig: WindowConfig = {
    floorCount,
    windowsPerFloor: 4,
    windowWidth: 1.2,
    windowHeight: 1.8,
    windowDepth: 0.15,
    frameWidth: 0.08,
    sillDepth: 0.12,
    pattern: 'grid',
  };

  switch (archetype) {
    case 'highrise_office':
      return {
        ...baseConfig,
        windowsPerFloor: density === 'dense' ? 8 : density === 'medium' ? 6 : 4,
        windowWidth: 1.4,
        windowHeight: 2.0,
        pattern: 'grid',
      };
    case 'apartment_block':
    case 'house_compact':
      return {
        ...baseConfig,
        windowsPerFloor: density === 'dense' ? 6 : density === 'medium' ? 4 : 3,
        windowWidth: 1.0,
        windowHeight: 1.4,
        pattern: 'grid',
      };
    case 'commercial_midrise':
    case 'mall_podium':
    case 'lowrise_shop':
      return {
        ...baseConfig,
        floorCount: Math.max(1, Math.floor(floorCount * 0.6)),
        windowsPerFloor: density === 'dense' ? 5 : density === 'medium' ? 4 : 3,
        windowWidth: 1.6,
        windowHeight: 1.2,
        pattern: 'horizontal',
      };
    case 'hotel_tower':
      return {
        ...baseConfig,
        windowsPerFloor:
          density === 'dense' ? 10 : density === 'medium' ? 8 : 6,
        windowWidth: 1.1,
        windowHeight: 1.6,
        pattern: 'grid',
      };
    case 'station_like':
    case 'landmark_special':
      return {
        ...baseConfig,
        windowsPerFloor:
          density === 'dense' ? 12 : density === 'medium' ? 8 : 6,
        windowWidth: 1.8,
        windowHeight: 2.2,
        pattern: 'vertical',
      };
    default:
      return baseConfig;
  }
}

function pushWindowGrid(
  geometry: GeometryBuffers,
  frame: FacadeFrame,
  config: WindowConfig,
  buildingHeight: number,
): void {
  const edgeLength = Math.hypot(
    frame.b[0] - frame.a[0],
    frame.b[2] - frame.a[2],
  );

  const floorHeight = buildingHeight / Math.max(1, config.floorCount);
  const windowSpacing = edgeLength / Math.max(1, config.windowsPerFloor);

  for (let floor = 0; floor < config.floorCount; floor += 1) {
    const floorY = floor * floorHeight + floorHeight * 0.3;
    const floorTopY = floorY + config.windowHeight;

    if (floorTopY > buildingHeight - 0.5) {
      continue;
    }

    for (let col = 0; col < config.windowsPerFloor; col += 1) {
      const t = (col + 0.5) / config.windowsPerFloor;
      const centerX = frame.a[0] + (frame.b[0] - frame.a[0]) * t;
      const centerZ = frame.a[2] + (frame.b[2] - frame.a[2]) * t;

      pushWindowFrame(
        geometry,
        frame,
        centerX,
        centerZ,
        floorY,
        config.windowWidth,
        config.windowHeight,
        config.windowDepth,
        config.frameWidth,
        config.sillDepth,
      );
    }
  }
}

function pushWindowFrame(
  geometry: GeometryBuffers,
  frame: FacadeFrame,
  centerX: number,
  centerZ: number,
  floorY: number,
  windowWidth: number,
  windowHeight: number,
  windowDepth: number,
  frameWidth: number,
  sillDepth: number,
): void {
  const edgeDx = frame.b[0] - frame.a[0];
  const edgeDz = frame.b[2] - frame.a[2];
  const edgeLength = Math.hypot(edgeDx, edgeDz);
  if (edgeLength <= 1e-6) {
    return;
  }

  const tangent: Vec3 = [edgeDx / edgeLength, 0, edgeDz / edgeLength];
  const halfWidth = windowWidth / 2;

  const leftX = centerX - tangent[0] * halfWidth;
  const leftZ = centerZ - tangent[2] * halfWidth;
  const rightX = centerX + tangent[0] * halfWidth;
  const rightZ = centerZ + tangent[2] * halfWidth;

  const frontOffset = 0.02;
  const frontLeftX = leftX + frame.normal[0] * frontOffset;
  const frontLeftZ = leftZ + frame.normal[2] * frontOffset;
  const frontRightX = rightX + frame.normal[0] * frontOffset;
  const frontRightZ = rightZ + frame.normal[2] * frontOffset;

  const backLeftX = leftX - frame.normal[0] * windowDepth;
  const backLeftZ = leftZ - frame.normal[2] * windowDepth;
  const backRightX = rightX - frame.normal[0] * windowDepth;
  const backRightZ = rightZ - frame.normal[2] * windowDepth;

  const y0 = floorY;
  const y1 = floorY + windowHeight;

  pushQuad(
    geometry,
    [frontLeftX, y0, frontLeftZ],
    [frontRightX, y0, frontRightZ],
    [frontRightX, y1, frontRightZ],
    [frontLeftX, y1, frontLeftZ],
  );

  pushQuad(
    geometry,
    [backRightX, y0, backRightZ],
    [backLeftX, y0, backLeftZ],
    [backLeftX, y1, backLeftZ],
    [backRightX, y1, backRightZ],
  );

  const frameHalfWidth = frameWidth / 2;
  pushWindowFrameEdge(
    geometry,
    frame,
    leftX,
    leftZ,
    y0,
    y1,
    windowDepth,
    frameHalfWidth,
  );
  pushWindowFrameEdge(
    geometry,
    frame,
    rightX,
    rightZ,
    y0,
    y1,
    windowDepth,
    frameHalfWidth,
  );
  pushWindowSill(
    geometry,
    frame,
    centerX,
    centerZ,
    y0,
    windowWidth,
    windowDepth,
    sillDepth,
  );
}

function pushWindowFrameEdge(
  geometry: GeometryBuffers,
  frame: FacadeFrame,
  x: number,
  z: number,
  y0: number,
  y1: number,
  depth: number,
  halfWidth: number,
): void {
  const frontX = x + frame.normal[0] * 0.02;
  const frontZ = z + frame.normal[2] * 0.02;
  const backX = x - frame.normal[0] * depth;
  const backZ = z - frame.normal[2] * depth;

  pushQuad(
    geometry,
    [
      frontX - frame.normal[0] * halfWidth,
      y0,
      frontZ - frame.normal[2] * halfWidth,
    ],
    [
      backX - frame.normal[0] * halfWidth,
      y0,
      backZ - frame.normal[2] * halfWidth,
    ],
    [
      backX - frame.normal[0] * halfWidth,
      y1,
      backZ - frame.normal[2] * halfWidth,
    ],
    [
      frontX - frame.normal[0] * halfWidth,
      y1,
      frontZ - frame.normal[2] * halfWidth,
    ],
  );
}

function pushWindowSill(
  geometry: GeometryBuffers,
  frame: FacadeFrame,
  centerX: number,
  centerZ: number,
  y: number,
  windowWidth: number,
  windowDepth: number,
  sillDepth: number,
): void {
  const sillHeight = 0.08;
  const sillWidth = windowWidth + 0.1;
  const halfWidth = sillWidth / 2;

  const frontX = centerX + frame.normal[0] * sillDepth;
  const frontZ = centerZ + frame.normal[2] * sillDepth;
  const backX = centerX - frame.normal[0] * (windowDepth + 0.02);
  const backZ = centerZ - frame.normal[2] * (windowDepth + 0.02);

  pushBox(
    geometry,
    [frontX - halfWidth, y - sillHeight, frontZ - halfWidth * 0.3],
    [frontX + halfWidth, y, frontZ + halfWidth * 0.3],
  );
}
