import { Injectable } from '@nestjs/common';
import { AppLoggerService } from '../../common/logging/app-logger.service';
import { AppException } from '../../common/errors/app.exception';
import { fetchJson } from '../../common/http/fetch-json';
import type { FetchLike } from '../../common/http/fetch-json';
import { ExternalPlaceDetail } from '../types/external-place.types';
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
} from '../types/place.types';
import {
  coordinatesEqual,
  createBoundsFromCenterRadius,
  isFiniteCoordinate,
  midpoint,
  polygonSignedArea,
} from '../utils/geo.utils';

interface OverpassResponse {
  elements?: OverpassElement[];
}

interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  geometry?: Array<{ lat: number; lon: number }>;
  members?: Array<{
    type: 'way' | 'node';
    ref: number;
    role?: string;
    geometry?: Array<{ lat: number; lon: number }>;
  }>;
  tags?: Record<string, string>;
}

export interface BuildPlacePackageOptions {
  bounds?: GeoBounds;
  radiusM?: number;
  sceneId?: string;
  requestId?: string | null;
}

@Injectable()
export class OverpassClient {
  private fetcher: FetchLike = fetch;
  private readonly maxEndpointAttempts = 2;
  private readonly fallbackBoundScales = [1, 0.82, 0.64];
  private readonly defaultEndpoints = [
    'https://overpass.private.coffee/api/interpreter',
    'https://overpass-api.de/api/interpreter',
  ];

  constructor(private readonly appLoggerService: AppLoggerService) {}

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

    const scopes: Array<'core' | 'street' | 'environment'> = [
      'core',
      'street',
      'environment',
    ];
    const responses: OverpassResponse[] = [];
    for (const [index, scope] of scopes.entries()) {
      responses.push(
        await this.fetchScopeResponse(bounds, scope, {
          requestId: options.requestId ?? null,
          sceneId: options.sceneId,
          batch: index,
        }),
      );
    }
    const elements = dedupeElements(
      responses.flatMap((response) => response.elements ?? []),
    );
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

