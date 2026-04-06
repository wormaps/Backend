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

export function resolveHeight(tags?: Record<string, string>): number {
  const height = Number.parseFloat(tags?.height ?? '');
  if (Number.isFinite(height) && height > 0) {
    return height;
  }

  const levels = Number.parseInt(tags?.['building:levels'] ?? '', 10);
  if (Number.isInteger(levels) && levels > 0) {
    return levels * 3.2;
  }

  return 15;
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
