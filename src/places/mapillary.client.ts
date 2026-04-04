import { Injectable } from '@nestjs/common';
import { fetchJson } from '../common/http/fetch-json';
import type { FetchLike } from '../common/http/fetch-json';
import { Coordinate, GeoBounds } from './place.types';

interface MapillaryListResponse<T> {
  data?: T[];
}

interface MapillaryGeometry {
  coordinates?: [number, number];
}

interface MapillarySequenceRef {
  id?: string;
}

interface MapillaryImageRaw {
  id?: string;
  captured_at?: string;
  compass_angle?: number;
  computed_geometry?: MapillaryGeometry;
  thumb_1024_url?: string;
  sequence?: MapillarySequenceRef;
}

interface MapillaryFeatureRaw {
  id?: string;
  value?: string;
  object_value?: string;
  geometry?: MapillaryGeometry;
}

export interface MapillaryImage {
  id: string;
  capturedAt: string | null;
  compassAngle: number | null;
  location: Coordinate;
  sequenceId: string | null;
  thumbnailUrl: string | null;
}

export interface MapillaryFeature {
  id: string;
  type: string;
  location: Coordinate;
}

@Injectable()
export class MapillaryClient {
  private fetcher: FetchLike = fetch;
  private readonly baseUrl = 'https://graph.mapillary.com';

  withFetcher(fetcher: FetchLike): this {
    this.fetcher = fetcher;
    return this;
  }

  isConfigured(): boolean {
    return Boolean(process.env.MAPILLARY_ACCESS_TOKEN?.trim());
  }

  getAuthorizationUrl(): string | null {
    return (
      process.env.MAPILLARY_AUTHORIZATION_URL?.trim() ??
      process.env.MAPILLARY_AUYHORIZATION_URL?.trim() ??
      null
    );
  }

  async getNearbyImages(
    bounds: GeoBounds,
    limit = 60,
  ): Promise<MapillaryImage[]> {
    if (!this.isConfigured()) {
      return [];
    }

    const bbox = this.buildBbox(bounds);
    const token = process.env.MAPILLARY_ACCESS_TOKEN?.trim();
    const response = await fetchJson<MapillaryListResponse<MapillaryImageRaw>>(
      {
        provider: 'Mapillary Images API',
        url: `${this.baseUrl}/images?access_token=${encodeURIComponent(token ?? '')}&bbox=${bbox}&fields=id,captured_at,compass_angle,computed_geometry,sequence,thumb_1024_url&limit=${limit}`,
        timeoutMs: 15000,
      },
      this.fetcher,
    );

    return (response.data ?? [])
      .map((item) => this.mapImage(item))
      .filter((value) => value !== null);
  }

  async getMapFeatures(
    bounds: GeoBounds,
    limit = 100,
  ): Promise<MapillaryFeature[]> {
    if (!this.isConfigured()) {
      return [];
    }

    const bbox = this.buildBbox(bounds);
    const token = process.env.MAPILLARY_ACCESS_TOKEN?.trim();
    const response = await fetchJson<MapillaryListResponse<MapillaryFeatureRaw>>(
      {
        provider: 'Mapillary Features API',
        url: `${this.baseUrl}/map_features?access_token=${encodeURIComponent(token ?? '')}&bbox=${bbox}&fields=id,value,object_value,geometry&limit=${limit}`,
        timeoutMs: 15000,
      },
      this.fetcher,
    );

    return (response.data ?? [])
      .map((item) => this.mapFeature(item))
      .filter((value) => value !== null);
  }

  private buildBbox(bounds: GeoBounds): string {
    return [
      bounds.southWest.lng,
      bounds.southWest.lat,
      bounds.northEast.lng,
      bounds.northEast.lat,
    ].join(',');
  }

  private mapImage(input: MapillaryImageRaw): MapillaryImage | null {
    const coordinates = input.computed_geometry?.coordinates;
    const lng = coordinates?.[0];
    const lat = coordinates?.[1];
    if (!input.id || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      return null;
    }

    return {
      id: input.id,
      capturedAt: input.captured_at ?? null,
      compassAngle:
        Number.isFinite(input.compass_angle) ? input.compass_angle ?? null : null,
      location: {
        lat: Number(lat),
        lng: Number(lng),
      },
      sequenceId: input.sequence?.id ?? null,
      thumbnailUrl: input.thumb_1024_url ?? null,
    };
  }

  private mapFeature(input: MapillaryFeatureRaw): MapillaryFeature | null {
    const coordinates = input.geometry?.coordinates;
    const lng = coordinates?.[0];
    const lat = coordinates?.[1];
    if (!input.id || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      return null;
    }

    return {
      id: input.id,
      type: input.value ?? input.object_value ?? 'unknown',
      location: {
        lat: Number(lat),
        lng: Number(lng),
      },
    };
  }
}
