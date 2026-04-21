import { describe, expect, it, beforeEach, mock } from 'bun:test';
import { ConfigService } from '@nestjs/config';
import { HealthService } from '../src/health/health.service';

describe('HealthService readiness policy', () => {
  let mockConfigService: ConfigService;

  beforeEach(() => {
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
