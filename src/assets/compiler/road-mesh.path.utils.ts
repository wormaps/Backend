import type { Coordinate } from '../../places/types/place.types';
import { GeometryBuffers, Vec3 } from './road-mesh.types';
import {
  computePathNormal,
  isFiniteVec2,
  isFiniteVec3,
  pushQuad,
  samePointXZ,
  toLocalPoint,
} from './road-mesh.geometry.utils';

export function pushPathStrips(
  origin: Coordinate,
  geometry: GeometryBuffers,
  path: Coordinate[],
  width: number,
  y: number,
): void {
  const localPath = path
    .map((point) => toLocalPoint(origin, point))
    .filter((point) => isFiniteVec3(point))
    .filter((point, index, array) => {
      const prev = array[index - 1];
      return !prev || !samePointXZ(prev, point);
    });

  if (localPath.length < 2) {
    return;
  }

  const half = width / 2;
  const left: Vec3[] = [];
  const right: Vec3[] = [];

  for (let i = 0; i < localPath.length; i += 1) {
    const current = localPath[i];
    const prev = localPath[i - 1] ?? current;
    const next = localPath[i + 1] ?? current;
    const normal = computePathNormal(prev, current, next);
    if (!isFiniteVec2(normal)) {
      continue;
    }
    left.push([
      current[0] + normal[0] * half,
      y,
      current[2] + normal[1] * half,
    ]);
    right.push([
      current[0] - normal[0] * half,
      y,
      current[2] - normal[1] * half,
    ]);
  }

  for (let i = 0; i < localPath.length - 1; i += 1) {
    if (!left[i] || !right[i] || !left[i + 1] || !right[i + 1]) {
      continue;
    }
    pushQuad(geometry, left[i], right[i], right[i + 1], left[i + 1]);
  }
}

export function pushPathEdgeBands(
  origin: Coordinate,
  geometry: GeometryBuffers,
  path: Coordinate[],
  width: number,
  edgeWidth: number,
  y: number,
): void {
  const localPath = path
    .map((point) => toLocalPoint(origin, point))
    .filter((point) => isFiniteVec3(point))
    .filter((point, index, array) => {
      const prev = array[index - 1];
      return !prev || !samePointXZ(prev, point);
    });

  if (localPath.length < 2) {
    return;
  }

  const outerHalf = width / 2;
  const innerHalf = Math.max(0.4, outerHalf - edgeWidth);
  const leftOuter: Vec3[] = [];
  const leftInner: Vec3[] = [];
  const rightOuter: Vec3[] = [];
  const rightInner: Vec3[] = [];

  for (let i = 0; i < localPath.length; i += 1) {
    const current = localPath[i];
    const prev = localPath[i - 1] ?? current;
    const next = localPath[i + 1] ?? current;
    const normal = computePathNormal(prev, current, next);
    if (!isFiniteVec2(normal)) {
      continue;
    }
    leftOuter.push([
      current[0] + normal[0] * outerHalf,
      y,
      current[2] + normal[1] * outerHalf,
    ]);
    leftInner.push([
      current[0] + normal[0] * innerHalf,
      y,
      current[2] + normal[1] * innerHalf,
    ]);
    rightInner.push([
      current[0] - normal[0] * innerHalf,
      y,
      current[2] - normal[1] * innerHalf,
    ]);
    rightOuter.push([
      current[0] - normal[0] * outerHalf,
      y,
      current[2] - normal[1] * outerHalf,
    ]);
  }

  for (let i = 0; i < localPath.length - 1; i += 1) {
    if (
      !leftOuter[i] ||
      !leftInner[i] ||
      !leftOuter[i + 1] ||
      !leftInner[i + 1] ||
      !rightOuter[i] ||
      !rightInner[i] ||
      !rightOuter[i + 1] ||
      !rightInner[i + 1]
    ) {
      continue;
    }
    pushQuad(
      geometry,
      leftOuter[i],
      leftInner[i],
      leftInner[i + 1],
      leftOuter[i + 1],
    );
    pushQuad(
      geometry,
      rightInner[i],
      rightOuter[i],
      rightOuter[i + 1],
      rightInner[i + 1],
    );
  }
}

