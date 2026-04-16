import { Injectable } from '@nestjs/common';
import { fetchJsonWithEnvelope } from '../../common/http/fetch-json';
import type {
  FetchJsonEnvelope,
  FetchLike,
} from '../../common/http/fetch-json';
import { Coordinate, GeoBounds } from '../types/place.types';

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
  images?: Array<{ id?: string } | string>;
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
  imageIds: string[];
}

export interface MapillaryImageFetchAttempt {
  mode: 'bbox' | 'feature_radius';
  label: string;
  resultCount: number;
}

export interface MapillaryImageFetchDiagnostics {
  strategy: 'bbox' | 'bbox_expanded' | 'feature_radius' | 'none';
  attempts: MapillaryImageFetchAttempt[];
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
    return process.env.MAPILLARY_AUTHORIZATION_URL?.trim() ?? null;
  }

  async getNearbyImages(
    bounds: GeoBounds,
    limit = 60,
  ): Promise<MapillaryImage[]> {
    const result = await this.getNearbyImagesWithDiagnostics(bounds, {
      limit,
      featureAnchors: [],
    });
    return result.images;
  }

  async getNearbyImagesWithDiagnostics(
    bounds: GeoBounds,
    input?: {
      limit?: number;
      featureAnchors?: Coordinate[];
    },
  ): Promise<{
    images: MapillaryImage[];
    diagnostics: MapillaryImageFetchDiagnostics;
    upstreamEnvelopes: FetchJsonEnvelope[];
  }> {
    if (!this.isConfigured()) {
      return {
        images: [],
        diagnostics: {
          strategy: 'none',
          attempts: [],
        },
        upstreamEnvelopes: [],
      };
    }

    const limit = Math.max(1, Math.min(2000, input?.limit ?? 60));
    const diagnostics: MapillaryImageFetchDiagnostics = {
      strategy: 'none',
      attempts: [],
    };
    const upstreamEnvelopes: FetchJsonEnvelope[] = [];
    const bboxCandidates = this.buildBboxCandidates(bounds);

    for (let index = 0; index < bboxCandidates.length; index += 1) {
      const candidate = bboxCandidates[index];
      const bboxResult = await this.fetchImagesByBbox(candidate, limit);
      const images = bboxResult.images;
      upstreamEnvelopes.push(...bboxResult.upstreamEnvelopes);
      diagnostics.attempts.push({
        mode: 'bbox',
        label: `${candidate.southWest.lng.toFixed(6)},${candidate.southWest.lat.toFixed(6)},${candidate.northEast.lng.toFixed(6)},${candidate.northEast.lat.toFixed(6)}`,
        resultCount: images.length,
      });
      if (images.length > 0) {
        diagnostics.strategy = index === 0 ? 'bbox' : 'bbox_expanded';
        return { images, diagnostics, upstreamEnvelopes };
      }
    }

    const anchors = dedupeAnchors(input?.featureAnchors ?? []).slice(0, 12);
    const collected: MapillaryImage[] = [];
    for (const anchor of anchors) {
      const nearbyResult = await this.fetchImagesByPoint(
        anchor,
        Math.min(limit, 160),
      );
      const nearby = nearbyResult.images;
      upstreamEnvelopes.push(...nearbyResult.upstreamEnvelopes);
      diagnostics.attempts.push({
        mode: 'feature_radius',
        label: `${anchor.lat.toFixed(6)},${anchor.lng.toFixed(6)},25m`,
        resultCount: nearby.length,
      });
      for (const image of nearby) {
        if (!collected.some((current) => current.id === image.id)) {
          collected.push(image);
        }
        if (collected.length >= limit) {
          break;
        }
      }
      if (collected.length >= limit) {
        break;
      }
    }

    diagnostics.strategy = collected.length > 0 ? 'feature_radius' : 'none';
    return {
      images: collected,
      diagnostics,
      upstreamEnvelopes,
    };
  }

  async getMapFeatures(
    bounds: GeoBounds,
    limit = 100,
  ): Promise<MapillaryFeature[]> {
    const result = await this.getMapFeaturesWithEnvelope(bounds, limit);
    return result.features;
  }

  async getMapFeaturesWithEnvelope(
    bounds: GeoBounds,
    limit = 100,
  ): Promise<{
    features: MapillaryFeature[];
    upstreamEnvelopes: FetchJsonEnvelope[];
  }> {
    if (!this.isConfigured()) {
      return {
        features: [],
        upstreamEnvelopes: [],
      };
    }

    const bbox = this.buildBbox(bounds);
    const token = process.env.MAPILLARY_ACCESS_TOKEN?.trim();
    const response = await fetchJsonWithEnvelope<
      MapillaryListResponse<MapillaryFeatureRaw>
    >(
      {
        provider: 'Mapillary Features API',
        url: `${this.baseUrl}/map_features?access_token=${encodeURIComponent(token ?? '')}&bbox=${bbox}&fields=id,value,object_value,geometry,images&limit=${Math.max(1, Math.min(2000, limit))}`,
        timeoutMs: 15000,
      },
      this.fetcher,
    );

    return {
      features: (response.data.data ?? [])
        .map((item) => this.mapFeature(item))
        .filter((value): value is MapillaryFeature => value !== null),
      upstreamEnvelopes: [response.envelope],
    };
  }

  private buildBbox(bounds: GeoBounds): string {
    return [
      bounds.southWest.lng,
      bounds.southWest.lat,
      bounds.northEast.lng,
      bounds.northEast.lat,
    ].join(',');
  }

  private buildBboxCandidates(bounds: GeoBounds): GeoBounds[] {
    const scales = [1, 1.35, 1.8];
    const maxArea = 0.01;
    const candidates: GeoBounds[] = [];
    for (const scale of scales) {
      const candidate = scale === 1 ? bounds : scaleBounds(bounds, scale);
      if (bboxArea(candidate) <= maxArea) {
        candidates.push(candidate);
      }
    }
    return candidates.length > 0 ? candidates : [bounds];
  }

  private async fetchImagesByBbox(
    bounds: GeoBounds,
    limit: number,
  ): Promise<{
    images: MapillaryImage[];
    upstreamEnvelopes: FetchJsonEnvelope[];
  }> {
    const bbox = this.buildBbox(bounds);
    const token = process.env.MAPILLARY_ACCESS_TOKEN?.trim();
    const response = await fetchJsonWithEnvelope<
      MapillaryListResponse<MapillaryImageRaw>
    >(
      {
        provider: 'Mapillary Images API',
        url: `${this.baseUrl}/images?access_token=${encodeURIComponent(token ?? '')}&bbox=${bbox}&fields=id,captured_at,compass_angle,computed_geometry,sequence,thumb_1024_url&limit=${Math.max(1, Math.min(2000, limit))}`,
        timeoutMs: 15000,
      },
      this.fetcher,
    );

    return {
      images: (response.data.data ?? [])
        .map((item) => this.mapImage(item))
        .filter((value): value is MapillaryImage => value !== null),
      upstreamEnvelopes: [response.envelope],
    };
  }

  private async fetchImagesByPoint(
    anchor: Coordinate,
    limit: number,
  ): Promise<{
    images: MapillaryImage[];
    upstreamEnvelopes: FetchJsonEnvelope[];
  }> {
    const token = process.env.MAPILLARY_ACCESS_TOKEN?.trim();
    const response = await fetchJsonWithEnvelope<
      MapillaryListResponse<MapillaryImageRaw>
    >(
      {
        provider: 'Mapillary Images API',
        url: `${this.baseUrl}/images?access_token=${encodeURIComponent(token ?? '')}&lat=${anchor.lat}&lng=${anchor.lng}&radius=25&fields=id,captured_at,compass_angle,computed_geometry,sequence,thumb_1024_url&limit=${Math.max(1, Math.min(2000, limit))}`,
        timeoutMs: 15000,
      },
      this.fetcher,
    );

    return {
      images: (response.data.data ?? [])
        .map((item) => this.mapImage(item))
        .filter((value): value is MapillaryImage => value !== null),
      upstreamEnvelopes: [response.envelope],
    };
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
      compassAngle: Number.isFinite(input.compass_angle)
        ? (input.compass_angle ?? null)
        : null,
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
      imageIds: extractImageIds(input),
    };
  }
}

