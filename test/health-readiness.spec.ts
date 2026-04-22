import { describe, expect, it, beforeEach, afterEach, mock } from 'bun:test';
import { ConfigService } from '@nestjs/config';
import { circuitBreakerRegistry } from '../src/common/http/circuit-breaker';
import { HealthService } from '../src/health/health.service';

describe('HealthService readiness policy', () => {
  let mockConfigService: ConfigService;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    circuitBreakerRegistry.clear();
    originalFetch = globalThis.fetch;
    globalThis.fetch = mock(async () => new Response('ok', { status: 200 })) as unknown as typeof fetch;

    mockConfigService = {
      get: mock((key: string) => {
        switch (key) {
          case 'GOOGLE_API_KEY':
            return 'test-google-key';
          case 'OVERPASS_API_URLS':
            return 'https://overpass-api.de/api/interpreter';
          case 'MAPILLARY_ACCESS_TOKEN':
            return undefined;
          case 'TOMTOM_API_KEY':
            return undefined;
          default:
            return undefined;
        }
      }),
    } as unknown as ConfigService;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    circuitBreakerRegistry.clear();
  });

  describe('getProviderHealthSnapshot', () => {
    it('returns a snapshot with providers array and trackedAt timestamp', () => {
      const service = new HealthService(mockConfigService);
      const snapshot = service.getProviderHealthSnapshot();

      expect(snapshot).toHaveProperty('providers');
      expect(snapshot).toHaveProperty('trackedAt');
      expect(Array.isArray(snapshot.providers)).toBe(true);
      expect(typeof snapshot.trackedAt).toBe('string');
      expect(new Date(snapshot.trackedAt).getTime()).not.toBeNaN();
    });

    it('returns an empty providers array when no breaker-tracked providers exist', () => {
      const service = new HealthService(mockConfigService);
      const snapshot = service.getProviderHealthSnapshot();

      expect(snapshot.providers).toHaveLength(0);
    });

    it('includes tracked breaker stats for normalized open-meteo providers', () => {
      const service = new HealthService(mockConfigService);
      const breaker = circuitBreakerRegistry.get('Open-Meteo Current Weather');

      breaker.recordFailure();

      const snapshot = service.getProviderHealthSnapshot();

      expect(snapshot.providers).toHaveLength(1);
      const provider = snapshot.providers[0]!;

      expect(provider).toMatchObject({
        provider: 'open-meteo',
        state: 'degraded',
        failureCount: 1,
      });
      expect(provider.lastTransitionAt).not.toBeNull();
    });
  });

  describe('checkReadiness includes providerHealth', () => {
    it('returns providerHealth snapshot alongside readiness checks', async () => {
      const service = new HealthService(mockConfigService);
      const result = await service.checkReadiness();

      expect(result).toHaveProperty('providerHealth');
      expect(result.providerHealth).toHaveProperty('providers');
      expect(result.providerHealth).toHaveProperty('trackedAt');
    });

    it('does not alter requiredHealthy semantics when providerHealth is present', async () => {
      const service = new HealthService(mockConfigService);
      const result = await service.checkReadiness();

      // Required deps are configured, so requiredHealthy should be true
      // regardless of providerHealth snapshot presence
      expect(result.requiredHealthy).toBe(true);
      expect(result.missingRequired).toEqual([]);
    });

    it('includes non-empty providerHealth in readiness after breaker failures are recorded', async () => {
      const service = new HealthService(mockConfigService);
      const breaker = circuitBreakerRegistry.get('Open-Meteo Current Weather');

      breaker.recordFailure();

      const result = await service.checkReadiness();

      expect(result.providerHealth.providers).toHaveLength(1);
      expect(result.providerHealth.providers[0]).toMatchObject({
        provider: 'open-meteo',
        state: 'degraded',
        failureCount: 1,
      });
    });

    it('returns degraded status when required deps are missing, with providerHealth intact', async () => {
      const brokenConfig = {
        get: mock(() => undefined),
      } as unknown as ConfigService;

      const service = new HealthService(brokenConfig);
      const result = await service.checkReadiness();

      expect(result.status).toBe('degraded');
      expect(result.requiredHealthy).toBe(false);
      expect(result.missingRequired).toContain('googlePlaces');
      expect(result.missingRequired).toContain('overpass');
      expect(result.providerHealth).toBeDefined();
      expect(result.providerHealth.providers).toHaveLength(0);
    });
  });

  describe('checkRequiredConfig', () => {
    it('returns healthy when all required deps are configured', () => {
      const service = new HealthService(mockConfigService);
      const result = service.checkRequiredConfig();

      expect(result.healthy).toBe(true);
      expect(result.missing).toEqual([]);
    });

    it('returns unhealthy when GOOGLE_API_KEY is missing', () => {
      mockConfigService.get = mock((key: string) => {
        if (key === 'GOOGLE_API_KEY') return undefined;
        if (key === 'OVERPASS_API_URLS') return 'https://overpass.example.com';
        return undefined;
      });

      const service = new HealthService(mockConfigService);
      const result = service.checkRequiredConfig();

      expect(result.healthy).toBe(false);
      expect(result.missing).toContain('googlePlaces');
      expect(result.missing).not.toContain('overpass');
    });

    it('returns unhealthy when OVERPASS_API_URLS is missing', () => {
      mockConfigService.get = mock((key: string) => {
        if (key === 'GOOGLE_API_KEY') return 'some-key';
        if (key === 'OVERPASS_API_URLS') return undefined;
        return undefined;
      });

      const service = new HealthService(mockConfigService);
      const result = service.checkRequiredConfig();

      expect(result.healthy).toBe(false);
      expect(result.missing).toContain('overpass');
      expect(result.missing).not.toContain('googlePlaces');
    });

    it('returns unhealthy when both required deps are missing', () => {
      mockConfigService.get = mock(() => undefined);

      const service = new HealthService(mockConfigService);
      const result = service.checkRequiredConfig();

      expect(result.healthy).toBe(false);
      expect(result.missing).toContain('googlePlaces');
      expect(result.missing).toContain('overpass');
      expect(result.missing.length).toBe(2);
    });

    it('treats empty string GOOGLE_API_KEY as missing', () => {
      mockConfigService.get = mock((key: string) => {
        if (key === 'GOOGLE_API_KEY') return '   ';
        if (key === 'OVERPASS_API_URLS') return 'https://overpass.example.com';
        return undefined;
      });

      const service = new HealthService(mockConfigService);
      const result = service.checkRequiredConfig();

      expect(result.healthy).toBe(false);
      expect(result.missing).toContain('googlePlaces');
    });

    it('treats empty string OVERPASS_API_URLS as missing', () => {
      mockConfigService.get = mock((key: string) => {
        if (key === 'GOOGLE_API_KEY') return 'some-key';
        if (key === 'OVERPASS_API_URLS') return '  ';
        return undefined;
      });

      const service = new HealthService(mockConfigService);
      const result = service.checkRequiredConfig();

      expect(result.healthy).toBe(false);
      expect(result.missing).toContain('overpass');
    });
  });

  describe('checkLiveness', () => {
    it('returns ok status with uptime', () => {
      const service = new HealthService(mockConfigService);
      const result = service.checkLiveness();

      expect(result.status).toBe('ok');
      expect(result.uptimeSeconds).toBeGreaterThanOrEqual(0);
    });
  });
});
