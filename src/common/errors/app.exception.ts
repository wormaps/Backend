import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode } from '../constants/error-codes';

export interface AppExceptionOptions {
  code: ErrorCode;
  message: string;
  detail?: unknown;
  status?: HttpStatus;
}

export class AppException extends HttpException {
  public readonly code: ErrorCode;
  public readonly detail: unknown;

  constructor(options: AppExceptionOptions) {
    super(
      {
        code: options.code,
        message: options.message,
        detail: options.detail ?? null,
      },
      options.status ?? HttpStatus.BAD_REQUEST,
    );

    this.code = options.code;
    this.detail = options.detail ?? null;
  }
}
