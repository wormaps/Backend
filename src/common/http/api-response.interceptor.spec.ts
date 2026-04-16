import { describe, expect, it } from '@jest/globals';
import { of, firstValueFrom } from 'rxjs';
import { ApiResponseInterceptor, ResponsePayload } from './api-response.interceptor';

describe('ApiResponseInterceptor', () => {
  it('bypasses wrapping for metrics endpoint', async () => {
    const interceptor = new ApiResponseInterceptor<string>();
    const response = {
      statusCode: 200,
      setHeader: () => undefined,
    };
    const request = {
      originalUrl: '/api/metrics',
      url: '/api/metrics',
      header: () => undefined,
    };
    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    } as never;
    const next = {
      handle: () => of('raw metrics'),
    };

    const result = await firstValueFrom(
      interceptor.intercept(context, next as never),
    );

    expect(result).toBe('raw metrics');
  });

  it('wraps normal responses', async () => {
    const interceptor = new ApiResponseInterceptor<{ service: string }>();
    const response = {
      statusCode: 200,
      setHeader: () => undefined,
    };
    const request = {
      url: '/api/health',
      header: () => undefined,
    };
    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    } as never;
    const next = {
      handle: () =>
        of<ResponsePayload<{ service: string }>>({
          message: 'ok',
          data: { service: 'wormapb' },
        }),
    };

    const result = await firstValueFrom(
      interceptor.intercept(context, next as never),
    );

    expect(result.ok).toBe(true);
    expect(result.data.service).toBe('wormapb');
  });
});

