import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ERROR_CODES } from '../constants/error-codes';
import { AppException } from '../errors/app.exception';
import { IS_PUBLIC_ROUTE } from './public.decorator';

@Injectable()
export class GlobalApiKeyGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(
      IS_PUBLIC_ROUTE,
      [context.getHandler(), context.getClass()],
    );
    if (isPublic) {
      return true;
    }

    const requiredApiKey = process.env.INTERNAL_API_KEY?.trim();
    if (!requiredApiKey) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const providedApiKey = this.resolveApiKey(request);
    if (!providedApiKey || providedApiKey !== requiredApiKey) {
      throw new AppException({
        code: ERROR_CODES.INVALID_TOKEN,
        message: 'API key가 유효하지 않습니다.',
        detail: {
          header: 'x-api-key',
        },
        status: HttpStatus.UNAUTHORIZED,
      });
    }

    return true;
  }

  private resolveApiKey(request: Request): string | null {
    const direct = request.header('x-api-key')?.trim();
    if (direct && direct.length > 0) {
      return direct;
    }

    const auth = request.header('authorization')?.trim();
    if (!auth) {
      return null;
    }

    const bearerPrefix = 'bearer ';
    if (auth.toLowerCase().startsWith(bearerPrefix)) {
      const token = auth.slice(bearerPrefix.length).trim();
      return token.length > 0 ? token : null;
    }

    return null;
  }
}
