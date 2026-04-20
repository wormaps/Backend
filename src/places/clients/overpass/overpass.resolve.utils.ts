import {
  estimateBuildingHeight,
  type EstimationConfidence,
} from '../../domain/building-height.estimator';

export function resolveLaneCount(tags?: Record<string, string>): number {
  const lanes = Number.parseInt(tags?.lanes ?? '', 10);
  return Number.isInteger(lanes) && lanes > 0 ? lanes : 2;
}

function resolveWidth(tags?: Record<string, string>): number {
  const width = Number.parseFloat(tags?.width ?? '');
  return Number.isFinite(width) && width > 0 ? width : 4;
}

export function resolveRoadWidth(tags?: Record<string, string>): number {
  const explicitWidth = resolveWidth(tags);
  if (Number.isFinite(explicitWidth) && explicitWidth > 0 && tags?.width) {
    return explicitWidth;
  }

  const lanes = resolveLaneCount(tags);
  const roadClass = tags?.highway ?? '';
  const fallbackPerLane = ['motorway', 'trunk', 'primary'].includes(roadClass)
    ? 3.5
    : ['secondary', 'tertiary'].includes(roadClass)
      ? 3.2
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
    return 5;
  }

  if (walkwayType === 'steps') {
    return 2.5;
  }

  return 3;
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
