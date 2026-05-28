import { Injectable, Logger } from '@nestjs/common';
import type { SceneScope } from '../../shared/contracts/twin-scene-graph';
import { wgs84ToEnu, type LatLng } from '../../shared/core/coordinates';

export type OverpassElement = {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  geometry?: Array<{ lat: number; lon: number }>;
  nodes?: number[];
  tags?: Record<string, string>;
};

export type OverpassResponse = {
  version: number;
  elements: OverpassElement[];
};

export type OSMEntityData = {
  provider: 'osm';
  entityType: 'building' | 'road' | 'walkway' | 'terrain' | 'poi';
  geometry: Record<string, unknown>;
  tags: Record<string, string>;
  id: string;
};

@Injectable()
export class OverpassAdapter {
  private readonly logger = new Logger(OverpassAdapter.name);
  private readonly apiUrl = 'https://overpass-api.de/api/interpreter';

  constructor() {}

  async queryBuildings(scope: SceneScope): Promise<OSMEntityData[]> {
    const bbox = this.scopeToBbox(scope);
    const query = `[out:json];(way["building"](${bbox}););out geom;`;
    const elements = await this.executeQuery(query);
    return elements
      .filter((el) => el.type === 'way' && el.geometry && el.geometry.length >= 3)
      .map((el) => this.toEntityData(el, 'building', scope.center));
  }

  async queryRoads(scope: SceneScope): Promise<OSMEntityData[]> {
    const bbox = this.scopeToBbox(scope);
    const query = `[out:json];(way["highway"](${bbox}););out geom;`;
    const elements = await this.executeQuery(query);
    return elements
      .filter((el) => el.type === 'way' && el.geometry && el.geometry.length >= 2)
      .map((el) => this.toEntityData(el, 'road', scope.center));
  }

  async queryWalkways(scope: SceneScope): Promise<OSMEntityData[]> {
    const bbox = this.scopeToBbox(scope);
    const query = `[out:json];(way["footway"](${bbox});way["path"](${bbox}););out geom;`;
    const elements = await this.executeQuery(query);
    return elements
      .filter((el) => el.type === 'way' && el.geometry && el.geometry.length >= 2)
      .map((el) => this.toEntityData(el, 'walkway', scope.center));
  }

  async queryTerrain(scope: SceneScope): Promise<OSMEntityData[]> {
    const bbox = this.scopeToBbox(scope);
    const query = `[out:json];(node["natural"](${bbox});node["landuse"](${bbox});way["natural"](${bbox});way["landuse"](${bbox}););out geom;`;
    const elements = await this.executeQuery(query);
    return elements.map((el) => this.toEntityData(el, 'terrain', scope.center));
  }

