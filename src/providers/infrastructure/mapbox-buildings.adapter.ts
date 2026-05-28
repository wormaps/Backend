import { Injectable, Logger } from '@nestjs/common';
import type { SceneScope } from '../../shared/contracts';
import { wgs84ToEnu } from '../../shared/core';
import type { OSMEntityData } from './overpass.adapter';

// ---------------------------------------------------------------------------
// Mapbox Tilequery response types
// ---------------------------------------------------------------------------

type MapboxTilequeryFeature = {
  type: 'Feature';
  geometry: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: number[][][];
  };
  properties: {
    tilequery?: { distance: number; geometry: string; layer: string };
    extrude?: string;
    height?: number;
    min_height?: number;
    underground?: string;
    type?: string;
    [key: string]: unknown;
  };
};

type TilequeryResponse = {
  type: 'FeatureCollection';
  features: MapboxTilequeryFeature[];
};

// Mapbox building type → OSM building tag
const TYPE_MAP: Record<string, string> = {
  commercial: 'commercial',
  residential: 'apartments',
  industrial: 'industrial',
  retail: 'retail',
  office: 'office',
  school: 'school',
  hotel: 'hotel',
  hospital: 'hospital',
  church: 'church',
  warehouse: 'warehouse',
};

@Injectable()
export class MapboxBuildingsAdapter {
  private readonly logger = new Logger(MapboxBuildingsAdapter.name);
  private readonly token = process.env.MAPBOX_TOKEN ?? '';

  async queryBuildings(scope: SceneScope): Promise<OSMEntityData[]> {
    if (!this.token) {
      this.logger.warn('MAPBOX_TOKEN not set — skipping Mapbox buildings');
      return [];
    }

    const { lat, lng } = scope.center;
    const radius = Math.min(scope.radiusMeters ?? 150, 1000); // Tilequery max = 1000m

    // Tilequery returns up to 50 features per request.
    // For dense urban areas, use two tile offsets to improve coverage.
    const results = await this.fetchWithOffsets(lat, lng, radius);
    this.logger.debug(`Mapbox buildings fetched count=${results.length}`);
    return results;
  }

  private async fetchWithOffsets(
    lat: number,
    lng: number,
    radius: number,
  ): Promise<OSMEntityData[]> {
    const origin = { lat, lng };
    const features = await this.tilequeryRequest(lng, lat, radius);
    const seen = new Set<string>();
    const entities: OSMEntityData[] = [];

    for (const f of features) {
      if (f.geometry?.type !== 'Polygon' && f.geometry?.type !== 'MultiPolygon') continue;
      if (f.properties.tilequery?.layer !== 'building') continue;

      const id = this.featureId(f);
      if (seen.has(id)) continue;
      seen.add(id);

      entities.push(...this.featureToEntities(f, origin));
    }

    return entities;
  }

  private async tilequeryRequest(
    lng: number,
    lat: number,
    radius: number,
  ): Promise<MapboxTilequeryFeature[]> {
    const url =
      `https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/tilequery/${lng},${lat}.json` +
      `?radius=${radius}&limit=50&layers=building&geometry=polygon&dedupe` +
      `&access_token=${this.token}`;

    const response = await fetch(url, {
      headers: { 'User-Agent': 'wormapb/1.0 (3D city pipeline)' },
    });

    if (!response.ok) {
      throw new Error(`Mapbox Tilequery error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as TilequeryResponse;
    return data.features ?? [];
  }

  private featureToEntities(
    feature: MapboxTilequeryFeature,
    origin: { lat: number; lng: number },
  ): OSMEntityData[] {
    const props = feature.properties;
    const height = typeof props.height === 'number' && props.height > 0 ? props.height : 8;
    const buildingTag = TYPE_MAP[props.type ?? ''] ?? 'yes';

    const rings: number[][][] =
      feature.geometry.type === 'MultiPolygon'
        ? (feature.geometry.coordinates as unknown as number[][][][]).map((p) => p[0]!)
        : [feature.geometry.coordinates[0]!];

    return rings
      .map((ring) => {
        if (!ring || ring.length < 3) return null;

        const outer = ring.map(([lng, lat]) => {
          const enu = wgs84ToEnu({ lat: lat!, lng: lng! }, origin);
          return { x: enu.x, y: 0, z: enu.y };
        });

        return {
          provider: 'mapbox' as const,
          entityType: 'building' as const,
          geometry: { footprint: { outer }, baseY: 0, height },
          tags: {
            building: buildingTag,
            height: String(height),
          },
          id: `mapbox:building:${this.featureId(feature)}`,
        };
      })
      .filter((e) => e !== null) as OSMEntityData[];
  }

  private featureId(feature: MapboxTilequeryFeature): string {
    // Use centroid of first ring as a stable-ish ID
    const ring = feature.geometry.coordinates[0];
    if (!ring || ring.length === 0) return Math.random().toString(36).slice(2);
    const cx = ring.reduce((s, p) => s + (p[0] ?? 0), 0) / ring.length;
    const cy = ring.reduce((s, p) => s + (p[1] ?? 0), 0) / ring.length;
    return `${cx.toFixed(5)}_${cy.toFixed(5)}`;
  }
}
