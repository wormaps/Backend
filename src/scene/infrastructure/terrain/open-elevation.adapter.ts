import type { Coordinate } from '../../../places/types/place.types';
import type { TerrainSample } from '../../types/scene.types';
import type { IDemPort } from './dem.port';
import { AppLoggerService } from '../../../common/logging/app-logger.service';

const DEFAULT_OPEN_ELEVATION_URL = 'https://api.open-elevation.com/api/v1/lookup';

export class OpenElevationAdapter implements IDemPort {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(
    private readonly appLoggerService: AppLoggerService,
    options?: { baseUrl?: string; timeoutMs?: number },
  ) {
    this.baseUrl =
      options?.baseUrl?.trim() ||
      process.env.OPEN_ELEVATION_URL?.trim() ||
      DEFAULT_OPEN_ELEVATION_URL;
    this.timeoutMs = options?.timeoutMs ?? 10_000;
  }

  async fetchElevations(points: Coordinate[]): Promise<TerrainSample[]> {
    if (points.length === 0) return [];

    const locations = points.map((p) => ({
      latitude: p.lat,
      longitude: p.lng,
    }));

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locations }),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!response.ok) {
        return [];
      }

      const data = (await response.json()) as OpenElevationResponse;
      if (!data?.results || !Array.isArray(data.results)) {
        return [];
      }

      const samples: TerrainSample[] = [];
      for (let i = 0; i < data.results.length; i++) {
        const result = data.results[i];
        const point = points[i];
        if (!point || !Number.isFinite(result.elevation)) {
          continue;
        }
        samples.push({
          location: { lat: point.lat, lng: point.lng },
          heightMeters: Number(result.elevation),
          source: 'OPEN_ELEVATION',
        });
      }
      return samples;
    } catch (error) {
      this.appLoggerService.error('terrain.open-elevation.fetch-failed', {
        url: this.baseUrl,
        pointCount: points.length,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }
}

interface OpenElevationResponse {
  results?: Array<{
    latitude?: number;
    longitude?: number;
    elevation?: number;
  }>;
}