  async queryAll(scope: SceneScope): Promise<OSMEntityData[]> {
    // Overpass API is sensitive to concurrent requests; run sequentially to avoid 429.
    const buildings = await this.queryBuildings(scope);
    await this.delay(200);
    const roads = await this.queryRoads(scope);
    await this.delay(200);
    const walkways = await this.queryWalkways(scope);
    await this.delay(200);
    const terrain = await this.queryTerrain(scope);
    return [...buildings, ...roads, ...walkways, ...terrain];
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private scopeToBbox(scope: SceneScope): string {
    const lat = scope.center.lat;
    const lng = scope.center.lng;
    const radius = scope.radiusMeters ?? 150;
    const latDelta = radius / 111_320;
    const lngDelta = radius / (111_320 * Math.cos((lat * Math.PI) / 180));
    const south = lat - latDelta;
    const north = lat + latDelta;
    const west = lng - lngDelta;
    const east = lng + lngDelta;
    return `${south},${west},${north},${east}`;
  }

  protected async executeQuery(query: string, retries = 3): Promise<OverpassElement[]> {
    let lastError: Error | undefined;
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const response = await fetch(this.apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `data=${encodeURIComponent(query)}`,
        });

        if (response.status === 429) {
          const delay = 1000 * (attempt + 1);
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }

        if (!response.ok) {
          throw new Error(`Overpass API error: ${response.status} ${response.statusText}`);
        }

        const data = (await response.json()) as OverpassResponse;
        this.logger.debug(`Overpass query success elements=${data.elements.length}`);
        return data.elements;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < retries - 1) {
          const delay = 500 * (attempt + 1);
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    }
    throw lastError ?? new Error('Overpass API request failed after retries');
  }

  private toEntityData(
    element: OverpassElement,
    entityType: OSMEntityData['entityType'],
    origin: LatLng,
  ): OSMEntityData {
    const coords = this.toLocalCoordinates(element, origin);

    let geometry: Record<string, unknown>;
    switch (entityType) {
      case 'building': {
        const buildingTag = element.tags?.['building'];
        const height = this.inferHeight(
          element.tags?.['height'],
          element.tags?.['building:levels'],
          buildingTag,
        );
        geometry = { footprint: { outer: coords }, baseY: 0, height };
        break;
      }
      case 'road':
      case 'walkway':
        geometry = { centerline: coords };
        break;
      case 'terrain':
        geometry = { samples: coords };
        break;
      default:
        geometry = { point: coords[0] ?? { x: 0, y: 0, z: 0 } };
    }

    return {
      provider: 'osm',
      entityType,
      geometry,
      tags: element.tags ?? {},
      id: `osm:${element.type}:${element.id}`,
    };
  }

  private toLocalCoordinates(element: OverpassElement, origin: LatLng): Array<{ x: number; y: number; z: number }> {
    if (Array.isArray(element.geometry) && element.geometry.length > 0) {
      return element.geometry.map((g) => this.toLocalPoint(g.lat, g.lon, origin));
    }

    if (typeof element.lat === 'number' && typeof element.lon === 'number') {
      return [this.toLocalPoint(element.lat, element.lon, origin)];
    }

    return [];
  }

  private toLocalPoint(lat: number, lon: number, origin: LatLng): { x: number; y: number; z: number } {
    const enu = wgs84ToEnu({ lat, lng: lon }, origin);
    return {
      x: enu.x,
      y: 0,
      z: enu.y,
    };
  }

  private parseHeight(value: string | undefined): number | undefined {
    if (value === undefined) return undefined;
    const trimmed = value.trim();

    // Feet notation: "15'", "15' 6\"", "15ft", "50 ft", "50 feet"
    const feetMatch = trimmed.match(/^([0-9]+\.?[0-9]*)\s*(?:'|ft\b|feet\b)/i);
    if (feetMatch !== null && feetMatch[1] !== undefined) {
      const feet = parseFloat(feetMatch[1]);
      const inchesMatch = trimmed.match(/'\s*([0-9]+\.?[0-9]*)\s*"/);
      const inches = inchesMatch !== null && inchesMatch[1] !== undefined ? parseFloat(inchesMatch[1]) : 0;
      const meters = (feet + inches / 12) * 0.3048;
      return Number.isFinite(meters) && meters > 0 ? meters : undefined;
    }

    // Metric (default): "15", "15m", "15 m"
    const match = trimmed.match(/^([0-9]+\.?[0-9]*)/);
    if (match === null || match[1] === undefined) return undefined;
    const num = parseFloat(match[1]);
    return Number.isFinite(num) && num > 0 ? num : undefined;
  }

  private parseLevels(value: string | undefined): number | undefined {
    if (value === undefined) return undefined;
    const num = parseInt(value.trim(), 10);
    return Number.isFinite(num) && num > 0 ? num : undefined;
  }

  private inferHeight(
    heightStr: string | undefined,
    levelsStr: string | undefined,
    buildingTag: string | undefined,
  ): number {
    const explicit = this.parseHeight(heightStr);
    if (explicit !== undefined) return explicit;

    const levels = this.parseLevels(levelsStr);
    if (levels !== undefined) return levels * 3.5;

    const typeDefaults: Record<string, number> = {
      skyscraper: 80,
      tower: 40,
      office: 20,
      commercial: 8,
      retail: 5,
      industrial: 7,
      warehouse: 6,
      residential: 9,
      apartments: 12,
      house: 6,
      detached: 6,
      church: 14,
      school: 8,
      hotel: 18,
      yes: 8,
    };
    return typeDefaults[buildingTag ?? 'yes'] ?? 8;
  }
}