    const buildings = [...buildingWays, ...buildingRelations]
      .map((wayOrRelation) => this.mapBuilding(wayOrRelation))
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
        droppedBuildings: buildingWays.length + buildingRelations.length - buildings.length,
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
            `relation["building"]${bbox};`,
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
out geom qt;
    `.trim();
  }

  private async fetchScopeResponse(
    bounds: GeoBounds,
    scope: 'core' | 'street' | 'environment',
    context: {
      requestId?: string | null;
      sceneId?: string;
      batch: number;
    },
  ): Promise<OverpassResponse> {
    let lastError: unknown;

    for (const scale of this.fallbackBoundScales) {
      const scopedBounds = scale === 1 ? bounds : this.scaleBounds(bounds, scale);
      const query = this.buildQuery(scopedBounds, scope);
      try {
        this.appLoggerService.info('overpass.batch.started', {
          requestId: context.requestId,
          sceneId: context.sceneId,
          provider: 'overpass',
          step: 'overpass_batch',
          batch: context.batch,
          scope,
          boundScale: scale,
        });
        const response = await this.fetchOverpassResponse(query, {
          ...context,
          scope,
          boundScale: scale,
        });
        this.appLoggerService.info('overpass.batch.completed', {
          requestId: context.requestId,
          sceneId: context.sceneId,
          provider: 'overpass',
          step: 'overpass_batch',
          batch: context.batch,
          scope,
          boundScale: scale,
          elementCount: response.elements?.length ?? 0,
        });
        return response;
      } catch (error) {
        lastError = error;
        this.appLoggerService.warn('overpass.batch.retry_with_smaller_bounds', {
          requestId: context.requestId,
          sceneId: context.sceneId,
          provider: 'overpass',
          step: 'overpass_batch',
          batch: context.batch,
          scope,
          boundScale: scale,
          error,
        });
      }
    }

    throw lastError instanceof Error ? lastError : new Error('Overpass batch failed');
  }

  private async fetchOverpassResponse(
    query: string,
    context: {
      requestId?: string | null;
      sceneId?: string;
      batch: number;
      scope?: string;
      boundScale?: number;
    },
  ): Promise<OverpassResponse> {
    const endpoints = this.resolveEndpoints();
    let lastError: unknown;

    for (const url of endpoints) {
      for (let attempt = 1; attempt <= this.maxEndpointAttempts; attempt += 1) {
        try {
          this.appLoggerService.info('overpass.request.started', {
            requestId: context.requestId,
            sceneId: context.sceneId,
            provider: 'overpass',
            step: 'overpass_request',
            batch: context.batch,
            scope: context.scope,
            boundScale: context.boundScale,
            url,
            attempt,
          });
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
          this.appLoggerService.warn('overpass.request.failed', {
            requestId: context.requestId,
            sceneId: context.sceneId,
            provider: 'overpass',
            step: 'overpass_request',
            batch: context.batch,
            scope: context.scope,
            boundScale: context.boundScale,
            url,
            attempt,
            error,
          });
          if (attempt < this.maxEndpointAttempts) {
            await this.sleep(250 * attempt);
          }
        }
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

  private scaleBounds(bounds: GeoBounds, ratio: number): GeoBounds {
    const centerLat = (bounds.northEast.lat + bounds.southWest.lat) / 2;
    const centerLng = (bounds.northEast.lng + bounds.southWest.lng) / 2;
    const latHalfSpan = ((bounds.northEast.lat - bounds.southWest.lat) / 2) * ratio;
    const lngHalfSpan = ((bounds.northEast.lng - bounds.southWest.lng) / 2) * ratio;

    return {
      northEast: {
        lat: centerLat + latHalfSpan,
        lng: centerLng + lngHalfSpan,
      },
      southWest: {
        lat: centerLat - latHalfSpan,
        lng: centerLng - lngHalfSpan,
      },
    };
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
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

  private mapBuilding(
    element: OverpassElement,
  ): PlacePackage['buildings'][number] | null {
    if (element.type === 'relation') {
      return this.mapBuildingRelation(element);
    }

    const outerRing = this.sanitizeRing(this.mapGeometry(element.geometry ?? []));
    if (outerRing === null) {
      return null;
    }

    return this.buildBuildingRecord(
      `building-${element.id}`,
      element.tags,
      outerRing,
      [],
    );
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

  private mapBuildingRelation(
    relation: OverpassElement,
  ): PlacePackage['buildings'][number] | null {
    const outerRings = this.buildRingsFromMembers(
      (relation.members ?? []).filter((member) => (member.role ?? 'outer') === 'outer'),
    );
    if (outerRings.length === 0) {
      return null;
    }

    const primaryOuter = [...outerRings].sort(
      (left, right) =>
        Math.abs(polygonSignedArea(right)) - Math.abs(polygonSignedArea(left)),
    )[0];
    const holes = this.buildRingsFromMembers(
      (relation.members ?? []).filter((member) => member.role === 'inner'),
    ).filter((ring) => {
      const sample = ring[0];
      return sample ? this.isPointInsideRing(sample, primaryOuter) : false;
    });

    return this.buildBuildingRecord(
      `building-${relation.id}`,
      relation.tags,
      primaryOuter,
      holes,
    );
  }

  private buildBuildingRecord(
    id: string,
    tags: Record<string, string> | undefined,
    outerRing: Coordinate[],
    holes: Coordinate[][],
  ): PlacePackage['buildings'][number] {
    return {
      id,
      name: tags?.name ?? id,
      heightMeters: this.resolveHeight(tags),
      usage: this.resolveUsage(tags),
      outerRing,
      holes,
      footprint: outerRing,
      facadeColor: tags?.['building:colour'] ?? tags?.['building:color'] ?? null,
      facadeMaterial: tags?.['building:material'] ?? null,
      roofColor: tags?.['roof:colour'] ?? tags?.['roof:color'] ?? null,
      roofMaterial: tags?.['roof:material'] ?? null,
      roofShape: tags?.['roof:shape'] ?? null,
      buildingPart: tags?.['building:part'] ?? null,
    };
  }

  private buildRingsFromMembers(
    members: NonNullable<OverpassElement['members']>,
  ): Coordinate[][] {
    const remaining = members
      .map((member) => this.mapGeometry(member.geometry ?? []))
      .map((segment) => this.dedupeCoordinates(segment).filter(isFiniteCoordinate))
      .filter((segment) => segment.length >= 2);
    const rings: Coordinate[][] = [];

    while (remaining.length > 0) {
      let ring = [...remaining.shift()!];
      let progressed = true;

      while (progressed) {
        progressed = false;
        if (coordinatesEqual(ring[0], ring[ring.length - 1])) {
          break;
        }

        for (let index = 0; index < remaining.length; index += 1) {
          const segment = remaining[index];
          const start = segment[0];
          const end = segment[segment.length - 1];
          const ringStart = ring[0];
          const ringEnd = ring[ring.length - 1];

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

      const sanitized = this.sanitizeRing(ring);
      if (sanitized) {
        rings.push(sanitized);
      }
    }

    return rings;
  }

  private isPointInsideRing(point: Coordinate, ring: Coordinate[]): boolean {
    let inside = false;
    for (let index = 0, prev = ring.length - 1; index < ring.length; prev = index, index += 1) {
      const current = ring[index];
      const previous = ring[prev];
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