export function pushPathCurb(
  origin: Coordinate,
  geometry: GeometryBuffers,
  path: Coordinate[],
  roadWidth: number,
  curbWidth: number,
  curbHeight: number,
): void {
  const localPath = path
    .map((point) => toLocalPoint(origin, point))
    .filter((point) => isFiniteVec3(point))
    .filter((point, index, array) => {
      const prev = array[index - 1];
      return !prev || !samePointXZ(prev, point);
    });

  if (localPath.length < 2) {
    return;
  }

  const halfRoad = roadWidth / 2;
  const leftOuter: Vec3[] = [];
  const leftInner: Vec3[] = [];
  const rightOuter: Vec3[] = [];
  const rightInner: Vec3[] = [];

  for (let i = 0; i < localPath.length; i += 1) {
    const current = localPath[i];
    const prev = localPath[i - 1] ?? current;
    const next = localPath[i + 1] ?? current;
    const normal = computePathNormal(prev, current, next);
    if (!isFiniteVec2(normal)) {
      continue;
    }
    leftOuter.push([
      current[0] + normal[0] * halfRoad,
      curbHeight,
      current[2] + normal[1] * halfRoad,
    ]);
    leftInner.push([
      current[0] + normal[0] * (halfRoad + curbWidth),
      curbHeight,
      current[2] + normal[1] * (halfRoad + curbWidth),
    ]);
    rightOuter.push([
      current[0] - normal[0] * halfRoad,
      curbHeight,
      current[2] - normal[1] * halfRoad,
    ]);
    rightInner.push([
      current[0] - normal[0] * (halfRoad + curbWidth),
      curbHeight,
      current[2] - normal[1] * (halfRoad + curbWidth),
    ]);
  }

  for (let i = 0; i < localPath.length - 1; i += 1) {
    if (
      !leftOuter[i] ||
      !leftInner[i] ||
      !leftOuter[i + 1] ||
      !leftInner[i + 1] ||
      !rightOuter[i] ||
      !rightInner[i] ||
      !rightOuter[i + 1] ||
      !rightInner[i + 1]
    ) {
      continue;
    }
    pushQuad(
      geometry,
      leftOuter[i],
      leftInner[i],
      leftInner[i + 1],
      leftOuter[i + 1],
    );
    pushQuad(
      geometry,
      rightInner[i],
      rightOuter[i],
      rightOuter[i + 1],
      rightInner[i + 1],
    );
    pushCurbVerticalFace(
      geometry,
      leftOuter[i],
      leftInner[i],
      leftOuter[i + 1],
      leftInner[i + 1],
      0,
    );
    pushCurbVerticalFace(
      geometry,
      rightInner[i],
      rightOuter[i],
      rightInner[i + 1],
      rightOuter[i + 1],
      0,
    );
  }
}

function pushCurbVerticalFace(
  geometry: GeometryBuffers,
  outerStart: Vec3,
  innerStart: Vec3,
  outerEnd: Vec3,
  innerEnd: Vec3,
  baseY: number,
): void {
  const baseOuterStart: Vec3 = [outerStart[0], baseY, outerStart[2]];
  const baseInnerStart: Vec3 = [innerStart[0], baseY, innerStart[2]];
  const baseOuterEnd: Vec3 = [outerEnd[0], baseY, outerEnd[2]];
  const baseInnerEnd: Vec3 = [innerEnd[0], baseY, innerEnd[2]];
  pushQuad(
    geometry,
    baseOuterStart,
    baseInnerStart,
    baseInnerEnd,
    baseOuterEnd,
  );
}

export function pushPathMedian(
  origin: Coordinate,
  geometry: GeometryBuffers,
  path: Coordinate[],
  _roadWidth: number,
  medianWidth: number,
  medianHeight: number,
): void {
  const localPath = path
    .map((point) => toLocalPoint(origin, point))
    .filter((point) => isFiniteVec3(point))
    .filter((point, index, array) => {
      const prev = array[index - 1];
      return !prev || !samePointXZ(prev, point);
    });

  if (localPath.length < 2) {
    return;
  }

  const halfMedian = medianWidth / 2;
  const left: Vec3[] = [];
  const right: Vec3[] = [];

  for (let i = 0; i < localPath.length; i += 1) {
    const current = localPath[i];
    const prev = localPath[i - 1] ?? current;
    const next = localPath[i + 1] ?? current;
    const normal = computePathNormal(prev, current, next);
    if (!isFiniteVec2(normal)) {
      continue;
    }
    left.push([
      current[0] - normal[0] * halfMedian,
      medianHeight,
      current[2] - normal[1] * halfMedian,
    ]);
    right.push([
      current[0] + normal[0] * halfMedian,
      medianHeight,
      current[2] + normal[1] * halfMedian,
    ]);
  }

  for (let i = 0; i < localPath.length - 1; i += 1) {
    if (!left[i] || !right[i] || !left[i + 1] || !right[i + 1]) {
      continue;
    }
    pushQuad(geometry, left[i], right[i], right[i + 1], left[i + 1]);
    pushMedianVerticalFace(
      geometry,
      left[i],
      right[i],
      left[i + 1],
      right[i + 1],
      0.01,
    );
  }
}

