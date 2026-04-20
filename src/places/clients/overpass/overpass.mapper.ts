import type {
  BuildingData,
  Coordinate,
  CrossingData,
  LandCoverData,
  LinearFeatureData,
  PlacePackage,
  PoiData,
  StreetFurnitureData,
  VegetationData,
} from '../../types/place.types';
import {
  computeContextMedian,
} from '../../domain/building-height.estimator';
import {
  coordinatesEqual,
  isFiniteCoordinate,
  midpoint,
  polygonSignedArea,
} from '../../utils/geo.utils';
import type { OverpassElement } from './overpass.types';
import {
  resolveHeight,
  resolveHeightConfidence,
  resolveLaneCount,
  resolveRoadWidth,
  resolveUsage,
  resolveWalkwayWidth,
} from './overpass.resolve.utils';

export function mapGeometry(
  geometry: Array<{ lat: number; lon: number }>,
): Coordinate[] {
  return geometry.map((point) => ({
    lat: point.lat,
    lng: point.lon,
  }));
}

export function mapPoi(node: OverpassElement): PoiData | null {
  const tags = node.tags ?? {};
  const location = {
    lat: typeof node.lat === 'number' ? node.lat : Number(node.lat),
    lng: typeof node.lon === 'number' ? node.lon : Number(node.lon),
  };
  if (!isFiniteCoordinate(location)) {
    return null;
  }
  const isLandmark =
    Boolean(tags.tourism) || tags.historic === 'yes' || tags.memorial === 'yes';

  return {
    id: `poi-${node.id}`,
    name: tags.name ?? `poi-${node.id}`,
    type: isLandmark
      ? 'LANDMARK'
      : tags.public_transport
        ? 'ENTRANCE'
        : tags.shop
          ? 'SHOP'
          : 'SIGNAL',
    location,
  };
}

export function mapBuildings(
  elements: OverpassElement[],
): PlacePackage['buildings'] {
  const rawBuildings: Array<{
    id: string;
    tags: Record<string, string> | undefined;
    outerRing: Coordinate[];
    holes: Coordinate[][];
  }> = [];

  for (const element of elements) {
    if (element.type === 'relation') {
      const result = tryMapBuildingRelation(element);
      if (result) {
        rawBuildings.push(result);
      }
    } else {
      const outerRing = sanitizeRing(mapGeometry(element.geometry ?? []));
      if (outerRing !== null) {
        rawBuildings.push({
          id: `building-${element.id}`,
          tags: element.tags,
          outerRing,
          holes: [],
        });
      }
    }
  }

  const results: BuildingData[] = [];
  for (const raw of rawBuildings) {
    const buildingType = raw.tags?.building;
    const contextMedian = computeContextMedian(rawBuildings, buildingType);
    results.push(
      buildBuildingRecord(
        raw.id,
        raw.tags,
        raw.outerRing,
        raw.holes,
        contextMedian,
      ),
    );
  }

  return results;
}

export function mapBuilding(
  element: OverpassElement,
): PlacePackage['buildings'][number] | null {
  if (element.type === 'relation') {
    return mapBuildingRelation(element);
  }

  const outerRing = sanitizeRing(mapGeometry(element.geometry ?? []));
  if (outerRing === null) {
    return null;
  }

  return buildBuildingRecord(
    `building-${element.id}`,
    element.tags,
    outerRing,
    [],
  );
}

export function mapRoad(
  way: OverpassElement,
): PlacePackage['roads'][number] | null {
  const path = sanitizePath(mapGeometry(way.geometry ?? []));
  if (path === null) {
    return null;
  }

  return {
    id: `road-${way.id}`,
    name: way.tags?.name ?? `road-${way.id}`,
    laneCount: resolveLaneCount(way.tags),
    widthMeters: resolveRoadWidth(way.tags),
    roadClass: way.tags?.highway ?? 'road',
    direction: way.tags?.oneway === 'yes' ? 'ONE_WAY' : 'TWO_WAY',
    path,
    surface: way.tags?.surface ?? null,
    bridge: Boolean(way.tags?.bridge),
  };
}

export function mapWalkway(
  way: OverpassElement,
): PlacePackage['walkways'][number] | null {
  const path = sanitizePath(mapGeometry(way.geometry ?? []));
  if (path === null) {
    return null;
  }

  return {
    id: `walkway-${way.id}`,
    name: way.tags?.name ?? `walkway-${way.id}`,
    widthMeters: resolveWalkwayWidth(way.tags),
    walkwayType: way.tags?.highway ?? way.tags?.footway ?? 'footway',
    path,
    surface: way.tags?.surface ?? null,
  };
}

