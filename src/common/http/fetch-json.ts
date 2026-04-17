import { HttpStatus } from '@nestjs/common';
import { ERROR_CODES } from '../constants/error-codes';
import { AppException } from '../errors/app.exception';
import { appMetrics } from '../metrics/metrics.instance';

export interface FetchJsonOptions {
  url: string;
  init?: RequestInit;
  provider: string;
  timeoutMs?: number;
  requestId?: string | null;
  retryCount?: number;
}

export interface FetchJsonEnvelope {
  provider: string;
  requestedAt: string;
  receivedAt: string;
  url: string;
  method: string;
  request: {
    headers?: Record<string, string>;
    body?: unknown;
  };
  response: {
    status: number;
    body: unknown;
  };
  error?: {
    reason: string;
  };
}

export type FetchLike = typeof fetch;

export async function fetchJson<T>(
  options: FetchJsonOptions,
  fetcher: FetchLike = fetch,
): Promise<T> {
  const result = await fetchJsonWithEnvelope<T>(options, fetcher);
  return result.data;
}

export async function fetchJsonWithEnvelope<T>(
  options: FetchJsonOptions,
  fetcher: FetchLike = fetch,
): Promise<{ data: T; envelope: FetchJsonEnvelope }> {
  const requestedAt = new Date().toISOString();
  const startedAt = Date.now();
  const maxRetries = Math.max(0, options.retryCount ?? 2);
  let lastResponse: Response | null = null;
  let attempt = 0;

  while (true) {
    attempt += 1;
    try {
      const headers = new Headers(options.init?.headers);
      if (options.requestId) {
        headers.set('x-request-id', options.requestId);
      }
      lastResponse = await fetcher(options.url, {
        ...options.init,
        headers,
        signal: AbortSignal.timeout(options.timeoutMs ?? 10000),
      });
    } catch (error) {
      const envelope = buildEnvelope(
        options,
        requestedAt,
        new Date().toISOString(),
        0,
        null,
        error instanceof Error ? error.message : 'unknown',
      );
      recordExternalApiMetrics(
        options.provider,
        'failure',
        Date.now() - startedAt,
      );
      throw new AppException({
        code: ERROR_CODES.EXTERNAL_API_REQUEST_FAILED,
        message: `${options.provider} 요청에 실패했습니다.`,
        detail: {
          provider: options.provider,
          reason: error instanceof Error ? error.message : 'unknown',
          upstreamEnvelope: envelope,
        },
        status: HttpStatus.BAD_GATEWAY,
      });
    }

    if (lastResponse.status !== 429 || attempt > maxRetries) {
      break;
    }

    const retryAfterMs = resolveRetryAfterMs(lastResponse.headers.get('retry-after'));
    await sleep(Math.max(0, retryAfterMs ?? 0) || 2 ** (attempt - 1) * 250);
  }

  const response = lastResponse as Response;

  const text = await response.text();
  const data = text.length > 0 ? tryParseJson(text) : null;
  const envelope = buildEnvelope(
    options,
    requestedAt,
    new Date().toISOString(),
    response.status,
    data ?? text,
  );

  if (!response.ok) {
    recordExternalApiMetrics(
      options.provider,
      'failure',
      Date.now() - startedAt,
      response.status,
    );
    throw new AppException({
      code: ERROR_CODES.EXTERNAL_API_REQUEST_FAILED,
      message: `${options.provider} 응답이 비정상입니다.`,
      detail: {
        provider: options.provider,
        upstreamStatus: response.status,
        upstreamEnvelope: envelope,
      },
      status: HttpStatus.BAD_GATEWAY,
    });
  }

  if (data === null) {
    recordExternalApiMetrics(
      options.provider,
      'failure',
      Date.now() - startedAt,
      response.status,
    );
    throw new AppException({
      code: ERROR_CODES.EXTERNAL_API_REQUEST_FAILED,
      message: `${options.provider} 응답을 해석할 수 없습니다.`,
      detail: {
        provider: options.provider,
        upstreamStatus: response.status,
        upstreamEnvelope: envelope,
      },
      status: HttpStatus.BAD_GATEWAY,
    });
  }

  recordExternalApiMetrics(
    options.provider,
    'success',
    Date.now() - startedAt,
    response.status,
  );
  return {
    data: data as T,
    envelope,
  };
}

