import { describe, expect, it, jest } from '@jest/globals';
import type { Response } from 'express';
import { HealthController } from './health.controller';
import type { HealthService } from './health.service';

describe('HealthController', () => {
  it('sets readiness status to 503 when the service is degraded', async () => {
    const readinessResult = {
      status: 'degraded' as const,
      checks: {
        googlePlaces: true,
        overpass: false,
        mapillary: true,
        tomtom: true,
      },
    };
    const healthService = {
      checkLiveness: jest.fn(),
      checkReadiness: jest.fn(async () => readinessResult),
    } as unknown as Pick<HealthService, 'checkLiveness' | 'checkReadiness'>;
    const controller = new HealthController(healthService as HealthService);
    const response = {
      status: jest.fn().mockReturnThis(),
    } as unknown as Response;

    const result = await controller.getReadiness(response);

    expect(response.status).toHaveBeenCalledWith(503);
    expect(result.message).toBe('일부 외부 서비스에 문제가 있습니다.');
    expect(result.data.status).toBe('degraded');
  });

  it('sets readiness status to 200 when the service is healthy', async () => {
    const readinessResult = {
      status: 'ok' as const,
      checks: {
        googlePlaces: true,
        overpass: true,
        mapillary: true,
        tomtom: true,
      },
    };
    const healthService = {
      checkLiveness: jest.fn(),
      checkReadiness: jest.fn(async () => readinessResult),
    } as unknown as Pick<HealthService, 'checkLiveness' | 'checkReadiness'>;
    const controller = new HealthController(healthService as HealthService);
    const response = {
      status: jest.fn().mockReturnThis(),
    } as unknown as Response;

    const result = await controller.getReadiness(response);

    expect(response.status).toHaveBeenCalledWith(200);
    expect(result.message).toBe('모든 외부 서비스가 정상입니다.');
    expect(result.data.status).toBe('ok');
  });
});
