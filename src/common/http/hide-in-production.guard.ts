import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppException } from '../errors/app.exception';
import { ERROR_CODES } from '../constants/error-codes';
import { HIDE_IN_PRODUCTION } from './hide-in-production.decorator';

@Injectable()
export class HideInProductionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const shouldHide = this.reflector.getAllAndOverride<boolean>(
      HIDE_IN_PRODUCTION,
      [context.getHandler(), context.getClass()],
    );

    if (!shouldHide) {
      return true;
    }

    const isProduction = process.env.NODE_ENV === 'production';
    if (isProduction) {
      throw new AppException({
        code: ERROR_CODES.RESOURCE_NOT_FOUND,
        message: 'Route not found.',
        status: HttpStatus.NOT_FOUND,
      });
    }

    return true;
  }
}
