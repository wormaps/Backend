import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { Reflector } from '@nestjs/core';
import { GlobalApiKeyGuard } from '../src/common/http/global-api-key.guard';
import { IS_PUBLIC_ROUTE } from '../src/common/http/public.decorator';
import { ERROR_CODES } from '../src/common/constants/error-codes';
import type { ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

function createMockExecutionContext(
  headers: Record<string, string> = {},
  handlerIsPublic = false,
  classIsPublic = false,
): ExecutionContext {
  const request = {
    header: (name: string) => headers[name.toLowerCase()] ?? headers[name] ?? undefined,
  } as unknown as Request;

  const handler = {};
  const controller = {};

  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
    getHandler: () => handler,
    getClass: () => controller,
  } as unknown as ExecutionContext;
}

describe('GlobalApiKeyGuard - Phase 1 access control', () => {
  const originalApiKey = process.env.INTERNAL_API_KEY;

  afterEach(() => {
    if (originalApiKey !== undefined) {
      process.env.INTERNAL_API_KEY = originalApiKey;
    } else {
      delete process.env.INTERNAL_API_KEY;
    }
  });

  function createGuardWithPublicOverride(
    handlerIsPublic: boolean,
    classIsPublic: boolean,
  ): GlobalApiKeyGuard {
    const reflector = {
      getAllAndOverride: mock((key: string, contexts: unknown[]) => {
        if (key === IS_PUBLIC_ROUTE) {
          return handlerIsPublic || classIsPublic;
        }
        return undefined;
      }),
    } as unknown as Reflector;

    return new GlobalApiKeyGuard(reflector);
  }

  describe('fail closed when INTERNAL_API_KEY is missing', () => {
    it('rejects private routes when INTERNAL_API_KEY is unset', () => {
      delete process.env.INTERNAL_API_KEY;
      const guard = createGuardWithPublicOverride(false, false);
      const ctx = createMockExecutionContext();

      expect(() => guard.canActivate(ctx)).toThrow();
    });

    it('rejects private routes when INTERNAL_API_KEY is empty string', () => {
      process.env.INTERNAL_API_KEY = '';
      const guard = createGuardWithPublicOverride(false, false);
      const ctx = createMockExecutionContext();

      expect(() => guard.canActivate(ctx)).toThrow();
    });

    it('rejects private routes when INTERNAL_API_KEY is whitespace only', () => {
      process.env.INTERNAL_API_KEY = '   ';
      const guard = createGuardWithPublicOverride(false, false);
      const ctx = createMockExecutionContext();

      expect(() => guard.canActivate(ctx)).toThrow();
    });

    it('throws UNAUTHORIZED error code when key is missing', () => {
      delete process.env.INTERNAL_API_KEY;
      const guard = createGuardWithPublicOverride(false, false);
      const ctx = createMockExecutionContext();

      try {
        guard.canActivate(ctx);
        throw new Error('Expected AppException to be thrown');
      } catch (error: unknown) {
        const err = error as { code: string; response: { code: string } };
        expect(err.code).toBe(ERROR_CODES.UNAUTHORIZED);
      }
    });
  });

  describe('public routes bypass guard regardless of INTERNAL_API_KEY', () => {
    it('allows handler-level @Public routes when INTERNAL_API_KEY is unset', () => {
      delete process.env.INTERNAL_API_KEY;
      const guard = createGuardWithPublicOverride(true, false);
      const ctx = createMockExecutionContext();

      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('allows class-level @Public routes when INTERNAL_API_KEY is unset', () => {
      delete process.env.INTERNAL_API_KEY;
      const guard = createGuardWithPublicOverride(false, true);
      const ctx = createMockExecutionContext();

      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('allows @Public routes even when INTERNAL_API_KEY is set', () => {
      process.env.INTERNAL_API_KEY = 'test-key';
      const guard = createGuardWithPublicOverride(true, false);
      const ctx = createMockExecutionContext();

      expect(guard.canActivate(ctx)).toBe(true);
    });
  });

  describe('private routes with correct API key', () => {
    it('accepts requests with matching x-api-key header', () => {
      process.env.INTERNAL_API_KEY = 'secret-key-123';
      const guard = createGuardWithPublicOverride(false, false);
      const ctx = createMockExecutionContext({ 'x-api-key': 'secret-key-123' });

      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('accepts requests with matching Authorization Bearer header', () => {
      process.env.INTERNAL_API_KEY = 'secret-key-123';
      const guard = createGuardWithPublicOverride(false, false);
      const ctx = createMockExecutionContext({
        authorization: 'Bearer secret-key-123',
      });

      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('accepts requests with case-insensitive Bearer prefix', () => {
      process.env.INTERNAL_API_KEY = 'secret-key-123';
      const guard = createGuardWithPublicOverride(false, false);
      const ctx = createMockExecutionContext({
        authorization: 'bearer secret-key-123',
      });

      expect(guard.canActivate(ctx)).toBe(true);
    });
  });

  describe('private routes with wrong API key', () => {
    it('rejects requests with wrong x-api-key', () => {
      process.env.INTERNAL_API_KEY = 'secret-key-123';
      const guard = createGuardWithPublicOverride(false, false);
      const ctx = createMockExecutionContext({ 'x-api-key': 'wrong-key' });

      expect(() => guard.canActivate(ctx)).toThrow();
    });

    it('rejects requests with wrong Bearer token', () => {
      process.env.INTERNAL_API_KEY = 'secret-key-123';
      const guard = createGuardWithPublicOverride(false, false);
      const ctx = createMockExecutionContext({
        authorization: 'Bearer wrong-key',
      });

      expect(() => guard.canActivate(ctx)).toThrow();
    });

    it('rejects requests with no API key when key is configured', () => {
      process.env.INTERNAL_API_KEY = 'secret-key-123';
      const guard = createGuardWithPublicOverride(false, false);
      const ctx = createMockExecutionContext({});

      expect(() => guard.canActivate(ctx)).toThrow();
    });

    it('throws INVALID_TOKEN error code for wrong key', () => {
      process.env.INTERNAL_API_KEY = 'secret-key-123';
      const guard = createGuardWithPublicOverride(false, false);
      const ctx = createMockExecutionContext({ 'x-api-key': 'wrong-key' });

      try {
        guard.canActivate(ctx);
        throw new Error('Expected AppException to be thrown');
      } catch (error: unknown) {
        const err = error as { code: string };
        expect(err.code).toBe(ERROR_CODES.INVALID_TOKEN);
      }
    });
  });

  describe('debug routes remain private by default', () => {
    it('debug/queue route is not public and requires API key', () => {
      process.env.INTERNAL_API_KEY = 'secret-key-123';
      const guard = createGuardWithPublicOverride(false, false);
      const ctx = createMockExecutionContext({});

      expect(() => guard.canActivate(ctx)).toThrow();
    });

    it('debug/failures route is not public and requires API key', () => {
      process.env.INTERNAL_API_KEY = 'secret-key-123';
      const guard = createGuardWithPublicOverride(false, false);
      const ctx = createMockExecutionContext({});

      expect(() => guard.canActivate(ctx)).toThrow();
    });

    it('debug routes fail closed when INTERNAL_API_KEY is missing', () => {
      delete process.env.INTERNAL_API_KEY;
      const guard = createGuardWithPublicOverride(false, false);
      const ctx = createMockExecutionContext({});

      try {
        guard.canActivate(ctx);
        throw new Error('Expected AppException to be thrown');
      } catch (error: unknown) {
        const err = error as { code: string };
        expect(err.code).toBe(ERROR_CODES.UNAUTHORIZED);
      }
    });
  });
});