function dedupeAnchors(values: Coordinate[]): Coordinate[] {
  const seen = new Set<string>();
  const result: Coordinate[] = [];
  for (const value of values) {
    const key = `${value.lat.toFixed(6)}:${value.lng.toFixed(6)}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(value);
  }
  return result;
}

function bboxArea(bounds: GeoBounds): number {
  return Math.abs(
    (bounds.northEast.lat - bounds.southWest.lat) *
      (bounds.northEast.lng - bounds.southWest.lng),
  );
}

function scaleBounds(bounds: GeoBounds, ratio: number): GeoBounds {
  const centerLat = (bounds.northEast.lat + bounds.southWest.lat) / 2;
  const centerLng = (bounds.northEast.lng + bounds.southWest.lng) / 2;
  const latHalfSpan =
    ((bounds.northEast.lat - bounds.southWest.lat) / 2) * ratio;
  const lngHalfSpan =
    ((bounds.northEast.lng - bounds.southWest.lng) / 2) * ratio;

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

function extractImageIds(input: MapillaryFeatureRaw): string[] {
  const raw = (input as MapillaryFeatureRaw & { images?: unknown }).images;
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .map((value) => {
      if (typeof value === 'string') {
        return value;
      }
      if (
        typeof value === 'object' &&
        value !== null &&
        'id' in value &&
        typeof (value as { id?: unknown }).id === 'string'
      ) {
        return (value as { id: string }).id;
      }
      return null;
    })
    .filter((value): value is string => Boolean(value));
}
