import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { Reflector } from '@nestjs/core';
import { HideInProductionGuard } from '../src/common/http/hide-in-production.guard';
import { HideInProduction, HIDE_IN_PRODUCTION } from '../src/common/http/hide-in-production.decorator';
import { ERROR_CODES } from '../src/common/constants/error-codes';
import type { ExecutionContext } from '@nestjs/common';

function createMockExecutionContext(
  handlerHasDecorator = false,
  classHasDecorator = false,
): ExecutionContext {
  const handler = handlerHasDecorator ? { [HIDE_IN_PRODUCTION]: true } : {};
  const controller = classHasDecorator ? { [HIDE_IN_PRODUCTION]: true } : {};

  return {
    switchToHttp: () => ({
      getRequest: () => ({}),
    }),
    getHandler: () => handler,
    getClass: () => controller,
  } as unknown as ExecutionContext;
}

describe('HideInProductionGuard - Phase 1 debug route hardening', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    if (originalNodeEnv !== undefined) {
      process.env.NODE_ENV = originalNodeEnv;
    } else {
      delete process.env.NODE_ENV;
    }
  });

  function createGuard(
    handlerHasDecorator: boolean,
    classHasDecorator: boolean,
  ): HideInProductionGuard {
    const reflector = {
      getAllAndOverride: mock((key: string) => {
        if (key === HIDE_IN_PRODUCTION) {
          return handlerHasDecorator || classHasDecorator;
        }
        return undefined;
      }),
    } as unknown as Reflector;

    return new HideInProductionGuard(reflector);
  }

  describe('non-production environments', () => {
    it('allows routes marked with @HideInProduction in development', () => {
      process.env.NODE_ENV = 'development';
      const guard = createGuard(true, false);
      const ctx = createMockExecutionContext(true, false);

      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('allows routes marked with @HideInProduction when NODE_ENV is unset', () => {
      delete process.env.NODE_ENV;
      const guard = createGuard(true, false);
      const ctx = createMockExecutionContext(true, false);

      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('allows routes marked with @HideInProduction in test', () => {
      process.env.NODE_ENV = 'test';
      const guard = createGuard(true, false);
      const ctx = createMockExecutionContext(true, false);

      expect(guard.canActivate(ctx)).toBe(true);
    });
  });

  describe('production environment', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    it('blocks routes marked with @HideInProduction with 404', () => {
      const guard = createGuard(true, false);
      const ctx = createMockExecutionContext(true, false);

      try {
        guard.canActivate(ctx);
        throw new Error('Expected AppException to be thrown');
      } catch (error: unknown) {
        const err = error as { code: string };
        expect(err.code).toBe(ERROR_CODES.RESOURCE_NOT_FOUND);
      }
    });

    it('blocks class-level @HideInProduction routes with 404', () => {
      const guard = createGuard(false, true);
      const ctx = createMockExecutionContext(false, true);

      try {
        guard.canActivate(ctx);
        throw new Error('Expected AppException to be thrown');
      } catch (error: unknown) {
        const err = error as { code: string };
        expect(err.code).toBe(ERROR_CODES.RESOURCE_NOT_FOUND);
      }
    });

    it('allows unmarked routes in production', () => {
      const guard = createGuard(false, false);
      const ctx = createMockExecutionContext(false, false);

      expect(guard.canActivate(ctx)).toBe(true);
    });
  });

  describe('decorator', () => {
    it('HideInProduction is a function that can be applied', () => {
      expect(typeof HideInProduction).toBe('function');
      expect(typeof HideInProduction()).toBe('function');
    });
  });
});
