import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  circuitBreakerRegistry,
  type CircuitBreakerStats,
} from '../common/http/circuit-breaker';
import {
  readProviderHealthSnapshot,
  writeProviderHealthSnapshot,
} from '../scene/storage/scene-storage.utils';

interface LivenessResult {
  status: 'ok';
  uptimeSeconds: number;
}

interface ReadinessChecks {
  googlePlaces: boolean;
  overpass: boolean;
  mapillary: boolean;
  tomtom: boolean;
}

export type ProviderHealthState = 'healthy' | 'degraded' | 'open';

export interface ProviderHealthEntry {
  provider: string;
  state: ProviderHealthState;
  failureCount: number;
  lastTransitionAt: string | null;
}

export interface ProviderHealthSnapshot {
  providers: ProviderHealthEntry[];
  trackedAt: string;
}

interface CircuitBreakerLike {
  getStats(): CircuitBreakerStats;
}

interface CircuitBreakerRegistryLike {
  breakers?: Map<string, CircuitBreakerLike>;
}

function toProviderHealthState(stats: CircuitBreakerStats): ProviderHealthState {
  if (stats.state === 'open') {
    return 'open';
  }

  if (stats.state === 'half-open' || stats.consecutiveFailures > 0) {
    return 'degraded';
  }

  return 'healthy';
}

function snapshotProviderHealth(): ProviderHealthEntry[] {
  const breakers = (circuitBreakerRegistry as unknown as CircuitBreakerRegistryLike).breakers;

  if (!(breakers instanceof Map) || breakers.size === 0) {
    return [];
  }

  return Array.from(breakers.entries())
    .map(([provider, breaker]) => {
      const stats = breaker.getStats();

      if (stats.totalRequests === 0) {
        return null;
      }

      return {
        provider,
        state: toProviderHealthState(stats),
        failureCount: stats.consecutiveFailures,
        lastTransitionAt: stats.lastFailureAt,
      };
    })
    .filter((entry): entry is ProviderHealthEntry => entry !== null)
    .sort((a, b) => a.provider.localeCompare(b.provider));
}

interface ReadinessResult {
  status: 'ok' | 'degraded';
  checks: ReadinessChecks;
  requiredHealthy: boolean;
  missingRequired: string[];
  providerHealth: ProviderHealthSnapshot;
}

/**
 * Required dependencies: core functionality cannot operate without them.
 * - googlePlaces: scene generation requires place lookup
 * - overpass: scene generation requires building/road data
 *
 * Optional dependencies: enhance scene detail but are not blocking.
 * - mapillary: facade/street detail (graceful degradation)
 * - tomtom: traffic overlay (graceful degradation)
 */
const REQUIRED_DEPS = ['googlePlaces', 'overpass'] as const;

