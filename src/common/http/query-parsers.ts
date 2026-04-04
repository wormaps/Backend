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

export function validateGooglePlaceId(placeId: string): string {
  if (!/^[A-Za-z0-9_-]+$/.test(placeId)) {
    throw new AppException({
      code: ERROR_CODES.INVALID_PLACE_ID,
      message: 'googlePlaceId 형식이 올바르지 않습니다.',
      detail: {
        field: 'googlePlaceId',
        received: placeId,
      },
      status: HttpStatus.BAD_REQUEST,
    });
  }

  return placeId;
}

export function parseRequiredQuery(value: string | undefined, fieldName: string): string {
  if (!value || value.trim().length === 0) {
    throw new AppException({
      code: ERROR_CODES.INVALID_QUERY,
      message: `${fieldName} 값이 필요합니다.`,
      detail: {
        field: fieldName,
      },
      status: HttpStatus.BAD_REQUEST,
    });
  }

  return value.trim();
}

export function parseOptionalLimit(value: string | undefined, defaultValue = 5): number {
  if (value === undefined) {
    return defaultValue;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 10) {
    throw new AppException({
      code: ERROR_CODES.INVALID_LIMIT,
      message: 'limit 값이 올바르지 않습니다.',
      detail: {
        field: 'limit',
        received: value,
        allowedRange: '1..10',
      },
      status: HttpStatus.BAD_REQUEST,
    });
  }

  return parsed;
}

export function parseOptionalIsoDate(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new AppException({
      code: ERROR_CODES.INVALID_DATE,
      message: 'date 값은 YYYY-MM-DD 형식이어야 합니다.',
      detail: {
        field: 'date',
        received: value,
      },
      status: HttpStatus.BAD_REQUEST,
    });
  }

  return value;
}
