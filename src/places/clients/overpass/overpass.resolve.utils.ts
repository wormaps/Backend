import {
  estimateBuildingHeight,
  type EstimationConfidence,
} from '../../domain/building-height.estimator';

/** 도로 차선당 기본 너비 (m). 도시부 기준. */
const DEFAULT_LANE_WIDTH_M = 3.5;

/** 2차로 도로 차선당 너비 (m). */
const TWO_LANE_WIDTH_M = 3.2;

/** 보행자 도로 기본 너비 (m). */
const PEDESTRIAN_WALKWAY_WIDTH_M = 5;

/** 계단 기본 너비 (m). */
const STEPS_WIDTH_M = 2.5;

/** 기본 도로 너비 (m). */
const DEFAULT_ROAD_WIDTH_M = 4;

/** 기본 보행자 도로 너비 (m). */
const DEFAULT_WALKWAY_WIDTH_M = 3;

/** 최소 유효 차선 수. */
const MIN_VALID_LANES = 1;

export function resolveLaneCount(tags?: Record<string, string>): number {
  const lanes = Number.parseInt(tags?.lanes ?? '', 10);
  return Number.isInteger(lanes) && lanes > MIN_VALID_LANES ? lanes : 2;
}

function resolveWidth(tags?: Record<string, string>): number {
  const width = Number.parseFloat(tags?.width ?? '');
  return Number.isFinite(width) && width > 0 ? width : DEFAULT_ROAD_WIDTH_M;
}

export function resolveRoadWidth(tags?: Record<string, string>): number {
  const explicitWidth = resolveWidth(tags);
  if (Number.isFinite(explicitWidth) && explicitWidth > 0 && tags?.width) {
    return explicitWidth;
  }

  const lanes = resolveLaneCount(tags);
  const roadClass = tags?.highway ?? '';
  const fallbackPerLane = ['motorway', 'trunk', 'primary'].includes(roadClass)
    ? DEFAULT_LANE_WIDTH_M
    : ['secondary', 'tertiary'].includes(roadClass)
      ? TWO_LANE_WIDTH_M
      : 3;

  return lanes * fallbackPerLane;
}

export function resolveWalkwayWidth(tags?: Record<string, string>): number {
  const explicitWidth = resolveWidth(tags);
  if (Number.isFinite(explicitWidth) && explicitWidth > 0 && tags?.width) {
    return explicitWidth;
  }

  const walkwayType = tags?.highway ?? tags?.footway ?? '';
  if (walkwayType === 'pedestrian') {
    return PEDESTRIAN_WALKWAY_WIDTH_M;
  }

  if (walkwayType === 'steps') {
    return STEPS_WIDTH_M;
  }

  return DEFAULT_WALKWAY_WIDTH_M;
}

export function resolveHeight(
  tags?: Record<string, string>,
  contextMedian?: number,
): number {
  return estimateBuildingHeight(tags, contextMedian).heightMeters;
}

export function resolveHeightConfidence(
  tags?: Record<string, string>,
  contextMedian?: number,
): EstimationConfidence {
  return estimateBuildingHeight(tags, contextMedian).confidence;
}

export function resolveUsage(
  tags?: Record<string, string>,
): 'COMMERCIAL' | 'TRANSIT' | 'MIXED' | 'PUBLIC' {
  if (tags?.building === 'station' || tags?.railway === 'station') {
    return 'TRANSIT';
  }

  if (tags?.office || tags?.shop || tags?.amenity === 'restaurant') {
    return 'COMMERCIAL';
  }

  if (tags?.government || tags?.amenity === 'townhall') {
    return 'PUBLIC';
  }

  return 'MIXED';
}
