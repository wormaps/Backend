import { Injectable } from '@nestjs/common';
import { fetchJson } from '../common/http/fetch-json';
import type { FetchLike } from '../common/http/fetch-json';
import { ExternalPlaceDetail } from './external-place.types';
import { Coordinate, PlacePackage, PoiData } from './place.types';

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

@Injectable()
export class OverpassClient {
  private fetcher: FetchLike = fetch;

  withFetcher(fetcher: FetchLike): this {
    this.fetcher = fetcher;
    return this;
  }

  async buildPlacePackage(place: ExternalPlaceDetail): Promise<PlacePackage> {
    const bounds = place.viewport ?? {
      northEast: {
        lat: place.location.lat + 0.002,
        lng: place.location.lng + 0.002,
      },
      southWest: {
        lat: place.location.lat - 0.002,
        lng: place.location.lng - 0.002,
      },
    };

    const query = `
[out:json][timeout:25];
(
  way["building"](${bounds.southWest.lat},${bounds.southWest.lng},${bounds.northEast.lat},${bounds.northEast.lng});
  way["highway"](${bounds.southWest.lat},${bounds.southWest.lng},${bounds.northEast.lat},${bounds.northEast.lng});
  node["amenity"](${bounds.southWest.lat},${bounds.southWest.lng},${bounds.northEast.lat},${bounds.northEast.lng});
  node["tourism"](${bounds.southWest.lat},${bounds.southWest.lng},${bounds.northEast.lat},${bounds.northEast.lng});
  node["shop"](${bounds.southWest.lat},${bounds.southWest.lng},${bounds.northEast.lat},${bounds.northEast.lng});
  node["public_transport"](${bounds.southWest.lat},${bounds.southWest.lng},${bounds.northEast.lat},${bounds.northEast.lng});
);
out geom;
    `.trim();

    const response = await fetchJson<OverpassResponse>(
      {
        provider: 'Overpass API',
        url: 'https://overpass-api.de/api/interpreter',
        init: {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          },
          body: `data=${encodeURIComponent(query)}`,
        },
        timeoutMs: 20000,
      },
      this.fetcher,
    );

    const elements = response.elements ?? [];
    const buildingWays = elements.filter(
      (element) => element.type === 'way' && element.tags?.building && element.geometry?.length,
    );
    const roadWays = elements.filter(
      (element) =>
        element.type === 'way' &&
        element.tags?.highway &&
        !['footway', 'pedestrian', 'path', 'steps', 'corridor'].includes(element.tags.highway) &&
        element.geometry?.length,
    );
    const walkwayWays = elements.filter(
      (element) =>
        element.type === 'way' &&
        ['footway', 'pedestrian', 'path', 'steps', 'corridor'].includes(
          element.tags?.highway ?? '',
        ) &&
        element.geometry?.length,
    );
    const poiNodes = elements.filter(
      (element) =>
        element.type === 'node' &&
        element.lat !== undefined &&
        element.lon !== undefined &&
        (element.tags?.amenity || element.tags?.tourism || element.tags?.shop || element.tags?.public_transport),
    );

    const pois = poiNodes.slice(0, 30).map((node) => this.mapPoi(node));
    const landmarks = pois.filter((poi) => poi.type === 'LANDMARK').slice(0, 10);

    return {
      placeId: place.placeId,
      version: '2026.04-external',
      generatedAt: new Date().toISOString(),
      camera: {
        topView: { x: 0, y: 180, z: 140 },
        walkViewStart: { x: 0, y: 1.7, z: 12 },
      },
      bounds,
      buildings: buildingWays.slice(0, 100).map((way) => ({
        id: `building-${way.id}`,
        name: way.tags?.name ?? `building-${way.id}`,
        heightMeters: this.resolveHeight(way.tags),
        usage: this.resolveUsage(way.tags),
        footprint: this.mapGeometry(way.geometry ?? []),
      })),
      roads: roadWays.slice(0, 80).map((way) => ({
        id: `road-${way.id}`,
        name: way.tags?.name ?? `road-${way.id}`,
        laneCount: this.resolveLaneCount(way.tags),
        direction: way.tags?.oneway === 'yes' ? 'ONE_WAY' : 'TWO_WAY',
        path: this.mapGeometry(way.geometry ?? []),
      })),
      walkways: walkwayWays.slice(0, 80).map((way) => ({
        id: `walkway-${way.id}`,
        name: way.tags?.name ?? `walkway-${way.id}`,
        widthMeters: this.resolveWidth(way.tags),
        path: this.mapGeometry(way.geometry ?? []),
      })),
      pois,
      landmarks,
    };
  }

  private mapGeometry(geometry: Array<{ lat: number; lon: number }>): Coordinate[] {
    return geometry.map((point) => ({
      lat: point.lat,
      lng: point.lon,
    }));
  }

  private mapPoi(node: OverpassElement): PoiData {
    const tags = node.tags ?? {};
    const location = {
      lat: node.lat as number,
      lng: node.lon as number,
    };
    const isLandmark = Boolean(tags.tourism) || tags.historic === 'yes' || tags.memorial === 'yes';

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

  private resolveLaneCount(tags?: Record<string, string>): number {
    const lanes = Number.parseInt(tags?.lanes ?? '', 10);
    return Number.isInteger(lanes) && lanes > 0 ? lanes : 2;
  }

  private resolveWidth(tags?: Record<string, string>): number {
    const width = Number.parseFloat(tags?.width ?? '');
    return Number.isFinite(width) && width > 0 ? width : 4;
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
