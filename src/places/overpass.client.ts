import { Injectable } from '@nestjs/common';
import { AppException } from '../common/errors/app.exception';
import { fetchJson } from '../common/http/fetch-json';
import type { FetchLike } from '../common/http/fetch-json';
import { ExternalPlaceDetail } from './external-place.types';
import {
  Coordinate,
  CrossingData,
  GeoBounds,
  LandCoverData,
  LinearFeatureData,
  PlacePackage,
  PoiData,
  StreetFurnitureData,
  VegetationData,
} from './place.types';
import {
  coordinatesEqual,
  createBoundsFromCenterRadius,
  isFiniteCoordinate,
  midpoint,
  polygonSignedArea,
} from './geo.utils';

interface OverpassResponse {
  elements?: OverpassElement[];
}

interface OverpassElement {
  type: 'node' | 'way';
  id: number;
  lat?: number;
  lon?: number;
  geometry?: Array<{ lat: number; lon: number }>;
  tags?: Record<string, string>;
}

export interface BuildPlacePackageOptions {
  bounds?: GeoBounds;
  radiusM?: number;
}

@Injectable()
export class OverpassClient {
  private fetcher: FetchLike = fetch;
  private readonly defaultEndpoints = [
    'https://overpass.private.coffee/api/interpreter',
    'https://overpass-api.de/api/interpreter',
  ];

  withFetcher(fetcher: FetchLike): this {
    this.fetcher = fetcher;
    return this;
  }

  async buildPlacePackage(
    place: ExternalPlaceDetail,
    options: BuildPlacePackageOptions = {},
  ): Promise<PlacePackage> {
    const bounds =
      options.bounds ??
      (options.radiusM
        ? createBoundsFromCenterRadius(place.location, options.radiusM)
        : place.viewport ?? createBoundsFromCenterRadius(place.location, 300));

    const batches = [
      this.buildQuery(bounds, 'core'),
      this.buildQuery(bounds, 'street'),
      this.buildQuery(bounds, 'environment'),
    ];
    const responses = await Promise.all(
      batches.map((query) => this.fetchOverpassResponse(query)),
    );
    const elements = dedupeElements(
      responses.flatMap((response) => response.elements ?? []),
    );

    const buildingWays = elements.filter(
      (element) =>
        element.type === 'way' &&
        element.tags?.building &&
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
        (element.tags?.footway === 'crossing' || Boolean(element.tags?.crossing)) &&
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

    const buildings = buildingWays
      .map((way) => this.mapBuilding(way))
      .filter((value): value is PlacePackage['buildings'][number] => value !== null);
    const roads = roadWays
      .map((way) => this.mapRoad(way))
      .filter((value): value is PlacePackage['roads'][number] => value !== null);
    const walkways = walkwayWays
      .map((way) => this.mapWalkway(way))
      .filter((value): value is PlacePackage['walkways'][number] => value !== null);
    const crossings = crossingWays
      .map((way) => this.mapCrossing(way))
      .filter((value): value is CrossingData => value !== null);
    const pois = poiNodes
      .map((node) => this.mapPoi(node))
      .filter((value): value is PoiData => value !== null);
    const streetFurniture = furnitureNodes
      .map((node) => this.mapStreetFurniture(node))
      .filter((value): value is StreetFurnitureData => value !== null);
    const vegetation = vegetationNodes
      .map((node) => this.mapVegetation(node))
      .filter((value): value is VegetationData => value !== null);
    const landCovers = landCoverWays
      .map((way) => this.mapLandCover(way))
      .filter((value): value is LandCoverData => value !== null);
    const linearFeatures = linearFeatureWays
      .map((way) => this.mapLinearFeature(way))
      .filter((value): value is LinearFeatureData => value !== null);
    const landmarks = pois.filter((poi) => poi.type === 'LANDMARK');

    return {
      placeId: place.placeId,
      version: '2026.04-external',
      generatedAt: new Date().toISOString(),
      camera: {
        topView: { x: 0, y: 180, z: 140 },
        walkViewStart: { x: 0, y: 1.7, z: 12 },
      },
      bounds,
      buildings,
      roads,
      walkways,
      pois,
      landmarks,
      crossings,
      streetFurniture,
      vegetation,
      landCovers,
      linearFeatures,
      diagnostics: {
        droppedBuildings: buildingWays.length - buildings.length,
        droppedRoads: roadWays.length - roads.length,
        droppedWalkways: walkwayWays.length - walkways.length,
        droppedPois: poiNodes.length - pois.length,
        droppedCrossings: crossingWays.length - crossings.length,
        droppedStreetFurniture: furnitureNodes.length - streetFurniture.length,
        droppedVegetation: vegetationNodes.length - vegetation.length,
        droppedLandCovers: landCoverWays.length - landCovers.length,
        droppedLinearFeatures: linearFeatureWays.length - linearFeatures.length,
      },
    };
  }

  private buildQuery(
    bounds: GeoBounds,
    scope: 'core' | 'street' | 'environment',
  ): string {
    const bbox = `(${bounds.southWest.lat},${bounds.southWest.lng},${bounds.northEast.lat},${bounds.northEast.lng})`;
    const selectors =
      scope === 'core'
        ? [
            `way["building"]${bbox};`,
            `way["highway"]${bbox};`,
            `way["footway"="crossing"]${bbox};`,
            `way["highway"]["crossing"]${bbox};`,
            `node["amenity"]${bbox};`,
            `node["tourism"]${bbox};`,
            `node["shop"]${bbox};`,
            `node["public_transport"]${bbox};`,
          ]
        : scope === 'street'
          ? [
              `node["highway"="traffic_signals"]${bbox};`,
              `node["highway"="street_lamp"]${bbox};`,
              `node["traffic_sign"]${bbox};`,
              `node["natural"="tree"]${bbox};`,
            ]
          : [
              `way["landuse"]${bbox};`,
              `way["leisure"]${bbox};`,
              `way["natural"]${bbox};`,
              `way["waterway"]${bbox};`,
              `way["railway"]${bbox};`,
              `way["bridge"]${bbox};`,
            ];

    return `
[out:json][timeout:25];
(
  ${selectors.join('\n  ')}
);
out geom;
    `.trim();
  }

  private async fetchOverpassResponse(query: string): Promise<OverpassResponse> {
    const endpoints = this.resolveEndpoints();
    let lastError: unknown;

    for (const url of endpoints) {
      try {
        return await fetchJson<OverpassResponse>(
          {
            provider: 'Overpass API',
            url,
            init: {
              method: 'POST',
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
              },
              body: `data=${encodeURIComponent(query)}`,
            },
            timeoutMs: 40000,
          },
          this.fetcher,
        );
      } catch (error) {
        lastError = error;
      }
    }

    if (lastError instanceof AppException) {
      throw lastError;
    }

    throw new Error('Overpass API 응답을 가져오지 못했습니다.');
  }

