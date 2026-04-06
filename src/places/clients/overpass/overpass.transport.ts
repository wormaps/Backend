import { AppException } from '../../../common/errors/app.exception';
import type { FetchLike } from '../../../common/http/fetch-json';
import { fetchJson } from '../../../common/http/fetch-json';
import type { AppLoggerService } from '../../../common/logging/app-logger.service';
import type { GeoBounds } from '../../types/place.types';
import { buildQuery } from './overpass.query';
import type {
  OverpassBatchContext,
  OverpassRequestContext,
  OverpassResponse,
  OverpassScope,
} from './overpass.types';

export async function fetchScopeResponse(
  bounds: GeoBounds,
  scope: OverpassScope,
  context: OverpassBatchContext,
  deps: {
    appLoggerService: AppLoggerService;
    fetcher: FetchLike;
    maxEndpointAttempts: number;
    fallbackBoundScales: number[];
    defaultEndpoints: string[];
  },
): Promise<OverpassResponse> {
  let lastError: unknown;

  for (const scale of deps.fallbackBoundScales) {
    const scopedBounds = scale === 1 ? bounds : scaleBounds(bounds, scale);
    const query = buildQuery(scopedBounds, scope);
    try {
      deps.appLoggerService.info('overpass.batch.started', {
        requestId: context.requestId,
        sceneId: context.sceneId,
        provider: 'overpass',
        step: 'overpass_batch',
        batch: context.batch,
        scope,
        boundScale: scale,
      });
      const response = await fetchOverpassResponse(
        query,
        {
          ...context,
          scope,
          boundScale: scale,
        },
        deps,
      );
      deps.appLoggerService.info('overpass.batch.completed', {
        requestId: context.requestId,
        sceneId: context.sceneId,
        provider: 'overpass',
        step: 'overpass_batch',
        batch: context.batch,
        scope,
        boundScale: scale,
        elementCount: response.elements?.length ?? 0,
      });
      return response;
    } catch (error) {
      lastError = error;
      deps.appLoggerService.warn('overpass.batch.retry_with_smaller_bounds', {
        requestId: context.requestId,
        sceneId: context.sceneId,
        provider: 'overpass',
        step: 'overpass_batch',
        batch: context.batch,
        scope,
        boundScale: scale,
        error,
      });
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Overpass batch failed');
}

function resolveEndpoints(defaultEndpoints: string[]): string[] {
  const configured = process.env.OVERPASS_API_URLS?.split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  return configured && configured.length > 0 ? configured : defaultEndpoints;
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

async function fetchOverpassResponse(
  query: string,
  context: OverpassRequestContext,
  deps: {
    appLoggerService: AppLoggerService;
    fetcher: FetchLike;
    maxEndpointAttempts: number;
    defaultEndpoints: string[];
  },
): Promise<OverpassResponse> {
  const endpoints = resolveEndpoints(deps.defaultEndpoints);
  let lastError: unknown;

  for (const url of endpoints) {
    for (let attempt = 1; attempt <= deps.maxEndpointAttempts; attempt += 1) {
      try {
        deps.appLoggerService.info('overpass.request.started', {
          requestId: context.requestId,
          sceneId: context.sceneId,
          provider: 'overpass',
          step: 'overpass_request',
          batch: context.batch,
          scope: context.scope,
          boundScale: context.boundScale,
          url,
          attempt,
        });
        return await fetchJson<OverpassResponse>(
          {
            provider: 'Overpass API',
            url,
            init: {
              method: 'POST',
              headers: {
                'Content-Type':
                  'application/x-www-form-urlencoded;charset=UTF-8',
              },
              body: `data=${encodeURIComponent(query)}`,
            },
            timeoutMs: 40000,
          },
          deps.fetcher,
        );
      } catch (error) {
        lastError = error;
        deps.appLoggerService.warn('overpass.request.failed', {
          requestId: context.requestId,
          sceneId: context.sceneId,
          provider: 'overpass',
          step: 'overpass_request',
          batch: context.batch,
          scope: context.scope,
          boundScale: context.boundScale,
          url,
          attempt,
          error,
        });
        if (attempt < deps.maxEndpointAttempts) {
          await sleep(250 * attempt);
        }
      }
    }
  }

  if (lastError instanceof AppException) {
    throw lastError;
  }

  throw new Error('Overpass API 응답을 가져오지 못했습니다.');
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
