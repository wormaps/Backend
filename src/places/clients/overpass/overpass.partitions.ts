import type { OverpassElement, OverpassResponse } from './overpass.types';
import { BuildingFootprintVo } from '../../domain/building-footprint.value-object';

export interface PartitionedOverpassElements {
  buildingRelations: OverpassElement[];
  buildingWays: OverpassElement[];
  deduplicatedCount: number;
  mergedWayRelationCount: number;
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
    mergedWayRelationCount,
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
        Boolean(element.tags?.traffic_sign)),
  );
  const vegetationNodes = elements.filter(
    (element) =>
      element.type === 'node' &&
      element.lat !== undefined &&
      element.lon !== undefined &&
      element.tags?.natural === 'tree',
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
    mergedWayRelationCount,
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
  mergedWayRelationCount: number;
} {
  const keptRelations = dedupeRelationsByFootprint(buildingRelations);
  const dedupedWays: OverpassElement[] = [];
  let mergedWayRelationCount = 0;
  const relationFootprints = keptRelations
    .map((relation) => ({ relation, footprint: mapPrimaryOuterFootprintFromRelation(relation) }))
    .filter(
      (
        item,
      ): item is { relation: OverpassElement; footprint: BuildingFootprintVo } =>
        item.footprint !== null,
    )
    .sort((left, right) => left.footprint.boundingBox().minLat - right.footprint.boundingBox().minLat);

  for (const way of buildingWays) {
    const wayFootprint = mapFootprintFromWayGeometry(way);
    if (!wayFootprint) {
      dedupedWays.push(way);
      continue;
    }

    const hasEquivalentRelation = relationFootprints.some(({ footprint }) =>
      wayFootprint.isSameFootprint(footprint, 3),
    );

    if (hasEquivalentRelation) {
      mergedWayRelationCount += 1;
      continue;
    }
    dedupedWays.push(way);
  }

  const deduplicatedCount =
    buildingRelations.length + buildingWays.length -
    (keptRelations.length + dedupedWays.length);

  return {
    buildingRelations: keptRelations,
    buildingWays: dedupedWays,
    deduplicatedCount,
    mergedWayRelationCount,
  };
}

function dedupeRelationsByFootprint(
  relations: OverpassElement[],
): OverpassElement[] {
  const kept: OverpassElement[] = [];
  for (const relation of relations) {
    const footprint = mapPrimaryOuterFootprintFromRelation(relation);
    if (!footprint) {
      kept.push(relation);
      continue;
    }

    const duplicate = kept.some((candidate) => {
      const candidateFootprint = mapPrimaryOuterFootprintFromRelation(candidate);
      if (!candidateFootprint) {
        return false;
      }
      return footprint.isSameFootprint(candidateFootprint, 3);
    });

    if (!duplicate) {
      kept.push(relation);
    }
  }
  return kept;
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

  return [...outerMembers].sort(
    (left, right) =>
      Math.abs(resolveSignedArea(right)) - Math.abs(resolveSignedArea(left)),
  )[0];
}

function normalizeRing(
  ring: Array<{ lat: number; lng: number }>,
): Array<{ lat: number; lng: number }> {
  const deduped = ring.filter((point, index) => {
    const previous = ring[index - 1];
    return !previous || previous.lat !== point.lat || previous.lng !== point.lng;
  });
  if (deduped.length > 2) {
    const first = deduped[0];
    const last = deduped[deduped.length - 1];
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
    const current = ring[i];
    const next = ring[(i + 1) % ring.length];
    area += current.lng * next.lat - next.lng * current.lat;
  }
  return area / 2;
}
