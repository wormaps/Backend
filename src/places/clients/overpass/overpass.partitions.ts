import type { OverpassElement, OverpassResponse } from './overpass.types';
import { BuildingFootprintVo } from '../../domain/building-footprint.value-object';
import {
  areBoundsOverlapping,
  calculateDistanceMeters,
  calculateFootprintIoU,
  calculatePolygonAreaM2,
  resolveFootprintBounds,
  type FootprintBounds,
} from '../../utils/footprint-overlap.utils';

const SAME_BUILDING_IOU_THRESHOLD = 0.85;
const SAME_BUILDING_CENTROID_TOLERANCE_METERS = 3;
const SPATIAL_INDEX_CELL_SIZE_METERS = 50;
const SPATIAL_INDEX_NEIGHBOR_RANGE = 1;

export interface PartitionedOverpassElements {
  buildingRelations: OverpassElement[];
  buildingWays: OverpassElement[];
  deduplicatedCount: number;
  deduplicatedByIoUCount: number;
  mergedWayRelationCount: number;
  mergedWayWayCount: number;
  roadWays: OverpassElement[];
  walkwayWays: OverpassElement[];
  crossingWays: OverpassElement[];
  poiNodes: OverpassElement[];
  furnitureNodes: OverpassElement[];
  vegetationNodes: OverpassElement[];
  landCoverWays: OverpassElement[];
  linearFeatureWays: OverpassElement[];
}

