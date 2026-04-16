import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { TtlCacheService } from './ttl-cache.service';

describe('TtlCacheService', () => {
  let cache: TtlCacheService;

  beforeEach(() => {
    cache = new TtlCacheService(1000);
  });

  afterEach(() => {
    cache.clear();
    cache.onApplicationShutdown();
  });

  describe('basic get/set', () => {
    it('stores and retrieves a value', () => {
      cache.set('key1', 'value1', 5000);
      expect(cache.get<string>('key1')).toBe('value1');
    });

    it('returns undefined for non-existent key', () => {
      expect(cache.get('nonexistent')).toBeUndefined();
    });

    it('overwrites existing value on set', () => {
      cache.set('key1', 'value1', 5000);
      cache.set('key1', 'value2', 5000);
      expect(cache.get<string>('key1')).toBe('value2');
    });
  });

  describe('TTL expiration', () => {
    it('expires entry after TTL', () => {
      const shortCache = new TtlCacheService(1000);
      shortCache.set('key1', 'value1', 100);
      expect(shortCache.get<string>('key1')).toBe('value1');

      const now = Date.now;
      const originalNow = Date.now;
      try {
        Date.now = () => originalNow() + 200;
        expect(shortCache.get('key1')).toBeUndefined();
      } finally {
        Date.now = now;
      }
      shortCache.onApplicationShutdown();
    });

    it('returns undefined for expired entry on get', () => {
      const shortCache = new TtlCacheService(1000);
      shortCache.set('key1', 'value1', 50);
      const originalNow = Date.now;
      try {
        Date.now = () => originalNow() + 100;
        expect(shortCache.get('key1')).toBeUndefined();
      } finally {
        Date.now = originalNow;
      }
      shortCache.onApplicationShutdown();
    });
  });

  describe('getOrSet (stampede prevention)', () => {
    it('returns cached value if available', async () => {
      cache.set('key1', 'existing', 5000);
      const factory = jest.fn(() => Promise.resolve('new-value'));
      const result = await cache.getOrSet('key1', 5000, factory);
      expect(result).toBe('existing');
      expect(factory).not.toHaveBeenCalled();
    });

    it('calls factory and caches result on cache miss', async () => {
      const factory = jest.fn(() => Promise.resolve('factory-value'));
      const result = await cache.getOrSet('key1', 5000, factory);
      expect(result).toBe('factory-value');
      expect(factory).toHaveBeenCalledTimes(1);
      expect(cache.get<string>('key1')).toBe('factory-value');
    });

    it('deduplicates concurrent getOrSet calls', async () => {
      let resolveFactory: (value: string) => void;
      const factoryPromise = new Promise<string>((resolve) => {
        resolveFactory = resolve;
      });
      const factory = jest.fn(() => factoryPromise);

      const result1 = cache.getOrSet('key1', 5000, factory);
      const result2 = cache.getOrSet('key1', 5000, factory);

      resolveFactory!('shared-result');

      const [val1, val2] = await Promise.all([result1, result2]);
      expect(val1).toBe('shared-result');
      expect(val2).toBe('shared-result');
      expect(factory).toHaveBeenCalledTimes(1);
    });

    it('removes inflight entry after factory rejects', async () => {
      const factory = jest.fn(() => Promise.reject(new Error('fail')));
      try {
        await cache.getOrSet('key1', 5000, factory);
      } catch {
        // expected
      }

      const factory2 = jest.fn(() => Promise.resolve('retry-value'));
      const result = await cache.getOrSet('key1', 5000, factory2);
      expect(result).toBe('retry-value');
      expect(factory2).toHaveBeenCalledTimes(1);
    });

    it('shares result between concurrent callers', async () => {
      let resolveFactory: (value: string) => void;
      const factoryPromise = new Promise<string>((resolve) => {
        resolveFactory = resolve;
      });
      const factory = jest.fn(() => factoryPromise);

      const promises = [
        cache.getOrSet('key1', 5000, factory),
        cache.getOrSet('key1', 5000, factory),
        cache.getOrSet('key1', 5000, factory),
      ];

      resolveFactory!('shared');
      const results = await Promise.all(promises);
      expect(results).toEqual(['shared', 'shared', 'shared']);
      expect(factory).toHaveBeenCalledTimes(1);
    });
  });

  describe('LRU eviction', () => {
    it('evicts oldest entries when maxSize is exceeded', () => {
      const smallCache = new TtlCacheService(3);
      smallCache.set('a', 1, 60000);
      smallCache.set('b', 2, 60000);
      smallCache.set('c', 3, 60000);
      smallCache.set('d', 4, 60000);

      expect(smallCache.get('a')).toBeUndefined();
      expect(smallCache.get<number>('b')).toBe(2);
      expect(smallCache.get<number>('c')).toBe(3);
      expect(smallCache.get<number>('d')).toBe(4);
      smallCache.onApplicationShutdown();
    });

    it('moves accessed entries to MRU position on get', () => {
      const smallCache = new TtlCacheService(3);
      smallCache.set('a', 1, 60000);
      smallCache.set('b', 2, 60000);
      smallCache.set('c', 3, 60000);

      smallCache.get<number>('a');

      smallCache.set('d', 4, 60000);

      expect(smallCache.get<number>('a')).toBe(1);
      expect(smallCache.get('b')).toBeUndefined();
      smallCache.onApplicationShutdown();
    });

    it('evicts entries in LRU order when capacity is reached', () => {
      const smallCache = new TtlCacheService(2);
      smallCache.set('x', 10, 60000);
      smallCache.set('y', 20, 60000);

      smallCache.get<number>('x');

      smallCache.set('z', 30, 60000);

      expect(smallCache.get('y')).toBeUndefined();
      expect(smallCache.get<number>('x')).toBe(10);
      expect(smallCache.get<number>('z')).toBe(30);
      smallCache.onApplicationShutdown();
    });
  });

  describe('clear and shutdown', () => {
    it('clears all entries on clear', () => {
      cache.set('key1', 'value1', 5000);
      cache.set('key2', 'value2', 5000);
      cache.clear();
      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBeUndefined();
    });

    it('clears store on application shutdown', () => {
      cache.set('persistent', 'data', 60000);
      cache.onApplicationShutdown();
      expect(cache.get('persistent')).toBeUndefined();
    });
  });

  describe('getStats', () => {
    it('returns cache size and maxSize', () => {
      const statsCache = new TtlCacheService(100);
      statsCache.set('k1', 'v1', 5000);
      statsCache.set('k2', 'v2', 5000);
      const stats = statsCache.getStats();
      expect(stats.size).toBe(2);
      expect(stats.maxSize).toBe(100);
      statsCache.onApplicationShutdown();
    });

    it('tracks hit and miss counts', () => {
      const statsCache = new TtlCacheService(100);
      expect(statsCache.get('missing')).toBeUndefined();
      statsCache.set('k1', 'v1', 5000);
      expect(statsCache.get('k1')).toBe('v1');

      const stats = statsCache.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      statsCache.onApplicationShutdown();
    });
  });
});
