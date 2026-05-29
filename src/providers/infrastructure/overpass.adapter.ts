import { Injectable, Logger } from '@nestjs/common';
import type { SceneScope } from '../../shared/contracts';
import { wgs84ToEnu, type LatLng } from '../../shared/core';

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

export type GeoEntityProvider = 'osm' | 'vworld' | 'mapbox';

export type OSMEntityData = {
  provider: GeoEntityProvider;
  entityType: 'building' | 'road' | 'walkway' | 'terrain' | 'poi';
  geometry: Record<string, unknown>;
  tags: Record<string, string>;
  id: string;
};

@Injectable()
export class OverpassAdapter {
  private readonly logger = new Logger(OverpassAdapter.name);
  private readonly apiUrls: string[];

  constructor() {
    const envUrls = process.env.OVERPASS_API_URLS ?? '';
    const parsed = envUrls
      .split(',')
      .map((u) => u.trim())
      .filter(Boolean);
    this.apiUrls =
      parsed.length > 0
        ? parsed
        : [
            'https://overpass-api.de/api/interpreter',
            'https://overpass.kumi.systems/api/interpreter',
            'https://overpass.private.coffee/api/interpreter',
          ];
  }

  async queryBuildings(scope: SceneScope): Promise<OSMEntityData[]> {
    const bbox = this.scopeToBbox(scope);
    // Exclude non-structural tags (entrance, shed, garage, roof, etc.) and building:part relations.
    const structuralValues =
      'yes|residential|apartments|commercial|office|retail|industrial|hotel|school|' +
      'church|warehouse|house|detached|terrace|dormitory|civic|government|hospital|' +
      'university|public|transportation|train_station|cathedral|temple|mosque';
    const query =
      `[out:json][timeout:25];` +
      `(way["building"~"^(${structuralValues})$"]["building:part"!~"."](${bbox}););out geom;`;
    const elements = await this.executeQuery(query);
    return elements
      .filter((el) => el.type === 'way' && el.geometry && el.geometry.length >= 3)
      .map((el) => this.toEntityData(el, 'building', scope.center));
  }

  async queryRoads(scope: SceneScope): Promise<OSMEntityData[]> {
    const bbox = this.scopeToBbox(scope);
    // Exclude pedestrian-only ways — they are collected separately by queryWalkways.
    const query = `[out:json][timeout:25];(way["highway"]["highway"!~"^(footway|path|cycleway|pedestrian|steps|bridleway)$"](${bbox}););out geom;`;
    const elements = await this.executeQuery(query);
    return elements
      .filter((el) => el.type === 'way' && el.geometry && el.geometry.length >= 2)
      .map((el) => this.toEntityData(el, 'road', scope.center));
  }

  async queryWalkways(scope: SceneScope): Promise<OSMEntityData[]> {
    const bbox = this.scopeToBbox(scope);
    // Use highway= tag (standard OSM) — matches the same set excluded from queryRoads.
    const query = `[out:json][timeout:25];(way["highway"~"^(footway|path|cycleway|pedestrian|steps|bridleway)$"](${bbox}););out geom;`;
    const elements = await this.executeQuery(query);
    return elements
      .filter((el) => el.type === 'way' && el.geometry && el.geometry.length >= 2)
      .map((el) => this.toEntityData(el, 'walkway', scope.center));
  }

  async queryTerrain(scope: SceneScope): Promise<OSMEntityData[]> {
    const bbox = this.scopeToBbox(scope);
    const query = `[out:json][timeout:25];(node["natural"](${bbox});node["landuse"](${bbox});way["natural"](${bbox});way["landuse"](${bbox}););out geom;`;
    const elements = await this.executeQuery(query);
    return elements.map((el) => this.toEntityData(el, 'terrain', scope.center));
  }

