import { appMetrics } from '../metrics/metrics.instance';

export type CircuitState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerStats {
  state: CircuitState;
  consecutiveFailures: number;
  lastFailureAt: string | null;
  totalRequests: number;
  totalFailures: number;
}

export interface ProviderHealthSnapshotEntry {
  provider: string;
  state: 'healthy' | 'degraded' | 'open';
  consecutiveFailures: number;
  lastFailureAt: string | null;
  totalRequests: number;
  totalFailures: number;
}

export interface CircuitBreakerRestoreSnapshot {
  providers: ProviderHealthSnapshotEntry[];
  trackedAt: string;
}

export class CircuitBreakerOpenError extends Error {
  constructor(
    public readonly provider: string,
    public readonly retryAfterMs: number,
    message = `Circuit breaker is open for provider: ${provider}`,
  ) {
    super(message);
    this.name = 'CircuitBreakerOpenError';
  }
}

export interface CircuitBreakerOptions {
  failureThreshold: number;
  recoveryTimeoutMs: number;
}

const DEFAULT_OPTIONS: CircuitBreakerOptions = {
  failureThreshold: 3,
  recoveryTimeoutMs: 30_000,
};

const CIRCUIT_BREAKER_STATE_VALUE: Record<CircuitState, number> = {
  closed: 0,
  'half-open': 1,
  open: 2,
};

const CIRCUIT_BREAKER_STATE_HELP =
  'Current circuit breaker state by provider (0=closed, 1=half-open, 2=open).';

export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private consecutiveFailures = 0;
  private lastFailureAt: number | null = null;
  private totalRequests = 0;
  private totalFailures = 0;

  constructor(
    private readonly provider: string,
    private readonly options: CircuitBreakerOptions = DEFAULT_OPTIONS,
  ) {
    this.publishStateMetric();
  }

  getState(): CircuitState {
    if (this.state === 'open' && this.shouldAttemptRecovery()) {
      this.transitionTo('half-open');
    }
    return this.state;
  }

  getStats(): CircuitBreakerStats {
    return {
      state: this.getState(),
      consecutiveFailures: this.consecutiveFailures,
      lastFailureAt: this.lastFailureAt ? new Date(this.lastFailureAt).toISOString() : null,
      totalRequests: this.totalRequests,
      totalFailures: this.totalFailures,
    };
  }

  canExecute(): boolean {
    const currentState = this.getState();
    return currentState === 'closed' || currentState === 'half-open';
  }

  recordSuccess(): void {
    this.totalRequests++;
    this.consecutiveFailures = 0;
    if (this.state === 'half-open') {
      this.transitionTo('closed');
    }
  }

  recordFailure(): void {
    this.totalRequests++;
    this.totalFailures++;
    this.consecutiveFailures++;
    this.lastFailureAt = Date.now();

    if (this.state === 'half-open') {
      this.transitionTo('open');
    } else if (this.consecutiveFailures >= this.options.failureThreshold) {
      this.transitionTo('open');
    }
  }

  getRetryAfterMs(): number {
    if (this.lastFailureAt === null) {
      return this.options.recoveryTimeoutMs;
    }
    const elapsed = Date.now() - this.lastFailureAt;
    return Math.max(0, this.options.recoveryTimeoutMs - elapsed);
  }

  reset(): void {
    this.state = 'closed';
    this.consecutiveFailures = 0;
    this.lastFailureAt = null;
    this.publishStateMetric();
  }

  restoreFromStats(stats: CircuitBreakerStats): void {
    this.state = stats.state;
    this.consecutiveFailures = stats.consecutiveFailures;
    this.lastFailureAt = stats.lastFailureAt ? Date.parse(stats.lastFailureAt) : null;
    this.totalRequests = stats.totalRequests;
    this.totalFailures = stats.totalFailures;
    this.publishStateMetric();
  }

  private shouldAttemptRecovery(): boolean {
    if (this.lastFailureAt === null) {
      return false;
    }
    return Date.now() - this.lastFailureAt >= this.options.recoveryTimeoutMs;
  }

  private transitionTo(nextState: CircuitState): void {
    if (this.state === nextState) {
      return;
    }

    this.state = nextState;
    this.publishStateMetric();
  }

  private publishStateMetric(): void {
    appMetrics.setGauge(
      'circuit_breaker_state',
      CIRCUIT_BREAKER_STATE_VALUE[this.state],
      { provider: this.provider },
      CIRCUIT_BREAKER_STATE_HELP,
    );
  }
}

const OPEN_METEO_NORMALIZED = 'open-meteo';

export function normalizeProviderKey(provider: string): string {
  const lower = provider.toLowerCase();
  if (lower.includes('open-meteo') || lower.includes('open meteo')) {
    return OPEN_METEO_NORMALIZED;
  }
  return lower;
}

export class CircuitBreakerRegistry {
  private breakers = new Map<string, CircuitBreaker>();
  private defaultOptions: CircuitBreakerOptions = DEFAULT_OPTIONS;

  withOptions(options: CircuitBreakerOptions): this {
    this.defaultOptions = options;
    return this;
  }

  get(provider: string): CircuitBreaker {
    const key = normalizeProviderKey(provider);
    if (!this.breakers.has(key)) {
      this.breakers.set(key, new CircuitBreaker(key, this.defaultOptions));
    }
    return this.breakers.get(key)!;
  }

  resetAll(): void {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
  }

  clear(): void {
    this.breakers.clear();
  }

  reset(provider: string): void {
    const key = normalizeProviderKey(provider);
    this.breakers.get(key)?.reset();
  }

  getStats(provider: string): CircuitBreakerStats | null {
    const key = normalizeProviderKey(provider);
    return this.breakers.get(key)?.getStats() ?? null;
  }

  restoreFromSnapshot(snapshot: CircuitBreakerRestoreSnapshot): void {
    for (const entry of snapshot.providers) {
      const key = normalizeProviderKey(entry.provider);
      const breaker = this.get(key);

      const circuitState: CircuitState =
        entry.state === 'open' ? 'open' : 'closed';

      breaker.restoreFromStats({
        state: circuitState,
        consecutiveFailures: entry.consecutiveFailures,
        lastFailureAt: entry.lastFailureAt,
        totalRequests: entry.totalRequests,
        totalFailures: entry.totalFailures,
      });
    }
  }
}

export const circuitBreakerRegistry = new CircuitBreakerRegistry();
