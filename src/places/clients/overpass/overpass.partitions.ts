import type { OverpassElement, OverpassResponse } from './overpass.types';

export interface PartitionedOverpassElements {
  buildingRelations: OverpassElement[];
  buildingWays: OverpassElement[];
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
  const buildingRelations = elements.filter(
    (element) =>
      element.type === 'relation' &&
      element.tags?.building &&
      element.tags?.type === 'multipolygon' &&
      element.members?.length,
  );
  const relationMemberWayIds = new Set(
    buildingRelations.flatMap((relation) =>
      (relation.members ?? [])
        .filter((member) => member.type === 'way')
        .map((member) => member.ref),
    ),
  );

  const buildingWays = elements.filter(
    (element) =>
      element.type === 'way' &&
      element.tags?.building &&
      !relationMemberWayIds.has(element.id) &&
      element.geometry?.length,
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
    buildingWays,
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