  async queryBuildingParts(scope: SceneScope): Promise<OSMEntityData[]> {
    const bbox = this.scopeToBbox(scope);
    const query = `[out:json][timeout:25];(way["building:part"](${bbox}););out geom;`;
    const elements = await this.executeQuery(query);
    return elements
      .filter((el) => el.type === 'way' && el.geometry && el.geometry.length >= 3)
      .map((el) => this.toBuildingPartEntity(el, scope.center));
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

  protected retryDelay(attempt: number): number {
    return 1000 * (attempt + 1);
  }

  protected async executeQuery(query: string, retries = 3): Promise<OverpassElement[]> {
    let lastError: Error | undefined;
    const urls = this.apiUrls;

    const maxAttempts = Math.max(retries, urls.length);
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const url = urls[attempt % urls.length]!;
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'wormapb/1.0 (3D city pipeline; https://github.com/wormapb)',
          },
          body: `data=${encodeURIComponent(query)}`,
        });

        if (response.status === 429 || response.status === 406) {
          const body = await response.text().catch(() => '');
          this.logger.warn(`Overpass ${response.status} from ${url}, attempt ${attempt + 1}/${maxAttempts} — ${body.slice(0, 200)}`);
          await new Promise((r) => setTimeout(r, this.retryDelay(attempt)));
          continue;
        }

        if (!response.ok) {
          throw new Error(`Overpass API error: ${response.status} ${response.statusText}`);
        }

        const data = (await response.json()) as OverpassResponse;
        this.logger.debug(`Overpass query success elements=${data.elements.length} url=${url}`);
        return data.elements;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < retries - 1) {
          await new Promise((r) => setTimeout(r, this.retryDelay(attempt) / 2));
        }
      }
    }
    throw lastError ?? new Error('Overpass API request failed after retries');
  }

  private inferPartMinHeight(tags: Record<string, string>): number {
    const h = this.parseHeight(tags['min_height']);
    if (h !== undefined) return h;
    const lvl = this.parseLevels(tags['min_level']);
    if (lvl !== undefined) return lvl * 3.5;
    return 0;
  }

  private inferPartTotalHeight(tags: Record<string, string>, minHeight: number): number {
    const explicit = this.parseHeight(tags['height'] ?? tags['max_height']);
    if (explicit !== undefined && explicit > minHeight) return explicit;
    // building:levels = count of levels in this part → add to base
    const partLevels = this.parseLevels(tags['building:levels']);
    if (partLevels !== undefined) return minHeight + partLevels * 3.5;
    // max_level = absolute storey index → compute relative to min_level
    const maxLvl = this.parseLevels(tags['max_level']);
    if (maxLvl !== undefined) {
      const minLvl = this.parseLevels(tags['min_level']) ?? 0;
      return minHeight + Math.max(1, maxLvl - minLvl) * 3.5;
    }
    return minHeight + 8;
  }

  private toBuildingPartEntity(element: OverpassElement, origin: LatLng): OSMEntityData {
    const tags = element.tags ?? {};
    const minHeight = this.inferPartMinHeight(tags);
    const totalHeight = this.inferPartTotalHeight(tags, minHeight);
    const partHeight = Math.max(1, totalHeight - minHeight);
    const coords = this.toLocalCoordinates(element, origin);
    return {
      provider: 'osm',
      entityType: 'building',
      geometry: { footprint: { outer: coords }, baseY: minHeight, height: partHeight, roofRise: 0 },
      tags,
      id: `osm:way:${element.id}:part`,
    };
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
        const roofRise = this.inferRoofRise(buildingTag, height, coords);
        geometry = { footprint: { outer: coords }, baseY: 0, height, roofRise };
        break;
      }
      case 'road': {
        const highway = element.tags?.['highway'] ?? 'unclassified';
        geometry = { centerline: coords, width: this.roadHalfWidth(highway), highwayType: highway };
        break;
      }
      case 'walkway':
        geometry = { centerline: coords, width: 0.75, highwayType: 'footway' };
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

  /** Half-width in metres per OSM highway classification. */
  private roadHalfWidth(highway: string): number {
    const widths: Record<string, number> = {
      motorway: 7,
      motorway_link: 4,
      trunk: 6,
      trunk_link: 3.5,
      primary: 5,
      primary_link: 3,
      secondary: 4,
      secondary_link: 2.5,
      tertiary: 3,
      tertiary_link: 2,
      residential: 2.5,
      living_street: 2,
      service: 1.5,
      unclassified: 2.5,
    };
    return widths[highway] ?? 2.5;
  }

  /**
   * Estimate hip/pyramid roof rise based on building type and footprint size.
   * Returns 0 for building types that typically have flat roofs.
   */
  private inferRoofRise(
    buildingTag: string | undefined,
    height: number,
    coords: Array<{ x: number; z: number }>,
  ): number {
    const flatRoofTypes = new Set([
      'commercial', 'office', 'retail', 'industrial', 'warehouse',
      'apartments', 'hotel', 'hospital', 'university', 'school',
      'transportation', 'stadium', 'sports_hall',
    ]);
    if (flatRoofTypes.has(buildingTag ?? '')) return 0;

    // Compute approximate minimum dimension of the footprint bounding box.
    if (coords.length < 3) return 0;
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const p of coords) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.z < minZ) minZ = p.z;
      if (p.z > maxZ) maxZ = p.z;
    }
    const minDim = Math.min(maxX - minX, maxZ - minZ);

    // Roof rise ≈ 30% of narrowest dimension, capped at 25% of wall height.
    return Math.min(minDim * 0.30, height * 0.25);
  }
}
