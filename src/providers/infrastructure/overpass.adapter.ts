import type { SceneScope } from '../../../packages/contracts/twin-scene-graph';

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

export class OverpassAdapter {
  constructor(private readonly apiUrl: string = 'https://overpass-api.de/api/interpreter') {}

  async queryBuildings(scope: SceneScope): Promise<OSMEntityData[]> {
    const bbox = this.scopeToBbox(scope);
    const query = `[out:json];(way["building"](${bbox}););out geom;`;
    const elements = await this.executeQuery(query);
    return elements
      .filter((el) => el.type === 'way' && el.geometry && el.geometry.length >= 3)
      .map((el) => this.toEntityData(el, 'building'));
  }

  async queryRoads(scope: SceneScope): Promise<OSMEntityData[]> {
    const bbox = this.scopeToBbox(scope);
    const query = `[out:json];(way["highway"](${bbox}););out geom;`;
    const elements = await this.executeQuery(query);
    return elements
      .filter((el) => el.type === 'way' && el.geometry && el.geometry.length >= 2)
      .map((el) => this.toEntityData(el, 'road'));
  }

  async queryWalkways(scope: SceneScope): Promise<OSMEntityData[]> {
    const bbox = this.scopeToBbox(scope);
    const query = `[out:json];(way["footway"](${bbox});way["path"](${bbox}););out geom;`;
    const elements = await this.executeQuery(query);
    return elements
      .filter((el) => el.type === 'way' && el.geometry && el.geometry.length >= 2)
      .map((el) => this.toEntityData(el, 'walkway'));
  }

  async queryTerrain(scope: SceneScope): Promise<OSMEntityData[]> {
    const bbox = this.scopeToBbox(scope);
    const query = `[out:json];(node["natural"](${bbox});node["landuse"](${bbox});way["natural"](${bbox});way["landuse"](${bbox}););out geom;`;
    const elements = await this.executeQuery(query);
    return elements.map((el) => this.toEntityData(el, 'terrain'));
  }

  async queryAll(scope: SceneScope): Promise<OSMEntityData[]> {
    const [buildings, roads, walkways, terrain] = await Promise.all([
      this.queryBuildings(scope),
      this.queryRoads(scope),
      this.queryWalkways(scope),
      this.queryTerrain(scope),
    ]);
    return [...buildings, ...roads, ...walkways, ...terrain];
  }

  private scopeToBbox(scope: SceneScope): string {
    const lat = scope.center.lat;
    const lng = scope.center.lng;
    const radius = scope.radiusMeters ?? 150;
    const latDelta = (radius / 111_320) * 0.01;
    const lngDelta = (radius / (111_320 * Math.cos((lat * Math.PI) / 180))) * 0.01;
    const south = lat - latDelta;
    const north = lat + latDelta;
    const west = lng - lngDelta;
    const east = lng + lngDelta;
    return `${south},${west},${north},${east}`;
  }

  private async executeQuery(query: string): Promise<OverpassElement[]> {
    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
    });

    if (!response.ok) {
      throw new Error(`Overpass API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as OverpassResponse;
    return data.elements;
  }

  private toEntityData(element: OverpassElement, entityType: OSMEntityData['entityType']): OSMEntityData {
    const coords = element.geometry?.map((g) => ({ x: g.lon, y: 0, z: g.lat })) ?? [];

    let geometry: Record<string, unknown>;
    switch (entityType) {
      case 'building':
        geometry = { footprint: { outer: coords }, baseY: 0 };
        break;
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
}
