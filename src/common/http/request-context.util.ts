import { randomUUID } from 'crypto';
import { Request } from 'express';
import { RequestContext } from './request-context';

export const REQUEST_ID_HEADER = 'x-request-id';

export function ensureRequestContext(request: Request): RequestContext {
  const requestWithContext = request as Request & { requestContext?: RequestContext };
  const cached = requestWithContext.requestContext;
  if (cached) {
    return cached;
  }

  const headerRequestId = request.header(REQUEST_ID_HEADER);
  const context: RequestContext = {
    requestId: headerRequestId && headerRequestId.trim().length > 0 ? headerRequestId : `req_${randomUUID()}`,
    timestamp: new Date().toISOString(),
  };

  requestWithContext.requestContext = context;
  return context;
}