  private resolveEndpoints(): string[] {
    const configured = process.env.OVERPASS_API_URLS
      ?.split(',')
      .map((value) => value.trim())
      .filter(Boolean);

    return configured && configured.length > 0
      ? configured
      : this.defaultEndpoints;
  }

  private mapGeometry(geometry: Array<{ lat: number; lon: number }>): Coordinate[] {
    return geometry.map((point) => ({
      lat: point.lat,
      lng: point.lon,
    }));
  }

  private mapPoi(node: OverpassElement): PoiData | null {
    const tags = node.tags ?? {};
    const location = {
      lat: node.lat as number,
      lng: node.lon as number,
    };
    if (!isFiniteCoordinate(location)) {
      return null;
    }
    const isLandmark =
      Boolean(tags.tourism) ||
      tags.historic === 'yes' ||
      tags.memorial === 'yes';

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

  private mapBuilding(way: OverpassElement): PlacePackage['buildings'][number] | null {
    const footprint = this.sanitizeRing(this.mapGeometry(way.geometry ?? []));
    if (footprint === null) {
      return null;
    }

    return {
      id: `building-${way.id}`,
      name: way.tags?.name ?? `building-${way.id}`,
      heightMeters: this.resolveHeight(way.tags),
      usage: this.resolveUsage(way.tags),
      footprint,
      facadeColor:
        way.tags?.['building:colour'] ?? way.tags?.['building:color'] ?? null,
      facadeMaterial: way.tags?.['building:material'] ?? null,
      roofColor: way.tags?.['roof:colour'] ?? way.tags?.['roof:color'] ?? null,
      roofMaterial: way.tags?.['roof:material'] ?? null,
      roofShape: way.tags?.['roof:shape'] ?? null,
    };
  }

  private mapRoad(way: OverpassElement): PlacePackage['roads'][number] | null {
    const path = this.sanitizePath(this.mapGeometry(way.geometry ?? []));
    if (path === null) {
      return null;
    }

    return {
      id: `road-${way.id}`,
      name: way.tags?.name ?? `road-${way.id}`,
      laneCount: this.resolveLaneCount(way.tags),
      widthMeters: this.resolveRoadWidth(way.tags),
      roadClass: way.tags?.highway ?? 'road',
      direction: way.tags?.oneway === 'yes' ? 'ONE_WAY' : 'TWO_WAY',
      path,
      surface: way.tags?.surface ?? null,
      bridge: Boolean(way.tags?.bridge),
    };
  }

  private mapWalkway(way: OverpassElement): PlacePackage['walkways'][number] | null {
    const path = this.sanitizePath(this.mapGeometry(way.geometry ?? []));
    if (path === null) {
      return null;
    }

    return {
      id: `walkway-${way.id}`,
      name: way.tags?.name ?? `walkway-${way.id}`,
      widthMeters: this.resolveWalkwayWidth(way.tags),
      walkwayType: way.tags?.highway ?? way.tags?.footway ?? 'footway',
      path,
      surface: way.tags?.surface ?? null,
    };
  }

  private mapCrossing(way: OverpassElement): CrossingData | null {
    const path = this.sanitizePath(this.mapGeometry(way.geometry ?? []));
    if (path === null) {
      return null;
    }

    const center = midpoint(path);
    if (!center) {
      return null;
    }

    return {
      id: `crossing-${way.id}`,
      name: way.tags?.name ?? `crossing-${way.id}`,
      type: 'CROSSING',
      crossing: way.tags?.crossing ?? way.tags?.['crossing:markings'] ?? null,
      crossingRef: way.tags?.crossing_ref ?? null,
      signalized:
        way.tags?.crossing === 'traffic_signals' ||
        way.tags?.crossing === 'controlled' ||
        way.tags?.crossing_signals === 'yes',
      path,
      center,
    };
  }

  private mapStreetFurniture(node: OverpassElement): StreetFurnitureData | null {
    const location = {
      lat: node.lat as number,
      lng: node.lon as number,
    };
    if (!isFiniteCoordinate(location)) {
      return null;
    }

    const type =
      node.tags?.highway === 'traffic_signals'
        ? 'TRAFFIC_LIGHT'
        : node.tags?.highway === 'street_lamp'
          ? 'STREET_LIGHT'
          : node.tags?.traffic_sign
            ? 'SIGN_POLE'
            : null;

    if (!type) {
      return null;
    }

    return {
      id: `street-furniture-${node.id}`,
      name: node.tags?.name ?? `${type.toLowerCase()}-${node.id}`,
      type,
      location,
    };
  }

  private mapVegetation(node: OverpassElement): VegetationData | null {
    const location = {
      lat: node.lat as number,
      lng: node.lon as number,
    };
    if (!isFiniteCoordinate(location)) {
      return null;
    }

    return {
      id: `vegetation-${node.id}`,
      name: node.tags?.name ?? `tree-${node.id}`,
      type: 'TREE',
      location,
      radiusMeters: 2.4,
    };
  }

  private mapLandCover(way: OverpassElement): LandCoverData | null {
    const polygon = this.sanitizeRing(this.mapGeometry(way.geometry ?? []));
    if (polygon === null) {
      return null;
    }

    const tags = way.tags ?? {};
    const type =
      tags.landuse === 'grass' ||
      tags.landuse === 'recreation_ground' ||
      tags.leisure === 'park'
        ? 'PARK'
        : tags.natural === 'water' || tags.landuse === 'reservoir'
          ? 'WATER'
          : 'PLAZA';

    return {
      id: `land-cover-${way.id}`,
      type,
      polygon,
    };
  }

  private mapLinearFeature(way: OverpassElement): LinearFeatureData | null {
    const path = this.sanitizePath(this.mapGeometry(way.geometry ?? []));
    if (path === null) {
      return null;
    }

    const type =
      way.tags?.railway
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

  private sanitizeRing(points: Coordinate[]): Coordinate[] | null {
    const sanitized = this.dedupeCoordinates(points).filter(isFiniteCoordinate);
    if (sanitized.length > 1) {
      const first = sanitized[0];
      const last = sanitized[sanitized.length - 1];
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

  private sanitizePath(points: Coordinate[]): Coordinate[] | null {
    const sanitized = this.dedupeCoordinates(points).filter(isFiniteCoordinate);
    if (sanitized.length < 2) {
      return null;
    }

    if (!midpoint(sanitized)) {
      return null;
    }

    return sanitized;
  }

  private dedupeCoordinates(points: Coordinate[]): Coordinate[] {
    return points.filter((point, index) => {
      const prev = points[index - 1];
      return !prev || !coordinatesEqual(prev, point);
    });
  }

  private resolveLaneCount(tags?: Record<string, string>): number {
    const lanes = Number.parseInt(tags?.lanes ?? '', 10);
    return Number.isInteger(lanes) && lanes > 0 ? lanes : 2;
  }

  private resolveWidth(tags?: Record<string, string>): number {
    const width = Number.parseFloat(tags?.width ?? '');
    return Number.isFinite(width) && width > 0 ? width : 4;
  }

  private resolveRoadWidth(tags?: Record<string, string>): number {
    const explicitWidth = this.resolveWidth(tags);
    if (Number.isFinite(explicitWidth) && explicitWidth > 0 && tags?.width) {
      return explicitWidth;
    }

    const lanes = this.resolveLaneCount(tags);
    const roadClass = tags?.highway ?? '';
    const fallbackPerLane = ['motorway', 'trunk', 'primary'].includes(roadClass)
      ? 3.5
      : ['secondary', 'tertiary'].includes(roadClass)
        ? 3.2
        : 3;

    return lanes * fallbackPerLane;
  }

  private resolveWalkwayWidth(tags?: Record<string, string>): number {
    const explicitWidth = this.resolveWidth(tags);
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

  private resolveHeight(tags?: Record<string, string>): number {
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

  private resolveUsage(
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
}

function dedupeElements(elements: OverpassElement[]): OverpassElement[] {
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