function pushMedianVerticalFace(
  geometry: GeometryBuffers,
  leftStart: Vec3,
  rightStart: Vec3,
  leftEnd: Vec3,
  rightEnd: Vec3,
  baseY: number,
): void {
  const baseLeftStart: Vec3 = [leftStart[0], baseY, leftStart[2]];
  const baseRightStart: Vec3 = [rightStart[0], baseY, rightStart[2]];
  const baseLeftEnd: Vec3 = [leftEnd[0], baseY, leftEnd[2]];
  const baseRightEnd: Vec3 = [rightEnd[0], baseY, rightEnd[2]];
  pushQuad(geometry, baseLeftStart, baseRightStart, baseRightEnd, baseLeftEnd);
}

export function pushPathSidewalkEdge(
  origin: Coordinate,
  geometry: GeometryBuffers,
  path: Coordinate[],
  walkwayWidth: number,
  edgeWidth: number,
  edgeHeight: number,
): void {
  const localPath = path
    .map((point) => toLocalPoint(origin, point))
    .filter((point) => isFiniteVec3(point))
    .filter((point, index, array) => {
      const prev = array[index - 1];
      return !prev || !samePointXZ(prev, point);
    });

  if (localPath.length < 2) {
    return;
  }

  const halfWalkway = walkwayWidth / 2;
  const leftOuter: Vec3[] = [];
  const leftInner: Vec3[] = [];
  const rightOuter: Vec3[] = [];
  const rightInner: Vec3[] = [];

  for (let i = 0; i < localPath.length; i += 1) {
    const current = localPath[i];
    const prev = localPath[i - 1] ?? current;
    const next = localPath[i + 1] ?? current;
    const normal = computePathNormal(prev, current, next);
    if (!isFiniteVec2(normal)) {
      continue;
    }
    leftOuter.push([
      current[0] + normal[0] * halfWalkway,
      edgeHeight,
      current[2] + normal[1] * halfWalkway,
    ]);
    leftInner.push([
      current[0] + normal[0] * (halfWalkway + edgeWidth),
      edgeHeight,
      current[2] + normal[1] * (halfWalkway + edgeWidth),
    ]);
    rightOuter.push([
      current[0] - normal[0] * halfWalkway,
      edgeHeight,
      current[2] - normal[1] * halfWalkway,
    ]);
    rightInner.push([
      current[0] - normal[0] * (halfWalkway + edgeWidth),
      edgeHeight,
      current[2] - normal[1] * (halfWalkway + edgeWidth),
    ]);
  }

  for (let i = 0; i < localPath.length - 1; i += 1) {
    if (
      !leftOuter[i] ||
      !leftInner[i] ||
      !leftOuter[i + 1] ||
      !leftInner[i + 1] ||
      !rightOuter[i] ||
      !rightInner[i] ||
      !rightOuter[i + 1] ||
      !rightInner[i + 1]
    ) {
      continue;
    }
    pushQuad(
      geometry,
      leftOuter[i],
      leftInner[i],
      leftInner[i + 1],
      leftOuter[i + 1],
    );
    pushQuad(
      geometry,
      rightInner[i],
      rightOuter[i],
      rightOuter[i + 1],
      rightInner[i + 1],
    );
    pushSidewalkEdgeVerticalFace(
      geometry,
      leftOuter[i],
      leftInner[i],
      leftOuter[i + 1],
      leftInner[i + 1],
      0.015,
    );
    pushSidewalkEdgeVerticalFace(
      geometry,
      rightInner[i],
      rightOuter[i],
      rightInner[i + 1],
      rightOuter[i + 1],
      0.015,
    );
  }
}

function pushSidewalkEdgeVerticalFace(
  geometry: GeometryBuffers,
  outerStart: Vec3,
  innerStart: Vec3,
  outerEnd: Vec3,
  innerEnd: Vec3,
  baseY: number,
): void {
  const baseOuterStart: Vec3 = [outerStart[0], baseY, outerStart[2]];
  const baseInnerStart: Vec3 = [innerStart[0], baseY, innerStart[2]];
  const baseOuterEnd: Vec3 = [outerEnd[0], baseY, outerEnd[2]];
  const baseInnerEnd: Vec3 = [innerEnd[0], baseY, innerEnd[2]];
  pushQuad(
    geometry,
    baseOuterStart,
    baseInnerStart,
    baseInnerEnd,
    baseOuterEnd,
  );
}
