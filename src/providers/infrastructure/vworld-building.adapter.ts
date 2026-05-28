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
    gid?: string;
    buld_nm?: string;      // building name
    buld_ht?: string;      // height (metres, may be null/"")
    grnd_flr_co?: string;  // above-ground floor count
    undr_flr_co?: string;  // below-ground floor count
    buld_se_cd?: string;   // use-class code
    buld_se_nm?: string;   // use-class name (Korean)
    [key: string]: unknown;
  };
};

type VWorldResponse = {
  response?: {
    status?: string;
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

// ---------------------------------------------------------------------------
// Korean building use class → OSM building tag mapping
// ---------------------------------------------------------------------------
const USE_CLASS_MAP: Record<string, string> = {
  업무시설: 'office',
  공동주택: 'apartments',
  단독주택: 'house',
  판매시설: 'retail',
  숙박시설: 'hotel',
  교육연구시설: 'school',
  종교시설: 'church',
  공장: 'industrial',
  창고시설: 'warehouse',
  의료시설: 'hospital',
  운수시설: 'transportation',
  문화집회시설: 'civic',
  운동시설: 'sports_hall',
  관광휴게시설: 'commercial',
  근린생활시설: 'retail',
};

@Injectable()
export class VWorldBuildingAdapter {
  private readonly logger = new Logger(VWorldBuildingAdapter.name);
  private readonly apiKey = process.env.V_WORLD_API_KEY ?? '';
  private readonly baseUrl = 'https://api.vworld.kr/req/data';

  async queryBuildings(scope: SceneScope): Promise<OSMEntityData[]> {
    if (!this.apiKey) {
      this.logger.warn('V_WORLD_API_KEY not set — skipping V World buildings');
      return [];
    }

    const bbox = this.scopeToBbox(scope);
    const params = new URLSearchParams({
      service: 'data',
      version: '2.0',
      request: 'GetFeature',
      key: this.apiKey,
      format: 'json',
      geometry: 'true',
      attribute: 'true',
      crs: 'epsg:4326',
      geomFilter: `BOX(${bbox.minLng},${bbox.minLat},${bbox.maxLng},${bbox.maxLat})`,
      typename: 'lt_c_ubuilding',
      size: '1000',
      page: '1',
    });

    const response = await fetch(`${this.baseUrl}?${params}`, {
      headers: { 'User-Agent': 'wormapb/1.0 (3D city pipeline)' },
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
    this.logger.debug(`V World buildings fetched count=${features.length}`);

    return features
      .filter((f) => f.geometry?.type === 'Polygon' || f.geometry?.type === 'MultiPolygon')
      .flatMap((f) => this.featureToEntities(f, scope.center));
  }

  private featureToEntities(
    feature: VWorldFeature,
    origin: { lat: number; lng: number },
  ): OSMEntityData[] {
    const props = feature.properties;
    const height = this.resolveHeight(props.buld_ht, props.grnd_flr_co);
    const buildingTag = USE_CLASS_MAP[props.buld_se_nm ?? ''] ?? 'yes';

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
            building: buildingTag,
            'building:levels': props.grnd_flr_co ?? '',
            height: String(height),
            name: props.buld_nm ?? '',
          },
          id: `vworld:building:${props.gid ?? feature.id}`,
        };
      })
      .filter((e) => e !== null) as OSMEntityData[];
  }

  private resolveHeight(heightStr?: string, floorsStr?: string): number {
    const h = parseFloat(heightStr ?? '');
    if (Number.isFinite(h) && h > 0) return h;

    const floors = parseInt(floorsStr ?? '', 10);
    if (Number.isFinite(floors) && floors > 0) return floors * 3.5;

    return 8; // default
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
