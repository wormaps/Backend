import { HttpStatus } from '@nestjs/common';
import { ERROR_CODES, ErrorCode } from '../constants/error-codes';
import { AppException } from '../errors/app.exception';

export function parseOptionalEnum<T extends string>(
  value: string | undefined,
  allowedValues: readonly T[],
  errorCode: ErrorCode,
  fieldName: string,
): T | undefined {
  if (value === undefined) {
    return undefined;
  }

  const normalized = value.trim().toUpperCase() as T;
  if (!allowedValues.includes(normalized)) {
    throw new AppException({
      code: errorCode,
      message: `${fieldName} 값이 올바르지 않습니다.`,
      detail: {
        field: fieldName,
        allowedValues,
        received: value,
      },
      status: HttpStatus.BAD_REQUEST,
    });
  }

  return normalized;
}

export function validatePlaceId(placeId: string): string {
  if (!/^[a-z0-9-]+$/.test(placeId)) {
    throw new AppException({
      code: ERROR_CODES.INVALID_PLACE_ID,
      message: 'placeId 형식이 올바르지 않습니다.',
      detail: {
        field: 'placeId',
        received: placeId,
      },
      status: HttpStatus.BAD_REQUEST,
    });
  }

  return placeId;
}