export function mapCrossing(way: OverpassElement): CrossingData | null {
  const path = sanitizePath(mapGeometry(way.geometry ?? []));
  if (path === null) {
    return null;
  }

  const center = midpoint(path);
  if (!center) {
    return null;
  }

  const tags = way.tags ?? {};

  return {
    id: `crossing-${way.id}`,
    name: tags.name ?? `crossing-${way.id}`,
    type: 'CROSSING',
    crossing: tags.crossing ?? tags['crossing:markings'] ?? null,
    crossingRef: tags.crossing_ref ?? null,
    signalized:
      tags.crossing === 'traffic_signals' ||
      tags.crossing === 'controlled' ||
      tags.crossing_signals === 'yes' ||
      tags['crossing:signals'] === 'yes' ||
      tags['crossing:signals'] === '1',
    tactilePaving:
      tags.tactile_paving === 'yes' ||
      tags.tactile_paving === '1' ||
      tags['crossing:tactile_paving'] === 'yes',
    crossingMarkings: tags['crossing:markings'] ?? null,
    path,
    center,
    osmTags: Object.keys(tags).length > 0 ? { ...tags } : undefined,
  };
}

export function mapStreetFurniture(
  node: OverpassElement,
): StreetFurnitureData | null {
  const location = {
    lat: typeof node.lat === 'number' ? node.lat : Number(node.lat),
    lng: typeof node.lon === 'number' ? node.lon : Number(node.lon),
  };
  if (!isFiniteCoordinate(location)) {
    return null;
  }

  const tags = node.tags ?? {};
  const type = resolveStreetFurnitureType(tags);

  if (!type) {
    return null;
  }

  return {
    id: `street-furniture-${node.id}`,
    name: tags.name ?? `${type.toLowerCase()}-${node.id}`,
    type,
    location,
    osmTags: Object.keys(tags).length > 0 ? { ...tags } : undefined,
  };
}

function resolveStreetFurnitureType(
  tags: Record<string, string>,
): StreetFurnitureData['type'] | null {
  if (tags.highway === 'traffic_signals') return 'TRAFFIC_LIGHT';
  if (tags.highway === 'street_lamp') return 'STREET_LIGHT';
  if (tags.traffic_sign) return 'SIGN_POLE';
  if (tags.highway === 'bollard') return 'BOLLARD';
  if (tags.amenity === 'bench') return 'BENCH';
  if (tags.amenity === 'waste_basket' || tags.amenity === 'waste_disposal') {
    return 'TRASH_CAN';
  }
  if (tags.amenity === 'post_box') return 'POST_BOX';
  if (tags.amenity === 'public_phone') return 'PUBLIC_PHONE';
  if (tags.amenity === 'vending_machine') return 'VENDING_MACHINE';
  if (tags.advertising) return 'ADVERTISING';
  return null;
}

export function mapVegetation(node: OverpassElement): VegetationData | null {
  const location = {
    lat: typeof node.lat === 'number' ? node.lat : Number(node.lat),
    lng: typeof node.lon === 'number' ? node.lon : Number(node.lon),
  };
  if (!isFiniteCoordinate(location)) {
    return null;
  }

  const tags = node.tags ?? {};
  const type = resolveVegetationType(tags);
  const radiusMeters = resolveVegetationRadius(tags, type);

  return {
    id: `vegetation-${node.id}`,
    name: tags.name ?? `${type.toLowerCase()}-${node.id}`,
    type,
    location,
    radiusMeters,
    osmTags: Object.keys(tags).length > 0 ? { ...tags } : undefined,
  };
}

function resolveVegetationType(
  tags: Record<string, string>,
): VegetationData['type'] {
  if (tags.natural === 'shrub') return 'SHRUB';
  if (tags.natural === 'grass') return 'GRASS';
  if (tags.barrier === 'hedge') return 'HEDGE';
  if (tags.natural === 'wood') return 'TREE';
  return 'TREE';
}

function resolveVegetationRadius(
  tags: Record<string, string>,
  type: VegetationData['type'],
): number {
  const diameter = tags.diameter ? Number.parseFloat(tags.diameter) : null;
  if (diameter && Number.isFinite(diameter) && diameter > 0) {
    return diameter / 2;
  }
  const circumference = tags.circumference
    ? Number.parseFloat(tags.circumference)
    : null;
  if (circumference && Number.isFinite(circumference) && circumference > 0) {
    return circumference / (2 * Math.PI);
  }
  switch (type) {
    case 'SHRUB':
      return 1.2;
    case 'GRASS':
      return 0.8;
    case 'HEDGE':
      return 0.6;
    default:
      return 2.4;
  }
}

