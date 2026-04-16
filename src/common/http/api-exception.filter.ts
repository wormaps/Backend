import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ERROR_CODES } from '../constants/error-codes';
import { AppException } from '../errors/app.exception';
import {
  ensureRequestContext,
  REQUEST_ID_HEADER,
} from './request-context.util';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const requestContext = ensureRequestContext(request);

    const status = this.resolveStatus(exception);
    const error = this.resolveError(exception, status);

    response.setHeader(REQUEST_ID_HEADER, requestContext.requestId);
    response.status(status).json({
      ok: false,
      status,
      error,
      meta: {
        requestId: requestContext.requestId,
        timestamp: requestContext.timestamp,
      },
    });
  }

  private resolveStatus(exception: unknown): number {
    if (exception instanceof HttpException) {
      return exception.getStatus();
    }

    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private resolveError(
    exception: unknown,
    status: HttpStatus,
  ): { code: string; message: string; detail: unknown } {
    if (exception instanceof AppException) {
      return {
        code: exception.code,
        message: this.extractMessage(exception),
        detail: sanitizeErrorDetail(exception.detail),
      };
    }

    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      if (typeof response === 'object' && response !== null) {
        const serialized = response as Record<string, unknown>;
        return {
          code:
            typeof serialized.code === 'string'
              ? serialized.code
              : ERROR_CODES.INVALID_REQUEST,
          message:
            typeof serialized.message === 'string'
              ? serialized.message
              : exception.message || '요청을 처리할 수 없습니다.',
          detail: sanitizeErrorDetail(serialized.detail ?? null),
        };
      }

      return {
        code: ERROR_CODES.INVALID_REQUEST,
        message:
          typeof response === 'string'
            ? response
            : '요청을 처리할 수 없습니다.',
        detail: null,
      };
    }

    return {
      code: ERROR_CODES.INTERNAL_SERVER_ERROR,
      message:
        status === HttpStatus.INTERNAL_SERVER_ERROR
          ? '서버 내부 오류가 발생했습니다.'
          : '요청을 처리할 수 없습니다.',
      detail: null,
    };
  }

  private extractMessage(exception: AppException): string {
    const response = exception.getResponse();
    if (typeof response === 'object' && response !== null) {
      const serialized = response as Record<string, unknown>;
      if (typeof serialized.message === 'string') {
        return serialized.message;
      }
    }

    return exception.message;
  }
}

function sanitizeErrorDetail(detail: unknown): unknown {
  if (!detail || typeof detail !== 'object') {
    return detail;
  }

  if (Array.isArray(detail)) {
    return detail.map((value) => sanitizeErrorDetail(value));
  }

  const source = detail as Record<string, unknown>;
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(source)) {
    if (key === 'upstreamEnvelope' || key === 'upstreamBody') {
      continue;
    }
    sanitized[key] = sanitizeErrorDetail(value);
  }

  return sanitized;
}
