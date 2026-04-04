export interface MetaPayload {
  requestId: string;
  timestamp: string;
}

export interface SuccessResponse<T> {
  ok: true;
  status: number;
  message: string;
  data: T;
  meta: MetaPayload;
}

export interface ErrorResponse {
  ok: false;
  status: number;
  error: {
    code: string;
    message: string;
    detail: unknown;
  };
  meta: MetaPayload;
}