@Injectable()
export class HealthService implements OnModuleInit {
  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    await this.restoreProviderHealthSnapshot();
  }

  checkLiveness(): LivenessResult {
    return {
      status: 'ok',
      uptimeSeconds: Math.round(process.uptime()),
    };
  }

  async checkReadiness(): Promise<ReadinessResult> {
    const [googlePlaces, overpass, mapillary, tomtom] = await Promise.all([
      this.checkGooglePlaces(),
      this.checkOverpass(),
      this.checkMapillary(),
      this.checkTomTom(),
    ]);

    const checks: ReadinessChecks = {
      googlePlaces,
      overpass,
      mapillary,
      tomtom,
    };

    const missingRequired = REQUIRED_DEPS.filter(
      (dep) => !checks[dep],
    ) as string[];

    const requiredHealthy = missingRequired.length === 0;

    return {
      status: requiredHealthy ? 'ok' : 'degraded',
      checks,
      requiredHealthy,
      missingRequired,
      providerHealth: this.getProviderHealthSnapshot(),
    };
  }

  getProviderHealthSnapshot(): ProviderHealthSnapshot {
    return {
      providers: snapshotProviderHealth(),
      trackedAt: new Date().toISOString(),
    };
  }

  async persistProviderHealthSnapshot(): Promise<void> {
    const snapshot = this.getProviderHealthSnapshot();
    const breakers = (circuitBreakerRegistry as unknown as CircuitBreakerRegistryLike).breakers;

    const enrichedProviders = snapshot.providers.map((entry) => {
      const breaker = breakers?.get(entry.provider);
      const stats = breaker?.getStats();
      return {
        provider: entry.provider,
        state: entry.state,
        consecutiveFailures: entry.failureCount,
        lastFailureAt: entry.lastTransitionAt,
        totalRequests: stats?.totalRequests ?? 0,
        totalFailures: stats?.totalFailures ?? 0,
      };
    });

    await writeProviderHealthSnapshot({
      providers: enrichedProviders,
      trackedAt: snapshot.trackedAt,
    });
  }

  async restoreProviderHealthSnapshot(): Promise<void> {
    try {
      const snapshot = await readProviderHealthSnapshot();
      if (!snapshot || snapshot.providers.length === 0) {
        return;
      }

      circuitBreakerRegistry.restoreFromSnapshot({
        providers: snapshot.providers,
        trackedAt: snapshot.trackedAt,
      });
    } catch {
      // restore is best-effort; missing or corrupt file should not block startup
    }
  }

  private async checkGooglePlaces(): Promise<boolean> {
    const apiKey = this.configService.get<string>('GOOGLE_API_KEY')?.trim();
    if (!apiKey) {
      return false;
    }

    return this.probe(
      'https://places.googleapis.com/v1/places:searchText',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'places.id',
        },
        body: JSON.stringify({
          textQuery: 'Seoul',
          pageSize: 1,
          languageCode: 'en',
        }),
      },
    );
  }

  private async checkOverpass(): Promise<boolean> {
    const rawUrls = this.configService.get<string>('OVERPASS_API_URLS')?.trim();
    if (!rawUrls) {
      return false;
    }

    const firstUrl = rawUrls
      .split(',')
      .map((value) => value.trim())
      .find(Boolean);
    if (!firstUrl) {
      return false;
    }

    return this.probe(firstUrl, {
      method: 'HEAD',
    });
  }

  private async checkMapillary(): Promise<boolean> {
    const accessToken = this.configService
      .get<string>('MAPILLARY_ACCESS_TOKEN')
      ?.trim();
    if (!accessToken) {
      return true;
    }

    return this.probe(
      `https://graph.mapillary.com/images?access_token=${encodeURIComponent(accessToken)}&bbox=127.027,37.497,127.028,37.498&fields=id&limit=1`,
      {
        method: 'GET',
      },
    );
  }

  private async checkTomTom(): Promise<boolean> {
    const apiKey = this.configService.get<string>('TOMTOM_API_KEY')?.trim();
    if (!apiKey) {
      return true;
    }

    return this.probe(
      'https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json?point=37.4979,127.0276',
      {
        method: 'GET',
        headers: {
          'X-TomTom-Api-Key': apiKey,
        },
      },
    );
  }

  /**
   * Check required dependency configuration without making HTTP calls.
   * Used by the base /health endpoint to reflect essential functionality
   * availability without the latency of external probes.
   */
  checkRequiredConfig(): { healthy: boolean; missing: string[] } {
    const googleKey = this.configService.get<string>('GOOGLE_API_KEY')?.trim();
    const overpassUrls = this.configService.get<string>('OVERPASS_API_URLS')?.trim();

    const missing: string[] = [];
    if (!googleKey) missing.push('googlePlaces');
    if (!overpassUrls) missing.push('overpass');

    return {
      healthy: missing.length === 0,
      missing,
    };
  }

  private async probe(url: string, init: RequestInit): Promise<boolean> {
    try {
      await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(2500),
      });
      return true;
    } catch {
      return false;
    }
  }
}