export function mapLandCover(way: OverpassElement): LandCoverData | null {
  const polygon = sanitizeRing(mapGeometry(way.geometry ?? []));
  if (polygon === null) {
    return null;
  }

  const tags = way.tags ?? {};
  const type = resolveLandCoverType(tags);

  return {
    id: `land-cover-${way.id}`,
    type,
    polygon,
    osmTags: Object.keys(tags).length > 0 ? { ...tags } : undefined,
  };
}

function resolveLandCoverType(
  tags: Record<string, string>,
): LandCoverData['type'] {
  const landuse = tags.landuse ?? '';
  const natural = tags.natural ?? '';
  const leisure = tags.leisure ?? '';

  if (
    landuse === 'grass' ||
    landuse === 'recreation_ground' ||
    leisure === 'park' ||
    leisure === 'garden'
  ) {
    return 'PARK';
  }
  if (
    landuse === 'forest' ||
    natural === 'wood' ||
    natural === 'forest'
  ) {
    return 'FOREST';
  }
  if (
    landuse === 'farmland' ||
    landuse === 'farmyard' ||
    landuse === 'orchard' ||
    landuse === 'vineyard'
  ) {
    return 'FARMLAND';
  }
  if (
    landuse === 'meadow' ||
    landuse === 'village_green' ||
    leisure === 'golf_course'
  ) {
    return 'GRASS';
  }
  if (
    natural === 'wetland' ||
    landuse === 'saltmarsh' ||
    natural === 'mud'
  ) {
    return 'WETLAND';
  }
  if (natural === 'water' || landuse === 'reservoir') {
    return 'WATER';
  }
  return 'PLAZA';
}

export function mapLinearFeature(
  way: OverpassElement,
): LinearFeatureData | null {
  const path = sanitizePath(mapGeometry(way.geometry ?? []));
  if (path === null) {
    return null;
  }

  const type = way.tags?.railway
    ? 'RAILWAY'
    : way.tags?.waterway
      ? 'WATERWAY'
      : 'BRIDGE';

  return {
    id: `linear-feature-${way.id}`,
    type,
    path,
  };
}

function sanitizeRing(points: Coordinate[]): Coordinate[] | null {
  const sanitized = dedupeCoordinates(points).filter(isFiniteCoordinate);
  if (sanitized.length > 1) {
    const first = sanitized[0]!;
    const last = sanitized[sanitized.length - 1]!;
    if (coordinatesEqual(first, last)) {
      sanitized.pop();
    }
  }

  if (sanitized.length < 3) {
    return null;
  }

  if (Math.abs(polygonSignedArea(sanitized)) < 1e-12) {
    return null;
  }

  return sanitized;
}

function tryMapBuildingRelation(
  relation: OverpassElement,
): {
  id: string;
  tags: Record<string, string> | undefined;
  outerRing: Coordinate[];
  holes: Coordinate[][];
} | null {
  const outerRings = buildRingsFromMembers(
    (relation.members ?? []).filter(
      (member) => (member.role ?? 'outer') === 'outer',
    ),
  );
  if (outerRings.length === 0) {
    return null;
  }

  const sortedRings = [...outerRings].sort(
    (left, right) =>
      Math.abs(polygonSignedArea(right)) - Math.abs(polygonSignedArea(left)),
  );
  const primaryOuter = sortedRings[0];
  if (!primaryOuter) {
    return null;
  }
  const holes = buildRingsFromMembers(
    (relation.members ?? []).filter((member) => member.role === 'inner'),
  ).filter((ring) => {
    const sample = ring[0];
    return sample ? isPointInsideRing(sample, primaryOuter) : false;
  });

  return {
    id: `building-${relation.id}`,
    tags: relation.tags,
    outerRing: primaryOuter,
    holes,
  };
}

function mapBuildingRelation(
  relation: OverpassElement,
): PlacePackage['buildings'][number] | null {
  const raw = tryMapBuildingRelation(relation);
  if (!raw) {
    return null;
  }
  return buildBuildingRecord(raw.id, raw.tags, raw.outerRing, raw.holes);
}

