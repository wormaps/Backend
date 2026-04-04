import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { map, Observable } from 'rxjs';
import {
  ensureRequestContext,
  REQUEST_ID_HEADER,
} from './request-context.util';

interface SuccessEnvelope<T> {
  ok: true;
  status: number;
  message: string;
  data: T;
  meta: {
    requestId: string;
    timestamp: string;
  };
}

export interface ResponsePayload<T> {
  message: string;
  data: T;
}

@Injectable()
export class ApiResponseInterceptor<T> implements NestInterceptor<
  ResponsePayload<T>,
  SuccessEnvelope<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler<ResponsePayload<T>>,
  ): Observable<SuccessEnvelope<T>> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const requestContext = ensureRequestContext(request);

    response.setHeader(REQUEST_ID_HEADER, requestContext.requestId);

    return next.handle().pipe(
      map((payload) => ({
        ok: true,
        status: response.statusCode,
        message: payload.message,
        data: payload.data,
        meta: {
          requestId: requestContext.requestId,
          timestamp: requestContext.timestamp,
        },
      })),
    );
  }
}
