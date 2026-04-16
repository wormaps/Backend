import type { SceneFacadeHint } from '../../../scene/types/scene.types';
import type { GeometryBuffers, Vec3 } from '../road/road-mesh.builder';
import { averagePoint } from './building-mesh-utils';
import { pushQuad } from './building-mesh.geometry-primitives';

export interface FacadeFrame {
  a: Vec3;
  b: Vec3;
  height: number;
  normal: Vec3;
  yBase: number;
}

export interface SplitFacadeFrame extends FacadeFrame {
  yMin: number;
  yMax: number;
}

export type PartialFacadeFrame = FacadeFrame | SplitFacadeFrame;

export function resolveLongestEdgeIndex(points: Vec3[]): number {
  let longestIndex = 0;
  let longestLength = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    const length = Math.hypot(next[0] - current[0], next[2] - current[2]);
    if (length > longestLength) {
      longestLength = length;
      longestIndex = index;
    }
  }
  return longestIndex;
}

export function buildFacadeFrame(
  ring: Vec3[],
  edgeIndex: number,
  facadeHeight: number,
  yBase = 0,
): FacadeFrame | null {
  const current = ring[edgeIndex];
  const next = ring[(edgeIndex + 1) % ring.length];
  if (!current || !next) {
    return null;
  }
  const centroid = averagePoint(ring);
  const edge = [next[0] - current[0], 0, next[2] - current[2]] as Vec3;
  const edgeLength = Math.hypot(edge[0], edge[2]);
  if (edgeLength <= 0.28) {
    return null;
  }
  let normal: Vec3 = [-edge[2] / edgeLength, 0, edge[0] / edgeLength];
  const midpoint: Vec3 = [
    (current[0] + next[0]) / 2,
    0,
    (current[2] + next[2]) / 2,
  ];
  const toCentroid: Vec3 = [
    centroid[0] - midpoint[0],
    0,
    centroid[2] - midpoint[2],
  ];
  if (normal[0] * toCentroid[0] + normal[2] * toCentroid[2] > 0) {
    normal = [-normal[0], 0, -normal[2]];
  }
  const offset = 0.22;
  return {
    a: [current[0] + normal[0] * offset, 0, current[2] + normal[2] * offset],
    b: [next[0] + normal[0] * offset, 0, next[2] + normal[2] * offset],
    height: facadeHeight,
    normal,
    yBase,
  };
}

export function splitFacadeFrame(
  frame: FacadeFrame,
  yMin: number,
  yMax: number,
): SplitFacadeFrame {
  return {
    ...frame,
    yMin: Math.max(0, yMin),
    yMax: Math.max(yMin, Math.min(frame.height, yMax)),
  };
}

export function pushFacadeBacking(
  geometry: GeometryBuffers,
  frame: FacadeFrame,
  depth: number,
  hint: SceneFacadeHint,
): void {
  const insetTop = hint.facadePreset === 'glass_grid' ? 0.35 : 0.2;
  const yMin = 0.22;
  const yMax = Math.max(yMin + 0.8, frame.height - insetTop);
  pushFacadeSlab(geometry, frame, yMin, yMax, depth);
}

export function pushFacadeSlab(
  geometry: GeometryBuffers,
  frame: PartialFacadeFrame,
  yMin: number,
  yMax: number,
  depth: number,
): void {
  if (yMax <= yMin + 0.08) {
    return;
  }
  const resolvedYMin = frame.yBase + yMin;
  const resolvedYMax = frame.yBase + yMax;
  const frontA: Vec3 = [frame.a[0], resolvedYMin, frame.a[2]];
  const frontB: Vec3 = [frame.b[0], resolvedYMin, frame.b[2]];
  const frontC: Vec3 = [frame.b[0], resolvedYMax, frame.b[2]];
  const frontD: Vec3 = [frame.a[0], resolvedYMax, frame.a[2]];
  const backA: Vec3 = [
    frame.a[0] - frame.normal[0] * depth,
    resolvedYMin,
    frame.a[2] - frame.normal[2] * depth,
  ];
  const backB: Vec3 = [
    frame.b[0] - frame.normal[0] * depth,
    resolvedYMin,
    frame.b[2] - frame.normal[2] * depth,
  ];
  const backC: Vec3 = [
    frame.b[0] - frame.normal[0] * depth,
    resolvedYMax,
    frame.b[2] - frame.normal[2] * depth,
  ];
  const backD: Vec3 = [
    frame.a[0] - frame.normal[0] * depth,
    resolvedYMax,
    frame.a[2] - frame.normal[2] * depth,
  ];

  pushQuad(geometry, frontA, frontB, frontC, frontD);
  pushQuad(geometry, backB, backA, backD, backC);
  pushQuad(geometry, backA, frontA, frontD, backD);
  pushQuad(geometry, frontB, backB, backC, frontC);
  pushQuad(geometry, frontD, frontC, backC, backD);
  pushQuad(geometry, backA, backB, frontB, frontA);
}

export function pushVerticalMullionVolume(
  geometry: GeometryBuffers,
  frame: PartialFacadeFrame,
  center: Vec3,
  yMin: number,
  yMax: number,
  width: number,
  depth: number,
): void {
  const edgeDx = frame.b[0] - frame.a[0];
  const edgeDz = frame.b[2] - frame.a[2];
  const edgeLength = Math.hypot(edgeDx, edgeDz);
  if (edgeLength <= 1e-6) {
    return;
  }
  const tangent: Vec3 = [edgeDx / edgeLength, 0, edgeDz / edgeLength];
  const halfWidth = width / 2;
  const left = [
    center[0] - tangent[0] * halfWidth,
    0,
    center[2] - tangent[2] * halfWidth,
  ] as Vec3;
  const right = [
    center[0] + tangent[0] * halfWidth,
    0,
    center[2] + tangent[2] * halfWidth,
  ] as Vec3;
  pushFacadeSlab(
    geometry,
    {
      ...frame,
      a: left,
      b: right,
    },
    yMin,
    yMax,
    depth,
  );
}

export function resolveFacadeBackingDepth(hint: SceneFacadeHint): number {
  if (hint.facadePreset === 'glass_grid') {
    return 0.1;
  }
  if (hint.signageDensity === 'high') {
    return 0.14;
  }

  return 0.12;
}

export function getFrameYMin(frame: PartialFacadeFrame): number {
  return 'yMin' in frame ? frame.yMin : 0;
}

export function getFrameYMax(frame: PartialFacadeFrame): number {
  return 'yMax' in frame ? frame.yMax : frame.height;
}