function resolveRetryAfterMs(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const seconds = Number(value);
  if (Number.isFinite(seconds)) {
    return seconds * 1000;
  }

  const dateMs = Date.parse(value);
  if (Number.isFinite(dateMs)) {
    return Math.max(0, dateMs - Date.now());
  }

  return null;
}

function recordExternalApiMetrics(
  provider: string,
  outcome: 'success' | 'failure',
  durationMs: number,
  status?: number,
): void {
  const statusClass = status ? `${Math.floor(status / 100)}xx` : 'error';
  appMetrics.incrementCounter(
    'external_api_requests_total',
    1,
    { provider, outcome, statusClass },
    'External API request count by provider, outcome, and status class.',
  );
  appMetrics.observeDuration(
    'external_api_request_duration_ms',
    durationMs,
    { provider, outcome },
    'External API request duration in milliseconds.',
  );
}

function tryParseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function buildEnvelope(
  options: FetchJsonOptions,
  requestedAt: string,
  receivedAt: string,
  status: number,
  body: unknown,
  errorReason?: string,
): FetchJsonEnvelope {
  return {
    provider: options.provider,
    requestedAt,
    receivedAt,
    url: sanitizeUrl(options.url),
    method: options.init?.method ?? 'GET',
    request: {
      headers: sanitizeHeaders(options.init?.headers),
      body: sanitizeBody(options.init?.body),
    },
    response: {
      status,
      body: status >= 200 && status < 300 ? body : null,
    },
    error: errorReason
      ? {
          reason: errorReason,
        }
      : undefined,
  };
}

function sanitizeUrl(value: string): string {
  try {
    const url = new URL(value);
    ['access_token', 'key'].forEach((param) => {
      if (url.searchParams.has(param)) {
        url.searchParams.set(param, '[redacted]');
      }
    });
    return url.toString();
  } catch {
    return value.replace(/(access_token|key)=([^&]+)/g, '$1=[redacted]');
  }
}

function sanitizeHeaders(
  headers: HeadersInit | undefined,
): Record<string, string> | undefined {
  if (!headers) {
    return undefined;
  }

  const entries = Array.isArray(headers)
    ? headers
    : headers instanceof Headers
      ? [...headers.entries()]
      : Object.entries(headers);
  const sanitized = entries.reduce<Record<string, string>>(
    (acc, [key, value]) => {
      const lower = key.toLowerCase();
      if (
        lower.includes('authorization') ||
        lower.includes('api-key') ||
        lower.includes('x-goog-api-key')
      ) {
        acc[key] = '[redacted]';
      } else {
        acc[key] = String(value);
      }
      return acc;
    },
    {},
  );

  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

function sanitizeBody(body: BodyInit | null | undefined): unknown {
  if (body === undefined || body === null) {
    return undefined;
  }
  if (typeof body === 'string') {
    const parsed = tryParseJson(body);
    return parsed ?? body;
  }
  if (body instanceof URLSearchParams) {
    const values = Object.fromEntries(body.entries());
    for (const key of Object.keys(values)) {
      if (
        key.toLowerCase().includes('key') ||
        key.toLowerCase().includes('token')
      ) {
        values[key] = '[redacted]';
      }
    }
    return values;
  }
  return '[non-serializable-body]';
}

function sleep(ms: number): Promise<void> {
  if (ms <= 0) {
    return Promise.resolve();
  }
  return new Promise((resolve) => setTimeout(resolve, ms));
}
