import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { appMetrics } from '../common/metrics/metrics.instance';

interface CacheEntry<T> {
  expiresAt: number;
  value: T;
}

@Injectable()
export class TtlCacheService implements OnApplicationShutdown {
  private readonly store = new Map<string, CacheEntry<unknown>>();
  private readonly inflight = new Map<string, Promise<unknown>>();
  private readonly cleanupTimer: ReturnType<typeof setInterval> | undefined;
  private hits = 0;
  private misses = 0;

  constructor(
    private readonly maxSize = 1000,
    cleanupIntervalMs?: number,
  ) {
    if (cleanupIntervalMs != null && cleanupIntervalMs > 0) {
      this.cleanupTimer = setInterval(() => {
        this.cleanupExpired();
        this.evictIfNeeded();
      }, cleanupIntervalMs);
    }
  }

  async getOrSet<T>(
    key: string,
    ttlMs: number,
    factory: () => Promise<T>,
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== undefined) {
      return cached;
    }

    const existing = this.inflight.get(key);
    if (existing) {
      return (await existing) as T;
    }

    const promise = (async () => {
      try {
        const value = await factory();
        this.set(key, value, ttlMs);
        return value;
      } finally {
        this.inflight.delete(key);
      }
    })();

    this.inflight.set(key, promise);
    return promise;
  }

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) {
      this.misses += 1;
      this.recordMetrics();
      return undefined;
    }

    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      this.misses += 1;
      this.recordMetrics();
      return undefined;
    }

    this.hits += 1;
    this.recordMetrics();
    this.touchKey(key);
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlMs: number): void {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
    this.evictIfNeeded();
    this.recordMetrics();
  }

  getStats(): { hits: number; misses: number; size: number; maxSize: number } {
    return {
      hits: this.hits,
      misses: this.misses,
      size: this.store.size,
      maxSize: this.maxSize,
    };
  }

  clear(): void {
    this.store.clear();
    this.inflight.clear();
    this.recordMetrics();
  }

  onApplicationShutdown(): void {
    if (this.cleanupTimer != null) {
      clearInterval(this.cleanupTimer);
    }
    this.clear();
  }

  private touchKey(key: string): void {
    const entry = this.store.get(key);
    if (entry != null) {
      this.store.delete(key);
      this.store.set(key, entry);
    }
  }

  private evictIfNeeded(): void {
    while (this.store.size > this.maxSize) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey == null) {
        break;
      }
      this.store.delete(oldestKey);
    }
  }

  private cleanupExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (entry.expiresAt <= now) {
        this.store.delete(key);
      }
    }
    this.recordMetrics();
  }

  private recordMetrics(): void {
    appMetrics.setGauge(
      'cache_hits_total',
      this.hits,
      {},
      'Total cache hit count.',
    );
    appMetrics.setGauge(
      'cache_misses_total',
      this.misses,
      {},
      'Total cache miss count.',
    );
    appMetrics.setGauge(
      'cache_entries',
      this.store.size,
      {},
      'Current number of cache entries.',
    );
    appMetrics.setGauge(
      'cache_max_entries',
      this.maxSize,
      {},
      'Maximum number of cache entries.',
    );
  }
}
