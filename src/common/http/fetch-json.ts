import { HttpStatus } from '@nestjs/common';
import { ERROR_CODES } from '../constants/error-codes';
import { AppException } from '../errors/app.exception';

export interface FetchJsonOptions {
  url: string;
  init?: RequestInit;
  provider: string;
  timeoutMs?: number;
}

export type FetchLike = typeof fetch;

export async function fetchJson<T>(
  options: FetchJsonOptions,
  fetcher: FetchLike = fetch,
): Promise<T> {
  let response: Response;

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

  return data as T;
}

function tryParseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
