import { HttpStatus, Injectable } from '@nestjs/common';
import { ERROR_CODES } from '../common/constants/error-codes';
import { AppException } from '../common/errors/app.exception';
import { fetchJson } from '../common/http/fetch-json';
import type { FetchLike } from '../common/http/fetch-json';
import { Coordinate } from './place.types';

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

  async getFlowSegment(point: Coordinate): Promise<TomTomFlowSegmentResponse | null> {
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

    return fetchJson<TomTomFlowSegmentResponse>(
      {
        provider: 'TomTom Traffic Flow Segment',
        url:
          'https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json' +
          `?key=${encodeURIComponent(apiKey)}` +
          `&point=${point.lat},${point.lng}`,
      },
      this.fetcher,
    );
  }
}