function buildBuildingRecord(
  id: string,
  tags: Record<string, string> | undefined,
  outerRing: Coordinate[],
  holes: Coordinate[][],
  contextMedian?: number,
): PlacePackage['buildings'][number] {
  const normalizedOuterRing = normalizeRingOrientation(outerRing, 'CW');
  const normalizedHoles = holes.map((hole) =>
    normalizeRingOrientation(hole, 'CCW'),
  );

  const heightMeters = resolveHeight(tags, contextMedian);
  const estimationConfidence = resolveHeightConfidence(tags, contextMedian);

  return {
    id,
    name: tags?.name ?? id,
    heightMeters,
    usage: resolveUsage(tags),
    outerRing: normalizedOuterRing,
    holes: normalizedHoles,
    footprint: normalizedOuterRing,
    facadeColor: tags?.['building:colour'] ?? tags?.['building:color'] ?? null,
    facadeMaterial: tags?.['building:material'] ?? null,
    roofColor: tags?.['roof:colour'] ?? tags?.['roof:color'] ?? null,
    roofMaterial: tags?.['roof:material'] ?? null,
    roofShape: tags?.['roof:shape'] ?? null,
    buildingPart: tags?.['building:part'] ?? null,
    estimationConfidence,
    osmAttributes: { ...(tags ?? {}) },
    googlePlacesInfo: undefined,
  };
}

function buildRingsFromMembers(
  members: NonNullable<OverpassElement['members']>,
): Coordinate[][] {
  const remaining = members
    .map((member) => mapGeometry(member.geometry ?? []))
    .map((segment) => dedupeCoordinates(segment).filter(isFiniteCoordinate))
    .filter((segment) => segment.length >= 2);
  const rings: Coordinate[][] = [];

  while (remaining.length > 0) {
    const firstSegment = remaining.shift();
    if (!firstSegment) {
      break;
    }
    let ring = [...firstSegment];
    let progressed = true;

    while (progressed) {
      progressed = false;
      const ringFirst = ring[0];
      const ringLast = ring[ring.length - 1];
      if (!ringFirst || !ringLast) {
        break;
      }
      if (coordinatesEqual(ringFirst, ringLast)) {
        break;
      }

      for (let index = 0; index < remaining.length; index += 1) {
        const segment = remaining[index];
        if (!segment) {
          continue;
        }
        const start = segment[0];
        const end = segment[segment.length - 1];
        if (!start || !end) {
          continue;
        }
        const ringStart = ring[0];
        const ringEnd = ring[ring.length - 1];
        if (!ringStart || !ringEnd) {
          continue;
        }

        if (coordinatesEqual(ringEnd, start)) {
          ring = [...ring, ...segment.slice(1)];
        } else if (coordinatesEqual(ringEnd, end)) {
          ring = [...ring, ...segment.slice(0, -1).reverse()];
        } else if (coordinatesEqual(ringStart, end)) {
          ring = [...segment.slice(0, -1), ...ring];
        } else if (coordinatesEqual(ringStart, start)) {
          ring = [...segment.slice(1).reverse(), ...ring];
        } else {
          continue;
        }

        remaining.splice(index, 1);
        progressed = true;
        break;
      }
    }

    const sanitized = sanitizeRing(ring);
    if (sanitized) {
      rings.push(sanitized);
    }
  }

  return rings;
}

function isPointInsideRing(point: Coordinate, ring: Coordinate[]): boolean {
  let inside = false;
  for (
    let index = 0, prev = ring.length - 1;
    index < ring.length;
    prev = index, index += 1
  ) {
    const current = ring[index];
    const previous = ring[prev];
    if (!current || !previous) {
      continue;
    }
    const intersects =
      current.lat > point.lat !== previous.lat > point.lat &&
      point.lng <
        ((previous.lng - current.lng) * (point.lat - current.lat)) /
          (previous.lat - current.lat + Number.EPSILON) +
          current.lng;
    if (intersects) {
      inside = !inside;
    }
  }
  return inside;
}

function sanitizePath(points: Coordinate[]): Coordinate[] | null {
  const sanitized = dedupeCoordinates(points).filter(isFiniteCoordinate);
  if (sanitized.length < 2) {
    return null;
  }

  if (!midpoint(sanitized)) {
    return null;
  }

  return sanitized;
}

function dedupeCoordinates(points: Coordinate[]): Coordinate[] {
  return points.filter((point, index) => {
    const prev = points[index - 1];
    return !prev || !coordinatesEqual(prev, point);
  });
}

function normalizeRingOrientation(
  ring: Coordinate[],
  direction: 'CW' | 'CCW',
): Coordinate[] {
  const signedArea = polygonSignedArea(ring);
  if (signedArea === 0) {
    return ring;
  }

  const isClockwise = signedArea < 0;
  if (
    (direction === 'CW' && isClockwise) ||
    (direction === 'CCW' && !isClockwise)
  ) {
    return ring;
  }

  return [...ring].reverse();
}