export function dedupeElements(elements: OverpassElement[]): OverpassElement[] {
  const seen = new Set<string>();
  return elements.filter((element) => {
    const key = `${element.type}:${element.id}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export function collectDedupedElements(
  responses: OverpassResponse[],
): OverpassElement[] {
  return dedupeElements(
    responses.flatMap((response) => response.elements ?? []),
  );
}

export function partitionOverpassElements(
  elements: OverpassElement[],
): PartitionedOverpassElements {
  const rawBuildingRelations = elements.filter(
    (element) =>
      element.type === 'relation' &&
      element.tags?.building &&
      element.tags?.type === 'multipolygon' &&
      element.members?.length,
  );
  const rawBuildingWays = elements.filter(
    (element) =>
      element.type === 'way' &&
      element.tags?.building &&
      element.geometry?.length,
  );

  const {
    buildingRelations,
    buildingWays,
    deduplicatedCount,
    deduplicatedByIoUCount,
    mergedWayRelationCount,
    mergedWayWayCount,
  } = dedupeBuildingElements(rawBuildingRelations, rawBuildingWays);

  const relationMemberWayIds = new Set(
    buildingRelations.flatMap((relation) =>
      (relation.members ?? [])
        .filter((member) => member.type === 'way')
        .map((member) => member.ref),
    ),
  );

  const buildingWaysWithoutMembers = buildingWays.filter(
    (element) => !relationMemberWayIds.has(element.id),
  );
  const roadWays = elements.filter(
    (element) =>
      element.type === 'way' &&
      element.tags?.highway &&
      !['footway', 'pedestrian', 'path', 'steps', 'corridor'].includes(
        element.tags.highway,
      ) &&
      element.tags.footway !== 'crossing' &&
      element.geometry?.length,
  );
  const walkwayWays = elements.filter(
    (element) =>
      element.type === 'way' &&
      (['footway', 'pedestrian', 'path', 'steps', 'corridor'].includes(
        element.tags?.highway ?? '',
      ) ||
        element.tags?.footway === 'crossing') &&
      element.geometry?.length,
  );
  const crossingWays = elements.filter(
    (element) =>
      element.type === 'way' &&
      (element.tags?.footway === 'crossing' ||
        Boolean(element.tags?.crossing)) &&
      element.geometry?.length,
  );
  const poiNodes = elements.filter(
    (element) =>
      element.type === 'node' &&
      element.lat !== undefined &&
      element.lon !== undefined &&
      (element.tags?.amenity ||
        element.tags?.tourism ||
        element.tags?.shop ||
        element.tags?.public_transport),
  );
  const furnitureNodes = elements.filter(
    (element) =>
      element.type === 'node' &&
      element.lat !== undefined &&
      element.lon !== undefined &&
      (element.tags?.highway === 'traffic_signals' ||
        element.tags?.highway === 'street_lamp' ||
        Boolean(element.tags?.traffic_sign) ||
        element.tags?.amenity === 'bench' ||
        element.tags?.amenity === 'waste_basket' ||
        element.tags?.amenity === 'waste_disposal' ||
        element.tags?.amenity === 'post_box' ||
        element.tags?.amenity === 'public_phone' ||
        element.tags?.amenity === 'vending_machine' ||
        element.tags?.advertising === 'billboard' ||
        element.tags?.advertising === 'column' ||
        element.tags?.advertising === 'poster_box' ||
        element.tags?.advertising === 'display' ||
        element.tags?.advertising === 'board' ||
        element.tags?.highway === 'bollard'),
  );
  const vegetationNodes = elements.filter(
    (element) =>
      element.type === 'node' &&
      element.lat !== undefined &&
      element.lon !== undefined &&
      (element.tags?.natural === 'tree' ||
        element.tags?.natural === 'shrub' ||
        element.tags?.natural === 'grass' ||
        element.tags?.barrier === 'hedge' ||
        element.tags?.natural === 'wood'),
  );
  const landCoverWays = elements.filter(
    (element) =>
      element.type === 'way' &&
      element.geometry?.length &&
      (Boolean(element.tags?.landuse) ||
        Boolean(element.tags?.leisure) ||
        Boolean(element.tags?.natural)),
  );
  const linearFeatureWays = elements.filter(
    (element) =>
      element.type === 'way' &&
      element.geometry?.length &&
      (Boolean(element.tags?.waterway) ||
        Boolean(element.tags?.railway) ||
        Boolean(element.tags?.bridge)),
  );

  return {
    buildingRelations,
    buildingWays: buildingWaysWithoutMembers,
    deduplicatedCount,
    deduplicatedByIoUCount,
    mergedWayRelationCount,
    mergedWayWayCount,
    roadWays,
    walkwayWays,
    crossingWays,
    poiNodes,
    furnitureNodes,
    vegetationNodes,
    landCoverWays,
    linearFeatureWays,
  };
}

function dedupeBuildingElements(
  buildingRelations: OverpassElement[],
  buildingWays: OverpassElement[],
): {
  buildingRelations: OverpassElement[];
  buildingWays: OverpassElement[];
  deduplicatedCount: number;
  deduplicatedByIoUCount: number;
  mergedWayRelationCount: number;
  mergedWayWayCount: number;
} {
  const relationDedupResult = dedupeRelationsByFootprint(buildingRelations);
  const keptRelations = relationDedupResult.kept;
  const relationCandidates = mapSpatialCandidates(keptRelations);
  const relationIndex = buildSpatialIndex(relationCandidates);
  const dedupedWays: OverpassElement[] = [];
  const wayIndex = createEmptySpatialIndex();
  let mergedWayRelationCount = 0;
  let mergedWayWayCount = 0;

  for (const way of buildingWays) {
    const wayCandidate = mapSpatialCandidateFromWay(way);
    if (!wayCandidate) {
      dedupedWays.push(way);
      continue;
    }

    const overlappingRelations = getSpatialCandidatesForBounds(
      relationIndex,
      wayCandidate.bounds,
    );
    const hasEquivalentRelation = overlappingRelations.some((relationCandidate) =>
      areEquivalentFootprints(wayCandidate, relationCandidate),
    );

    if (hasEquivalentRelation) {
      mergedWayRelationCount += 1;
      continue;
    }

    const overlappingWays = getSpatialCandidatesForBounds(
      wayIndex,
      wayCandidate.bounds,
    );
    const hasEquivalentWay = overlappingWays.some((candidate) =>
      areEquivalentFootprints(wayCandidate, candidate),
    );
    if (hasEquivalentWay) {
      mergedWayWayCount += 1;
      continue;
    }

    addSpatialCandidate(wayIndex, wayCandidate);
    dedupedWays.push(way);
  }

  const deduplicatedByIoUCount =
    relationDedupResult.removedByIoU + mergedWayRelationCount + mergedWayWayCount;
  const deduplicatedCount =
    buildingRelations.length + buildingWays.length -
    (keptRelations.length + dedupedWays.length);

  return {
    buildingRelations: keptRelations,
    buildingWays: dedupedWays,
    deduplicatedCount,
    deduplicatedByIoUCount,
    mergedWayRelationCount,
    mergedWayWayCount,
  };
}

function dedupeRelationsByFootprint(
  relations: OverpassElement[],
): {
  kept: OverpassElement[];
  removedByIoU: number;
} {
  const candidates = mapSpatialCandidates(relations);
  const index = createEmptySpatialIndex();
  const kept: OverpassElement[] = [];
  let removedByIoU = 0;
  for (const relation of relations) {
    const candidate = candidates.get(relation.id);
    if (!candidate) {
      kept.push(relation);
      continue;
    }

    const neighbors = getSpatialCandidatesForBounds(index, candidate.bounds);
    const duplicate = neighbors.find((neighbor) =>
      areEquivalentFootprints(candidate, neighbor),
    );

    if (duplicate) {
      removedByIoU += 1;
      const preferred = choosePreferredRelation(candidate, duplicate);
      if (preferred.element.id === duplicate.element.id) {
        continue;
      }
      removeSpatialCandidate(index, duplicate);
      const duplicateIndex = kept.findIndex(
        (item) => item.id === duplicate.element.id,
      );
      if (duplicateIndex >= 0) {
        kept.splice(duplicateIndex, 1);
      }
    }

    kept.push(relation);
    addSpatialCandidate(index, candidate);
  }
  return {
    kept,
    removedByIoU,
  };
}

interface SpatialCandidate {
  element: OverpassElement;
  footprint: BuildingFootprintVo;
  bounds: FootprintBounds;
  centroid: { lat: number; lng: number };
}

type SpatialIndex = Map<string, SpatialCandidate[]>;

function mapSpatialCandidates(
  elements: OverpassElement[],
): Map<number, SpatialCandidate> {
  const result = new Map<number, SpatialCandidate>();

  for (const element of elements) {
    const candidate =
      element.type === 'relation'
        ? mapSpatialCandidateFromRelation(element)
        : mapSpatialCandidateFromWay(element);
    if (!candidate) {
      continue;
    }
    result.set(element.id, candidate);
  }

  return result;
}

function mapSpatialCandidateFromWay(
  element: OverpassElement,
): SpatialCandidate | null {
  const footprint = mapFootprintFromWayGeometry(element);
  if (!footprint) {
    return null;
  }

  return {
    element,
    footprint,
    bounds: resolveFootprintBounds(footprint.outerRing),
    centroid: footprint.centroid(),
  };
}

function mapSpatialCandidateFromRelation(
  element: OverpassElement,
): SpatialCandidate | null {
  const footprint = mapPrimaryOuterFootprintFromRelation(element);
  if (!footprint) {
    return null;
  }

  return {
    element,
    footprint,
    bounds: resolveFootprintBounds(footprint.outerRing),
    centroid: footprint.centroid(),
  };
}

function areEquivalentFootprints(
  left: SpatialCandidate,
  right: SpatialCandidate,
): boolean {
  if (!areBoundsOverlapping(left.bounds, right.bounds)) {
    return false;
  }

  const centroidDistance = calculateDistanceMeters(left.centroid, right.centroid);
  if (centroidDistance > SAME_BUILDING_CENTROID_TOLERANCE_METERS) {
    return false;
  }

  const overlap = calculateFootprintIoU(
    left.footprint.outerRing,
    right.footprint.outerRing,
  );
  return overlap.iou >= SAME_BUILDING_IOU_THRESHOLD;
}

function choosePreferredRelation(
  left: SpatialCandidate,
  right: SpatialCandidate,
): SpatialCandidate {
  const leftScore = resolveRelationScore(left.element);
  const rightScore = resolveRelationScore(right.element);
  if (leftScore !== rightScore) {
    return leftScore > rightScore ? left : right;
  }

  const leftArea = calculateFootprintIoU(
    left.footprint.outerRing,
    left.footprint.outerRing,
  ).intersectionM2;
  const rightArea = calculatePolygonAreaM2(right.footprint.outerRing);

  const normalizedLeftArea =
    leftArea > 0 ? leftArea : calculatePolygonAreaM2(left.footprint.outerRing);

  if (normalizedLeftArea !== rightArea) {
    return normalizedLeftArea > rightArea ? left : right;
  }

  return left.element.id <= right.element.id ? left : right;
}

function resolveRelationScore(element: OverpassElement): number {
  const tags = element.tags ?? {};
  const levelScore = Number.parseFloat(tags['building:levels'] ?? '0');
  const heightScore = Number.parseFloat(tags.height ?? '0') / 10;
  const namedScore = tags.name ? 2 : 0;
  const sourceScore = tags.source ? 1 : 0;
  const wikiScore = tags.wikidata || tags.wikipedia ? 1 : 0;
  return (
    (Number.isFinite(levelScore) ? levelScore : 0) +
    (Number.isFinite(heightScore) ? heightScore : 0) +
    namedScore +
    sourceScore +
    wikiScore
  );
}

function createEmptySpatialIndex(): SpatialIndex {
  return new Map<string, SpatialCandidate[]>();
}

function buildSpatialIndex(candidates: Map<number, SpatialCandidate>): SpatialIndex {
  const index = createEmptySpatialIndex();
  for (const candidate of candidates.values()) {
    addSpatialCandidate(index, candidate);
  }
  return index;
}

function addSpatialCandidate(index: SpatialIndex, candidate: SpatialCandidate): void {
  const cellKeys = resolveCellKeysFromBounds(candidate.bounds);
  for (const key of cellKeys) {
    const bucket = index.get(key);
    if (!bucket) {
      index.set(key, [candidate]);
      continue;
    }
    bucket.push(candidate);
  }
}

function removeSpatialCandidate(
  index: SpatialIndex,
  candidate: SpatialCandidate,
): void {
  const cellKeys = resolveCellKeysFromBounds(candidate.bounds);
  for (const key of cellKeys) {
    const bucket = index.get(key);
    if (!bucket) {
      continue;
    }
    const next = bucket.filter((item) => item.element.id !== candidate.element.id);
    if (next.length === 0) {
      index.delete(key);
      continue;
    }
    index.set(key, next);
  }
}

function getSpatialCandidatesForBounds(
  index: SpatialIndex,
  bounds: FootprintBounds,
): SpatialCandidate[] {
  const cellKeys = resolveCellKeysFromBounds(bounds);
  const seen = new Set<number>();
  const candidates: SpatialCandidate[] = [];

  for (const key of cellKeys) {
    const bucket = index.get(key);
    if (!bucket) {
      continue;
    }
    for (const candidate of bucket) {
      if (seen.has(candidate.element.id)) {
        continue;
      }
      seen.add(candidate.element.id);
      candidates.push(candidate);
    }
  }

  return candidates;
}

function resolveCellKeysFromBounds(bounds: FootprintBounds): string[] {
  const latStep = SPATIAL_INDEX_CELL_SIZE_METERS / 111_320;
  const avgLat = (bounds.minLat + bounds.maxLat) / 2;
  const lngMeters =
    111_320 * Math.max(0.2, Math.cos((avgLat * Math.PI) / 180));
  const lngStep = SPATIAL_INDEX_CELL_SIZE_METERS / lngMeters;

  const minLatCell = Math.floor(bounds.minLat / latStep);
  const maxLatCell = Math.floor(bounds.maxLat / latStep);
  const minLngCell = Math.floor(bounds.minLng / lngStep);
  const maxLngCell = Math.floor(bounds.maxLng / lngStep);

  const keys: string[] = [];
  for (let latCell = minLatCell; latCell <= maxLatCell; latCell += 1) {
    for (let lngCell = minLngCell; lngCell <= maxLngCell; lngCell += 1) {
      for (
        let latOffset = -SPATIAL_INDEX_NEIGHBOR_RANGE;
        latOffset <= SPATIAL_INDEX_NEIGHBOR_RANGE;
        latOffset += 1
      ) {
        for (
          let lngOffset = -SPATIAL_INDEX_NEIGHBOR_RANGE;
          lngOffset <= SPATIAL_INDEX_NEIGHBOR_RANGE;
          lngOffset += 1
        ) {
          keys.push(`${latCell + latOffset}:${lngCell + lngOffset}`);
        }
      }
    }
  }

  return [...new Set(keys)];
}

function mapFootprintFromWayGeometry(element: OverpassElement): BuildingFootprintVo | null {
  const ring = mapRingFromWayGeometry(element);
  if (ring.length < 3) {
    return null;
  }
  return new BuildingFootprintVo(ring);
}

function mapPrimaryOuterFootprintFromRelation(
  element: OverpassElement,
): BuildingFootprintVo | null {
  const ring = mapPrimaryOuterRingFromRelation(element);
  if (ring.length < 3) {
    return null;
  }
  return new BuildingFootprintVo(ring);
}

function mapRingFromWayGeometry(element: OverpassElement): Array<{
  lat: number;
  lng: number;
}> {
  const ring = (element.geometry ?? [])
    .map((point) => ({ lat: Number(point.lat), lng: Number(point.lon) }))
    .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng));
  return normalizeRing(ring);
}

function mapPrimaryOuterRingFromRelation(element: OverpassElement): Array<{
  lat: number;
  lng: number;
}> {
  const outerMembers = (element.members ?? [])
    .filter((member) => member.type === 'way')
    .filter((member) => (member.role ?? 'outer') === 'outer')
    .map((member) =>
      (member.geometry ?? [])
        .map((point) => ({ lat: Number(point.lat), lng: Number(point.lon) }))
        .filter(
          (point) => Number.isFinite(point.lat) && Number.isFinite(point.lng),
        ),
    )
    .filter((segment) => segment.length >= 3)
    .map((segment) => normalizeRing(segment));

  if (outerMembers.length === 0) {
    return [];
  }

  const sorted = [...outerMembers].sort(
    (left, right) =>
      Math.abs(resolveSignedArea(right)) - Math.abs(resolveSignedArea(left)),
  );
  const result = sorted[0];
  return result ?? [];
}

function normalizeRing(
  ring: Array<{ lat: number; lng: number }>,
): Array<{ lat: number; lng: number }> {
  const deduped = ring.filter((point, index) => {
    const previous = ring[index - 1];
    return !previous || previous.lat !== point.lat || previous.lng !== point.lng;
  });
  if (deduped.length > 2) {
    const first = deduped[0]!;
    const last = deduped[deduped.length - 1]!;
    if (first.lat === last.lat && first.lng === last.lng) {
      deduped.pop();
    }
  }
  return deduped;
}

function resolveSignedArea(ring: Array<{ lat: number; lng: number }>): number {
  if (ring.length < 3) {
    return 0;
  }

  let area = 0;
  for (let i = 0; i < ring.length; i += 1) {
    const current = ring[i]!;
    const next = ring[(i + 1) % ring.length]!;
    area += current.lng * next.lat - next.lng * current.lat;
  }
  return area / 2;
}
