import { describe, expect, it, beforeEach, afterEach, mock } from 'bun:test';
import { ConfigService } from '@nestjs/config';
import {
  CircuitBreaker,
  CircuitBreakerRegistry,
  circuitBreakerRegistry,
} from '../src/common/http/circuit-breaker';
import {
  getProviderHealthSnapshotPath,
  readProviderHealthSnapshot,
  writeProviderHealthSnapshot,
  readSceneGenerationQueueSnapshot,
  readSceneRecentFailuresSnapshot,
  type ProviderHealthSnapshotFile,
} from '../src/scene/storage/scene-storage.utils';
import { HealthService } from '../src/health/health.service';

describe('Phase 8. Provider health/readiness snapshot persistence', () => {
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

  describe('CircuitBreaker.restoreFromStats', () => {
    it('restores closed state with zero failures', () => {
      const breaker = new CircuitBreaker('test-provider', {
        failureThreshold: 3,
        recoveryTimeoutMs: 100,
      });

      breaker.restoreFromStats({
        state: 'closed',
        consecutiveFailures: 0,
        lastFailureAt: null,
        totalRequests: 0,
        totalFailures: 0,
      });

      expect(breaker.getState()).toBe('closed');
      expect(breaker.getStats().consecutiveFailures).toBe(0);
      expect(breaker.getStats().totalRequests).toBe(0);
    });

    it('restores open state with accumulated failures', () => {
      const breaker = new CircuitBreaker('test-provider', {
        failureThreshold: 3,
        recoveryTimeoutMs: 100,
      });

      breaker.restoreFromStats({
        state: 'open',
        consecutiveFailures: 5,
        lastFailureAt: new Date().toISOString(),
        totalRequests: 10,
        totalFailures: 5,
      });

      expect(breaker.getState()).toBe('open');
      expect(breaker.getStats().consecutiveFailures).toBe(5);
      expect(breaker.getStats().totalRequests).toBe(10);
      expect(breaker.getStats().totalFailures).toBe(5);
    });

    it('restores half-open state', () => {
      const breaker = new CircuitBreaker('test-provider', {
        failureThreshold: 3,
        recoveryTimeoutMs: 100,
      });

      breaker.restoreFromStats({
        state: 'half-open',
        consecutiveFailures: 3,
        lastFailureAt: new Date().toISOString(),
        totalRequests: 6,
        totalFailures: 3,
      });

      expect(breaker.getState()).toBe('half-open');
      expect(breaker.canExecute()).toBe(true);
    });

    it('does not transition to half-open prematurely after restore with recent failure', () => {
      const breaker = new CircuitBreaker('test-provider', {
        failureThreshold: 3,
        recoveryTimeoutMs: 100,
      });

      breaker.restoreFromStats({
        state: 'open',
        consecutiveFailures: 3,
        lastFailureAt: new Date().toISOString(),
        totalRequests: 3,
        totalFailures: 3,
      });

      // Should stay open because recoveryTimeoutMs hasn't elapsed
      expect(breaker.getState()).toBe('open');
    });
  });

  describe('CircuitBreakerRegistry.restoreFromSnapshot', () => {
    let registry: CircuitBreakerRegistry;

    beforeEach(() => {
      registry = new CircuitBreakerRegistry().withOptions({
        failureThreshold: 3,
        recoveryTimeoutMs: 100,
      });
    });

    it('restores multiple providers from a snapshot', () => {
      const snapshot: ProviderHealthSnapshotFile = {
        providers: [
          {
            provider: 'open-meteo',
            state: 'open',
            consecutiveFailures: 5,
            lastFailureAt: new Date().toISOString(),
            totalRequests: 20,
            totalFailures: 5,
          },
          {
            provider: 'google-places',
            state: 'degraded',
            consecutiveFailures: 1,
            lastFailureAt: new Date().toISOString(),
            totalRequests: 10,
            totalFailures: 1,
          },
        ],
        trackedAt: new Date().toISOString(),
      };

      registry.restoreFromSnapshot(snapshot);

      const omStats = registry.getStats('open-meteo');
      expect(omStats?.state).toBe('open');
      expect(omStats?.consecutiveFailures).toBe(5);

      const gpStats = registry.getStats('google-places');
      expect(gpStats?.state).toBe('closed'); // 'degraded' maps to closed with failures
      expect(gpStats?.consecutiveFailures).toBe(1);
    });

    it('handles empty providers array gracefully', () => {
      const snapshot: ProviderHealthSnapshotFile = {
        providers: [],
        trackedAt: new Date().toISOString(),
      };

      registry.restoreFromSnapshot(snapshot);

      // No breakers should be created
      expect(registry.getStats('open-meteo')).toBeNull();
    });
  });

  describe('provider health snapshot storage utilities', () => {
    it('returns a valid path for the provider health snapshot file', () => {
      const path = getProviderHealthSnapshotPath();
      expect(path).toContain('provider-health');
      expect(path).toContain('.json');
    });

    it('writes and reads back a provider health snapshot', async () => {
      const snapshot: ProviderHealthSnapshotFile = {
        providers: [
          {
            provider: 'open-meteo',
            state: 'degraded',
            consecutiveFailures: 2,
            lastFailureAt: new Date().toISOString(),
            totalRequests: 15,
            totalFailures: 2,
          },
        ],
        trackedAt: new Date().toISOString(),
      };

      await writeProviderHealthSnapshot(snapshot);
      const read = await readProviderHealthSnapshot();

      expect(read).not.toBeNull();
      expect(read!.providers).toHaveLength(1);
      expect(read!.providers[0]).toMatchObject({
        provider: 'open-meteo',
        state: 'degraded',
        consecutiveFailures: 2,
      });
    });

    it('returns null when no snapshot file exists', async () => {
      // Clean up any existing snapshot
      const { unlink } = await import('node:fs/promises');
      const path = getProviderHealthSnapshotPath();
      try {
        await unlink(path);
      } catch {
        // file doesn't exist, which is fine
      }

      const read = await readProviderHealthSnapshot();
      expect(read).toBeNull();
    });
  });

  describe('HealthService persist/restore integration', () => {
    it('persists provider health snapshot to disk', async () => {
      const service = new HealthService(mockConfigService);
      const breaker = circuitBreakerRegistry.get('Open-Meteo Current Weather');
      breaker.recordFailure();
      breaker.recordFailure();

      await service.persistProviderHealthSnapshot();

      const read = await readProviderHealthSnapshot();
      expect(read).not.toBeNull();
      expect(read!.providers).toHaveLength(1);
      expect(read!.providers[0]).toMatchObject({
        provider: 'open-meteo',
        state: 'degraded',
        consecutiveFailures: 2,
      });
    });

    it('restores provider health state from persisted snapshot', async () => {
      // First, persist a snapshot with degraded state
      const service1 = new HealthService(mockConfigService);
      const breaker1 = circuitBreakerRegistry.get('Open-Meteo Current Weather');
      breaker1.recordFailure();
      breaker1.recordFailure();
      breaker1.recordFailure();
      await service1.persistProviderHealthSnapshot();

      // Clear the registry to simulate a restart
      circuitBreakerRegistry.clear();

      // Verify the breaker is gone
      expect(circuitBreakerRegistry.getStats('open-meteo')).toBeNull();

      // Restore from snapshot
      const service2 = new HealthService(mockConfigService);
      await service2.restoreProviderHealthSnapshot();

      // Verify the breaker was restored with correct state
      const stats = circuitBreakerRegistry.getStats('open-meteo');
      expect(stats).not.toBeNull();
      expect(stats!.consecutiveFailures).toBe(3);
      expect(stats!.totalFailures).toBe(3);
    });

    it('handles restore when no snapshot file exists gracefully', async () => {
      const { unlink } = await import('node:fs/promises');
      const path = getProviderHealthSnapshotPath();
      try {
        await unlink(path);
      } catch {
        // file doesn't exist, which is fine
      }

      circuitBreakerRegistry.clear();

      const service = new HealthService(mockConfigService);
      await service.restoreProviderHealthSnapshot();

      // No breakers should be created
      expect(circuitBreakerRegistry.getStats('open-meteo')).toBeNull();
    });

    it('preserves existing Phase 7 queue/failure snapshot behavior', async () => {
      const queueSnapshot = await readSceneGenerationQueueSnapshot();
      const failuresSnapshot = await readSceneRecentFailuresSnapshot();

      expect(queueSnapshot === null || typeof queueSnapshot === 'object').toBeTrue();
      expect(failuresSnapshot === null || typeof failuresSnapshot === 'object').toBeTrue();
    });
  });
});
