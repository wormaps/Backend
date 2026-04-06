import type {
  Coordinate,
  PlacePackage,
} from '../../../places/types/place.types';
import type { SceneFacadeContextProfile } from '../../types/scene.types';

export interface BuildingAnchorContext {
  id: string;
  usage: PlacePackage['buildings'][number]['usage'];
  heightMeters: number;
  anchor: Coordinate;
}

export interface FacadeContext {
  districtProfile: SceneFacadeContextProfile;
  centerBias: 'core' | 'mid' | 'edge';
  arterialRoadCount: number;
  crossingCount: number;
  commercialNeighborCount: number;
  tallNeighborCount: number;
  poiNeighborCount: number;
  landmarkNeighborCount: number;
}

export function buildFacadeContext(
  building: PlacePackage['buildings'][number],
  anchor: Coordinate,
  proximityToCenter: number,
  placePackage: PlacePackage,
  buildingAnchors: BuildingAnchorContext[],
): FacadeContext {
  const arterialRoadCount = placePackage.roads.filter(
    (road) =>
      isArterialRoad(road.roadClass) &&
      distanceToPathMeters(anchor, road.path) <= 45,
  ).length;
  const crossingCount = placePackage.crossings.filter(
    (crossing) => distanceMeters(anchor, crossing.center) <= 55,
  ).length;
  const commercialNeighborCount = buildingAnchors.filter(
    (candidate) =>
      candidate.id !== building.id &&
      candidate.usage === 'COMMERCIAL' &&
      distanceMeters(anchor, candidate.anchor) <= 70,
  ).length;
  const tallNeighborCount = buildingAnchors.filter(
    (candidate) =>
      candidate.id !== building.id &&
      candidate.heightMeters >= 28 &&
      distanceMeters(anchor, candidate.anchor) <= 90,
  ).length;
  const poiNeighborCount = placePackage.pois.filter(
    (poi) =>
      (poi.type === 'SHOP' ||
        poi.type === 'LANDMARK' ||
        poi.type === 'ENTRANCE') &&
      distanceMeters(anchor, poi.location) <= 65,
  ).length;
  const landmarkNeighborCount = placePackage.landmarks.filter(
    (poi) => distanceMeters(anchor, poi.location) <= 90,
  ).length;
  const centerBias =
    proximityToCenter <= 150
      ? 'core'
      : proximityToCenter <= 300
        ? 'mid'
        : 'edge';

  let districtProfile: FacadeContext['districtProfile'] = 'RESIDENTIAL_EDGE';
  if (
    building.usage === 'TRANSIT' ||
    (arterialRoadCount >= 2 && crossingCount >= 2)
  ) {
    districtProfile = 'TRANSIT_HUB';
  } else if (
    (building.usage === 'COMMERCIAL' || building.usage === 'MIXED') &&
    centerBias === 'core' &&
    (commercialNeighborCount >= 1 ||
      crossingCount >= 2 ||
      tallNeighborCount >= 1 ||
      poiNeighborCount >= 3 ||
      landmarkNeighborCount >= 1)
  ) {
    districtProfile = 'NEON_CORE';
  } else if (
    ((building.usage === 'COMMERCIAL' || building.usage === 'MIXED') &&
      (centerBias !== 'edge' ||
        arterialRoadCount >= 1 ||
        commercialNeighborCount >= 1 ||
        crossingCount >= 1 ||
        poiNeighborCount >= 2)) ||
    (centerBias === 'core' && poiNeighborCount >= 4)
  ) {
    districtProfile = 'COMMERCIAL_STRIP';
  } else if (building.usage === 'PUBLIC') {
    districtProfile = 'CIVIC_CLUSTER';
  }

  return {
    districtProfile,
    centerBias,
    arterialRoadCount,
    crossingCount,
    commercialNeighborCount,
    tallNeighborCount,
    poiNeighborCount,
    landmarkNeighborCount,
  };
}

export function sortCounts(
  source: Map<string, number>,
): { key: string; count: number }[] {
  return [...source.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort(
      (left, right) =>
        right.count - left.count || left.key.localeCompare(right.key),
    );
}

export function averageCoordinate(points: Coordinate[]): Coordinate | null {
  if (points.length === 0) {
    return null;
  }

  const total = points.reduce(
    (acc, point) => ({
      lat: acc.lat + point.lat,
      lng: acc.lng + point.lng,
    }),
    { lat: 0, lng: 0 },
  );

  return {
    lat: total.lat / points.length,
    lng: total.lng / points.length,
  };
}

export function densityFromEvidence(
  imageCount: number,
  featureCount: number,
  usage: PlacePackage['buildings'][number]['usage'],
  proximityToCenter: number,
): 'low' | 'medium' | 'high' {
  const weighted = imageCount * 1.4 + featureCount * 1.8;
  if (usage === 'COMMERCIAL' && (weighted >= 9 || proximityToCenter <= 80)) {
    return 'high';
  }
  if (weighted >= 4 || (usage === 'COMMERCIAL' && proximityToCenter <= 160)) {
    return 'medium';
  }

  return 'low';
}

export function distanceMeters(a: Coordinate, b: Coordinate): number {
  const dx =
    (a.lng - b.lng) *
    111_320 *
    Math.cos((((a.lat + b.lat) / 2) * Math.PI) / 180);
  const dy = (a.lat - b.lat) * 111_320;
  return Math.hypot(dx, dy);
}

function isArterialRoad(roadClass: string): boolean {
  const normalized = roadClass.toLowerCase();
  return (
    normalized.includes('trunk') ||
    normalized.includes('primary') ||
    normalized.includes('secondary')
  );
}

function distanceToPathMeters(anchor: Coordinate, path: Coordinate[]): number {
  if (path.length === 0) {
    return Number.POSITIVE_INFINITY;
  }

  let nearest = Number.POSITIVE_INFINITY;
  for (const point of path) {
    nearest = Math.min(nearest, distanceMeters(anchor, point));
  }
  return nearest;
}
