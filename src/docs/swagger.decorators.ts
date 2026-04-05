import { applyDecorators, Type } from '@nestjs/common';
import {
  ApiExtraModels,
  ApiOkResponse,
  ApiResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import { ErrorResponseDto, MetaDto } from './common.dto';

type SingleOrArray = { model: Type<unknown>; isArray?: boolean };

export function ApiSuccessEnvelope(options: SingleOrArray) {
  const dataSchema = options.isArray
    ? {
        type: 'array',
        items: {
          $ref: getSchemaPath(options.model),
        },
      }
    : {
        $ref: getSchemaPath(options.model),
      };

  return applyDecorators(
    ApiExtraModels(options.model, MetaDto),
    ApiOkResponse({
      schema: {
        type: 'object',
        properties: {
          ok: { type: 'boolean', example: true },
          status: { type: 'number', example: 200 },
          message: { type: 'string', example: 'Request successful' },
          data: dataSchema,
          meta: { $ref: getSchemaPath(MetaDto) },
        },
      },
    }),
  );
}

export function ApiErrorEnvelope(
  status: number,
  example: ErrorResponseDto['error'],
) {
  return applyDecorators(
    ApiExtraModels(ErrorResponseDto),
    ApiResponse({
      status,
      schema: {
        type: 'object',
        properties: {
          ok: { type: 'boolean', example: false },
          status: { type: 'number', example: status },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: example.code },
              message: { type: 'string', example: example.message },
              detail: {
                nullable: true,
                example: example.detail,
              },
            },
          },
          meta: { $ref: getSchemaPath(MetaDto) },
        },
      },
    }),
  );
}
