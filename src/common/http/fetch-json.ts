import { HttpStatus } from '@nestjs/common';
import { ERROR_CODES } from '../constants/error-codes';
import { AppException } from '../errors/app.exception';

export interface FetchJsonOptions {
  url: string;
  init?: RequestInit;
  provider: string;
  timeoutMs?: number;
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
  let response: Response;
  const requestedAt = new Date().toISOString();

  try {
    response = await fetcher(options.url, {
      ...options.init,
      signal: AbortSignal.timeout(options.timeoutMs ?? 10000),
    });
  } catch (error) {
    throw new AppException({
      code: ERROR_CODES.EXTERNAL_API_REQUEST_FAILED,
      message: `${options.provider} 요청에 실패했습니다.`,
      detail: {
        provider: options.provider,
        reason: error instanceof Error ? error.message : 'unknown',
      },
      status: HttpStatus.BAD_GATEWAY,
    });
  }

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
    throw new AppException({
      code: ERROR_CODES.EXTERNAL_API_REQUEST_FAILED,
      message: `${options.provider} 응답이 비정상입니다.`,
      detail: {
        provider: options.provider,
        upstreamStatus: response.status,
        upstreamBody: data ?? text,
      },
      status: HttpStatus.BAD_GATEWAY,
    });
  }

  if (data === null) {
    throw new AppException({
      code: ERROR_CODES.EXTERNAL_API_REQUEST_FAILED,
      message: `${options.provider} 응답을 해석할 수 없습니다.`,
      detail: {
        provider: options.provider,
        upstreamStatus: response.status,
      },
      status: HttpStatus.BAD_GATEWAY,
    });
  }

  return {
    data: data as T,
    envelope,
  };
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
      body,
    },
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
  const sanitized = entries.reduce<Record<string, string>>((acc, [key, value]) => {
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
  }, {});

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
      if (key.toLowerCase().includes('key') || key.toLowerCase().includes('token')) {
        values[key] = '[redacted]';
      }
    }
    return values;
  }
  return '[non-serializable-body]';
}
