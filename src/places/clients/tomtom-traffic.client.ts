import { HttpStatus, Injectable } from '@nestjs/common';
import { ERROR_CODES } from '../../common/constants/error-codes';
import { AppException } from '../../common/errors/app.exception';
import { fetchJson, fetchJsonWithEnvelope } from '../../common/http/fetch-json';
import type { FetchLike } from '../../common/http/fetch-json';
import type { FetchJsonEnvelope } from '../../common/http/fetch-json';
import { Coordinate } from '../types/place.types';

interface TomTomFlowSegmentResponse {
  flowSegmentData?: {
    currentSpeed?: number;
    freeFlowSpeed?: number;
    currentTravelTime?: number;
    freeFlowTravelTime?: number;
    confidence?: number;
    roadClosure?: boolean;
  };
}

@Injectable()
export class TomTomTrafficClient {
  private fetcher: FetchLike = fetch;

  withFetcher(fetcher: FetchLike): this {
    this.fetcher = fetcher;
    return this;
  }

  async getFlowSegment(
    point: Coordinate,
    requestId?: string | null,
  ): Promise<TomTomFlowSegmentResponse | null> {
    const apiKey = process.env.TOMTOM_API_KEY;
    if (!apiKey) {
      throw new AppException({
        code: ERROR_CODES.EXTERNAL_API_NOT_CONFIGURED,
        message: 'TOMTOM_API_KEY 환경 변수가 설정되지 않았습니다.',
        detail: {
          env: 'TOMTOM_API_KEY',
        },
        status: HttpStatus.INTERNAL_SERVER_ERROR,
      });
    }

    let lastError: unknown;
    for (const host of this.resolveHosts(point)) {
      try {
        const apiKeyHeader = {
          'X-TomTom-Api-Key': apiKey,
        };
        return await fetchJson<TomTomFlowSegmentResponse>(
          {
            provider: 'TomTom Traffic Flow Segment',
            url:
              `https://${host}/traffic/services/4/flowSegmentData/absolute/14/json` +
              `?point=${point.lat},${point.lng}`,
            init: {
              headers: apiKeyHeader,
            },
            requestId,
          },
          this.fetcher,
        );
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError;
  }

  async getFlowSegmentWithEnvelope(
    point: Coordinate,
    requestId?: string | null,
  ): Promise<{
    data: TomTomFlowSegmentResponse | null;
    upstreamEnvelopes: FetchJsonEnvelope[];
  }> {
    const apiKey = process.env.TOMTOM_API_KEY;
    if (!apiKey) {
      throw new AppException({
        code: ERROR_CODES.EXTERNAL_API_NOT_CONFIGURED,
        message: 'TOMTOM_API_KEY 환경 변수가 설정되지 않았습니다.',
        detail: {
          env: 'TOMTOM_API_KEY',
        },
        status: HttpStatus.INTERNAL_SERVER_ERROR,
      });
    }

    const envelopes: FetchJsonEnvelope[] = [];
    let lastError: unknown;
    for (const host of this.resolveHosts(point)) {
      try {
        const apiKeyHeader = {
          'X-TomTom-Api-Key': apiKey,
        };
        const response = await fetchJsonWithEnvelope<TomTomFlowSegmentResponse>(
          {
            provider: 'TomTom Traffic Flow Segment',
            url:
              `https://${host}/traffic/services/4/flowSegmentData/absolute/14/json` +
              `?point=${point.lat},${point.lng}`,
            init: {
              headers: apiKeyHeader,
            },
            requestId,
          },
          this.fetcher,
        );
        envelopes.push(response.envelope);
        return {
          data: response.data,
          upstreamEnvelopes: envelopes,
        };
      } catch (error) {
        if (
          typeof error === 'object' &&
          error !== null &&
          'response' in error &&
          typeof (error as { response?: unknown }).response === 'object' &&
          (error as { response?: unknown }).response !== null &&
          'detail' in
            ((error as { response: Record<string, unknown> })
              .response as Record<string, unknown>)
        ) {
          const detail = (
            (error as { response: Record<string, unknown> }).response as Record<
              string,
              unknown
            >
          ).detail;
          if (
            typeof detail === 'object' &&
            detail !== null &&
            'upstreamEnvelope' in (detail as Record<string, unknown>)
          ) {
            const envelope = (detail as Record<string, unknown>)
              .upstreamEnvelope as FetchJsonEnvelope;
            envelopes.push(envelope);
          }
        }
        lastError = error;
      }
    }

    throw lastError;
  }

  private resolveBaseHost(point: Coordinate): string {
    if (this.isKoreaCoordinate(point)) {
      return 'kr-api.tomtom.com';
    }

    return 'api.tomtom.com';
  }

  private resolveHosts(point: Coordinate): string[] {
    const primary = this.resolveBaseHost(point);
    const secondary =
      primary === 'kr-api.tomtom.com' ? 'api.tomtom.com' : 'kr-api.tomtom.com';
    return [primary, secondary];
  }

  private isKoreaCoordinate(point: Coordinate): boolean {
    return (
      point.lat >= 33 && point.lat <= 39 && point.lng >= 124 && point.lng <= 132
    );
  }
}
