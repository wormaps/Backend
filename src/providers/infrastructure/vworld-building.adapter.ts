import { Injectable, Logger } from '@nestjs/common';
import type { SceneScope } from '../../shared/contracts';
import { wgs84ToEnu } from '../../shared/core';
import type { OSMEntityData } from './overpass.adapter';

// ---------------------------------------------------------------------------
// V World API response types
// ---------------------------------------------------------------------------

type VWorldFeature = {
  id: string;
  type: 'Feature';
  geometry: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: number[][][];
  };
  properties: {
    bd_mgt_sn?: string;  // building management number (unique ID)
    buld_nm?: string;    // building name
    gro_flo_co?: string; // above-ground floor count
    [key: string]: unknown;
  };
};

type VWorldResponse = {
  response?: {
    status?: string;
    page?: { total: number; current: number; size: number };
    result?: {
      featureCollection?: {
        type: string;
        features: VWorldFeature[];
      };
    };
    error?: {
      code: string;
      text: string;
    };
  };
};


const VWORLD_BASE_URL = process.env.V_WORLD_BASE_URL ?? 'https://api.vworld.kr/req/data';
const VWORLD_USER_AGENT = 'wormapb/1.0 (3D city pipeline)';
const VWORLD_PAGE_SIZE = 1000;
const FLOOR_HEIGHT_M = 3.5;
const DEFAULT_BUILDING_HEIGHT_M = 8;

@Injectable()
export class VWorldBuildingAdapter {
  private readonly logger = new Logger(VWorldBuildingAdapter.name);
  private readonly apiKey = process.env.V_WORLD_API_KEY ?? '';
  private readonly domain = process.env.V_WORLD_DOMAIN ?? '';
  private readonly baseUrl = VWORLD_BASE_URL;

  async queryBuildings(scope: SceneScope): Promise<OSMEntityData[]> {
    if (!this.apiKey) {
      this.logger.warn('V_WORLD_API_KEY not set — skipping V World buildings');
      return [];
    }
    if (!this.domain) {
      this.logger.warn('V_WORLD_DOMAIN not set — API auth may fail');
    }

    const bbox = this.scopeToBbox(scope);
    const baseParams = {
      service: 'data',
      version: '2.0',
      request: 'GetFeature',
      key: this.apiKey,
      domain: this.domain,
      format: 'json',
      geometry: 'true',
      attribute: 'true',
      crs: 'epsg:4326',
      geomFilter: `BOX(${bbox.minLng},${bbox.minLat},${bbox.maxLng},${bbox.maxLat})`,
      data: 'LT_C_SPBD',
      size: String(VWORLD_PAGE_SIZE),
    };

    const allFeatures: VWorldFeature[] = [];
    let page = 1;
    let totalPages = 1;

    do {
      const params = new URLSearchParams({ ...baseParams, page: String(page) });
      const response = await fetch(`${this.baseUrl}?${params}`, {
        headers: { 'User-Agent': VWORLD_USER_AGENT },
      });

      if (!response.ok) {
        throw new Error(`V World API error: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as VWorldResponse;

      if (data.response?.status !== 'OK') {
        const err = data.response?.error;
        throw new Error(`V World API error: ${err?.code} — ${err?.text}`);
      }

      const features = data.response?.result?.featureCollection?.features ?? [];
      allFeatures.push(...features);
      totalPages = data.response?.page?.total ?? 1;
      page++;
    } while (page <= totalPages);

    this.logger.debug(`V World buildings fetched count=${allFeatures.length}`);

    return allFeatures
      .filter((f) => f.geometry?.type === 'Polygon' || f.geometry?.type === 'MultiPolygon')
      .flatMap((f) => this.featureToEntities(f, scope.center));
  }

  private featureToEntities(
    feature: VWorldFeature,
    origin: { lat: number; lng: number },
  ): OSMEntityData[] {
    const props = feature.properties;
    const height = this.resolveHeight(props.gro_flo_co as string | undefined);

    const rings: number[][][] =
      feature.geometry.type === 'MultiPolygon'
        ? (feature.geometry.coordinates as unknown as number[][][][]).map((poly) => poly[0]!)
        : [feature.geometry.coordinates[0]!];

    return rings
      .map((ring) => {
        if (!ring || ring.length < 3) return null;

        const outer = ring.map(([lng, lat]) => {
          const enu = wgs84ToEnu({ lat: lat!, lng: lng! }, origin);
          return { x: enu.x, y: 0, z: enu.y };
        });

        return {
          provider: 'vworld' as const,
          entityType: 'building' as const,
          geometry: { footprint: { outer }, baseY: 0, height },
          tags: {
            building: 'yes',
            'building:levels': String(props.gro_flo_co ?? ''),
            height: String(height),
            name: String(props.buld_nm ?? ''),
          },
          id: `vworld:building:${props.bd_mgt_sn ?? feature.id}`,
        };
      })
      .filter((e) => e !== null) as OSMEntityData[];
  }

  private resolveHeight(floorsStr?: string): number {
    const floors = parseInt(floorsStr ?? '', 10);
    if (Number.isFinite(floors) && floors > 0) return floors * FLOOR_HEIGHT_M;
    return DEFAULT_BUILDING_HEIGHT_M;
  }

  private scopeToBbox(scope: SceneScope) {
    const lat = scope.center.lat;
    const lng = scope.center.lng;
    const radius = scope.radiusMeters ?? 150;
    const latDelta = radius / 111_320;
    const lngDelta = radius / (111_320 * Math.cos((lat * Math.PI) / 180));
    return {
      minLat: lat - latDelta,
      maxLat: lat + latDelta,
      minLng: lng - lngDelta,
      maxLng: lng + lngDelta,
    };
  }
}
