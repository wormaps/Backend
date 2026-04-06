import type {
  SceneFacadeHint,
  WindowPatternDensity,
} from '../../../scene/types/scene.types';
import type { GeometryBuffers } from '../road/road-mesh.builder';
import type {
  PartialFacadeFrame,
  SplitFacadeFrame,
} from './building-mesh.facade-frame.utils';
import {
  getFrameYMax,
  getFrameYMin,
  pushFacadeSlab,
  pushVerticalMullionVolume,
} from './building-mesh.facade-frame.utils';

export function pushFacadeBandByType(
  geometry: GeometryBuffers,
  frame: SplitFacadeFrame,
  bandType: NonNullable<SceneFacadeHint['facadeSpec']>['lowerBandType'],
  signBandLevels: number,
  glazing: number,
  repeatX: number | undefined,
  bandCount: number,
): void {
  switch (bandType) {
    case 'clear':
      return;
    case 'retail_sign_band':
      pushSignBands(geometry, frame, Math.max(1, signBandLevels), 1.15);
      pushHorizontalBands(geometry, frame, Math.max(2, bandCount), 0.22, 0.98);
      return;
    case 'screen_band':
      pushSolidPanel(geometry, frame, 0.1);
      pushTopBillboardZone(geometry, frame);
      return;
    case 'window_grid':
      pushHorizontalBands(geometry, frame, Math.max(2, bandCount), 0.4, 0.98);
      pushVerticalMullions(geometry, frame, 'dense', glazing, repeatX);
      return;
    case 'solid_panel':
      pushHorizontalBands(
        geometry,
        frame,
        Math.max(1, Math.floor(bandCount / 2)),
        0.82,
        0.98,
      );
      return;
    default:
      return;
  }
}

export function pushHorizontalBands(
  geometry: GeometryBuffers,
  frame: PartialFacadeFrame,
  bandCount: number,
  bandFill: number,
  topCapRatio: number,
): void {
  const yMin = getFrameYMin(frame);
  const yMax = getFrameYMax(frame);
  const availableHeight = Math.max(0.4, yMax - yMin);
  const margin = Math.min(0.6, availableHeight * 0.12);
  const step = Math.max(
    0.8,
    (availableHeight - margin * 2) / Math.max(1, bandCount),
  );
  for (let band = 0; band < bandCount; band += 1) {
    const y0 = Math.min(yMax - 0.2, yMin + margin + band * step);
    const y1 = Math.min(
      yMin + availableHeight * topCapRatio,
      y0 + Math.min(step * bandFill, 1.05),
    );
    if (y1 <= y0 + 0.08) {
      continue;
    }
    pushFacadeSlab(geometry, frame, y0, y1, 0.08);
  }
}

export function pushVerticalMullions(
  geometry: GeometryBuffers,
  frame: PartialFacadeFrame,
  density: WindowPatternDensity,
  glazingRatio: number,
  overrideCount?: number,
): void {
  const yMin = getFrameYMin(frame) + 0.25;
  const yMax = getFrameYMax(frame) - 0.25;
  if (yMax <= yMin + 0.3) {
    return;
  }
  const mullionCount =
    overrideCount ?? (density === 'dense' ? 7 : density === 'medium' ? 5 : 3);
  for (let index = 1; index < mullionCount; index += 1) {
    const t = index / mullionCount;
    const x0 = frame.a[0] + (frame.b[0] - frame.a[0]) * t;
    const z0 = frame.a[2] + (frame.b[2] - frame.a[2]) * t;
    const width = Math.max(0.06, 0.14 - glazingRatio * 0.06);
    pushVerticalMullionVolume(
      geometry,
      frame,
      [x0, 0, z0],
      yMin,
      yMax,
      width,
      0.1,
    );
  }
}

export function pushSignBands(
  geometry: GeometryBuffers,
  frame: PartialFacadeFrame,
  levels: number,
  bandHeight: number,
): void {
  const yMin = getFrameYMin(frame);
  const yMax = getFrameYMax(frame);
  for (let level = 0; level < levels; level += 1) {
    const y0 = yMin + 0.35 + level * (bandHeight + 0.2);
    const y1 = Math.min(yMax - 0.12, y0 + bandHeight);
    if (y1 <= y0 + 0.08) {
      continue;
    }
    pushFacadeSlab(geometry, frame, y0, y1, 0.14);
  }
}

export function pushTopBillboardZone(
  geometry: GeometryBuffers,
  frame: PartialFacadeFrame,
): void {
  const yMin = getFrameYMin(frame);
  const yMax = getFrameYMax(frame);
  const topStart = Math.max(yMin + (yMax - yMin) * 0.18, yMax - 2.8);
  const topEnd = Math.min(
    yMax - 0.08,
    topStart + Math.min(2.8, yMax - yMin - 0.12),
  );
  if (topEnd <= topStart + 0.08) {
    return;
  }
  pushFacadeSlab(geometry, frame, topStart, topEnd, 0.16);
}

export function pushCanopyBand(
  geometry: GeometryBuffers,
  frame: PartialFacadeFrame,
  canopyHeight: number,
): void {
  const yMin = getFrameYMin(frame);
  const yMax = getFrameYMax(frame);
  const y0 = Math.min(yMax - 0.35, Math.max(yMin + 0.2, yMin + 4));
  const y1 = Math.min(yMax - 0.05, y0 + Math.max(1.2, canopyHeight * 0.18));
  if (y1 <= y0 + 0.08) {
    return;
  }
  pushFacadeSlab(geometry, frame, y0, y1, 0.18);
}

export function pushSolidPanel(
  geometry: GeometryBuffers,
  frame: PartialFacadeFrame,
  insetY: number,
): void {
  const yMin = getFrameYMin(frame) + insetY;
  const yMax = getFrameYMax(frame) - insetY;
  if (yMax <= yMin + 0.08) {
    return;
  }
  pushFacadeSlab(geometry, frame, yMin, yMax, 0.1);
}
