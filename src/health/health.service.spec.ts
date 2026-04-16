import { ConfigService } from '@nestjs/config';
import { describe, expect, it, beforeEach, afterEach, jest } from '@jest/globals';
import { HealthService } from './health.service';

describe('HealthService', () => {
  let service: HealthService;
  let fetchMock: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    const configService = new ConfigService({
      GOOGLE_API_KEY: 'google-key',
      TOMTOM_API_KEY: 'tomtom-key',
      MAPILLARY_ACCESS_TOKEN: 'mapillary-token',
      OVERPASS_API_URLS:
        'https://overpass-api.de/api/interpreter,https://overpass.private.coffee/api/interpreter',
    });
    service = new HealthService(configService);
    fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response('ok', {
        status: 200,
      }),
    );
  });

  afterEach(() => {
    fetchMock.mockRestore();
  });

  it('returns ok when all external probes succeed', async () => {
    const result = await service.checkReadiness();

    expect(result.status).toBe('ok');
    expect(result.checks).toEqual({
      googlePlaces: true,
      overpass: true,
      mapillary: true,
      tomtom: true,
    });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('returns degraded when one external probe fails', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response('ok', { status: 200 }))
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));

    const result = await service.checkReadiness();

    expect(result.status).toBe('degraded');
    expect(result.checks.overpass).toBe(false);
  });

  it('skips optional mapillary probe when token is missing', async () => {
    const configService = new ConfigService({
      GOOGLE_API_KEY: 'google-key',
      TOMTOM_API_KEY: 'tomtom-key',
      OVERPASS_API_URLS: 'https://overpass-api.de/api/interpreter',
    });
    service = new HealthService(configService);

    const result = await service.checkReadiness();

    expect(result.checks.mapillary).toBe(true);
  });
});
