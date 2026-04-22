import { afterEach, beforeEach, describe, expect, it, vi } from 'bun:test';
import { OpenMeteoClient } from '../src/places/clients/open-meteo.client';
import type { ExternalPlaceDetail } from '../src/places/types/external-place.types';
import {
  classifyRetryable,
  fetchJson,
  resolveRetryPolicy,
  type RetryPolicy,
} from '../src/common/http/fetch-json';
import {
  CircuitBreaker,
  CircuitBreakerOpenError,
  CircuitBreakerRegistry,
  normalizeProviderKey,
  circuitBreakerRegistry,
} from '../src/common/http/circuit-breaker';
import { appMetrics } from '../src/common/metrics/metrics.instance';

// ─── Phase 5.1 Open Meteo serialization (bounded concurrency) ──

const PLACE: ExternalPlaceDetail = {
  provider: 'GOOGLE_PLACES',
  placeId: 'google-place-id',
  displayName: 'Seoul City Hall',
  formattedAddress: '110 Sejong-daero, Jung-gu, Seoul',
  location: { lat: 37.5665, lng: 126.978 },
  primaryType: 'city_hall',
  types: ['city_hall', 'point_of_interest'],
  googleMapsUri: 'https://maps.google.com',
  viewport: {
    northEast: { lat: 37.567, lng: 126.979 },
    southWest: { lat: 37.566, lng: 126.977 },
  },
  utcOffsetMinutes: 540,
};

function buildMockResponse(): Response {
  const body = JSON.stringify({
    current: {
      time: '2026-04-19T12:00',
      temperature_2m: 17.2,
      precipitation: 0,
      rain: 0,
      snowfall: 0,
      cloud_cover: 20,
    },
    hourly: {
      time: ['2026-04-19T12:00'],
      temperature_2m: [17.2],
      precipitation: [0],
      rain: [0],
      snowfall: [0],
      cloud_cover: [20],
    },
  });
  return new Response(body, { status: 200 });
}

describe('Phase 5. Open Meteo serialization (bounded concurrency)', () => {
  let client: OpenMeteoClient;

  beforeEach(() => {
    client = new OpenMeteoClient();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('serializes concurrent getCurrentObservation calls — max 1 in-flight', async () => {
    let concurrent = 0;
    let maxConcurrent = 0;

    const mockFetch = async () => {
      concurrent++;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      await new Promise((r) => setTimeout(r, 50));
      concurrent--;
      return buildMockResponse();
    };

    client.withFetcher(mockFetch as unknown as typeof fetch);

    const calls = Array.from({ length: 5 }, () =>
      client.getCurrentObservation(PLACE),
    );
    await Promise.all(calls);

    expect(maxConcurrent).toBe(1);
  });

  it('serializes concurrent getHistoricalObservation calls — max 1 in-flight', async () => {
    let concurrent = 0;
    let maxConcurrent = 0;

    const mockFetch = async () => {
      concurrent++;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      await new Promise((r) => setTimeout(r, 50));
      concurrent--;
      return buildMockResponse();
    };

    client.withFetcher(mockFetch as unknown as typeof fetch);

    const calls = Array.from({ length: 3 }, (_, i) =>
      client.getHistoricalObservation(
        PLACE,
        `2026-04-${String(19 + i).padStart(2, '0')}`,
        'DAY',
      ),
    );
    await Promise.all(calls);

    expect(maxConcurrent).toBe(1);
  });

  it('serializes mixed getCurrentObservationWithEnvelope + getHistoricalObservationWithEnvelope', async () => {
    let concurrent = 0;
    let maxConcurrent = 0;

    const mockFetch = async () => {
      concurrent++;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      await new Promise((r) => setTimeout(r, 30));
      concurrent--;
      return buildMockResponse();
    };

    client.withFetcher(mockFetch as unknown as typeof fetch);

    const calls = [
      client.getCurrentObservationWithEnvelope(PLACE),
      client.getHistoricalObservationWithEnvelope(PLACE, '2026-04-19', 'DAY'),
      client.getCurrentObservationWithEnvelope(PLACE),
    ];
    await Promise.all(calls);

    expect(maxConcurrent).toBe(1);
  });

  it('still returns correct results under serialization', async () => {
    const mockFetch = async () => buildMockResponse();
    client.withFetcher(mockFetch as unknown as typeof fetch);

    const results = await Promise.all(
      Array.from({ length: 3 }, () => client.getCurrentObservation(PLACE)),
    );

    expect(results).toHaveLength(3);
    for (const r of results) {
      expect(r).not.toBeNull();
      expect(r?.temperatureCelsius).toBe(17.2);
      expect(r?.resolvedWeather).toBe('CLEAR');
      expect(r?.source).toBe('OPEN_METEO_CURRENT');
    }
  });

  it('propagates errors correctly under serialization', async () => {
    let callCount = 0;
    // Use 400 (not retryable) to avoid fetch-json retry backoff delays
    const mockFetch = async () => {
      callCount++;
      await new Promise((r) => setTimeout(r, 10));
      return new Response('error', { status: 400 });
    };
    client.withFetcher(mockFetch as unknown as typeof fetch);

    const results = await Promise.allSettled(
      Array.from({ length: 3 }, () => client.getCurrentObservation(PLACE)),
    );

    for (const r of results) {
      expect(r.status).toBe('rejected');
    }
    expect(callCount).toBe(3);
  });

  it('does not serialize across different client instances', async () => {
    let concurrent = 0;
    let maxConcurrent = 0;

    const mockFetch = async () => {
      concurrent++;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      await new Promise((r) => setTimeout(r, 50));
      concurrent--;
      return buildMockResponse();
    };

    const clientA = new OpenMeteoClient().withFetcher(mockFetch as unknown as typeof fetch);
    const clientB = new OpenMeteoClient().withFetcher(mockFetch as unknown as typeof fetch);

    const calls = [
      clientA.getCurrentObservation(PLACE),
      clientB.getCurrentObservation(PLACE),
    ];
    await Promise.all(calls);

    expect(maxConcurrent).toBe(2);
  });
});

// ─── Phase 5.2 Provider-specific retry policy & fault-injection ──

function createMockResponse(options: { status?: number; statusText?: string; headers?: Record<string, string> } = {}): Response {
  const headersInstance = new Headers();
  if (options.headers) {
    for (const [key, value] of Object.entries(options.headers)) {
      headersInstance.set(key, String(value));
    }
  }
  return {
    ok: options.status ? options.status >= 200 && options.status < 300 : true,
    status: options.status ?? 200,
    statusText: options.statusText ?? 'OK',
    headers: headersInstance,
    text: vi.fn(async () => JSON.stringify({ data: 'ok' })),
    json: vi.fn(async () => ({ data: 'ok' })),
  } as unknown as Response;
}

function createTimeoutError(): DOMException {
  return new DOMException('The operation was aborted.', 'TimeoutError');
}

function makeFetchMock(responses: Response[]): ReturnType<typeof vi.fn> {
  return vi.fn(async () => {
    const response = responses.shift();
    if (!response) throw new Error('No more mock responses');
    if ((response as unknown as { _throw: unknown })._throw) {
      throw (response as unknown as { _throw: unknown })._throw;
    }
    return response;
  });
}

function makeFetchMockMixed(
  items: Array<Response | { _throw: unknown }>,
): ReturnType<typeof vi.fn> {
  return vi.fn(async () => {
    const item = items.shift();
    if (!item) throw new Error('No more mock responses');
    if ('_throw' in item) throw item._throw;
    return item;
  });
}

describe('classifyRetryable', () => {
  it('classifies 429 as rateLimit', () => {
    expect(classifyRetryable(429, null)).toBe('rateLimit');
  });

  it('classifies 500 as serverError', () => {
    expect(classifyRetryable(500, null)).toBe('serverError');
  });

  it('classifies 502 as serverError', () => {
    expect(classifyRetryable(502, null)).toBe('serverError');
  });

  it('classifies 503 as serverError', () => {
    expect(classifyRetryable(503, null)).toBe('serverError');
  });

  it('classifies 504 as serverError', () => {
    expect(classifyRetryable(504, null)).toBe('serverError');
  });

  it('classifies 599 as serverError', () => {
    expect(classifyRetryable(599, null)).toBe('serverError');
  });

  it('does not classify 400 as retryable', () => {
    expect(classifyRetryable(400, null)).toBeNull();
  });

  it('does not classify 401 as retryable', () => {
    expect(classifyRetryable(401, null)).toBeNull();
  });

  it('does not classify 404 as retryable', () => {
    expect(classifyRetryable(404, null)).toBeNull();
  });

  it('does not classify 200 as retryable', () => {
    expect(classifyRetryable(200, null)).toBeNull();
  });

  it('classifies DOMException TimeoutError as timeout', () => {
    const err = createTimeoutError();
    expect(classifyRetryable(null, err)).toBe('timeout');
  });

  it('classifies Error with name TimeoutError as timeout', () => {
    const err = new Error('timeout');
    err.name = 'TimeoutError';
    expect(classifyRetryable(null, err)).toBe('timeout');
  });

  it('does not classify generic Error as retryable', () => {
    const err = new Error('network error');
    expect(classifyRetryable(null, err)).toBeNull();
  });
});

describe('resolveRetryPolicy', () => {
  it('returns open-meteo policy with rateLimit and serverError', () => {
    const policy = resolveRetryPolicy('open-meteo');
    expect(policy.retryOn.has('rateLimit')).toBe(true);
    expect(policy.retryOn.has('serverError')).toBe(true);
    expect(policy.retryOn.has('timeout')).toBe(false);
    expect(policy.maxRetries).toBe(3);
  });

  it('returns google-places policy with only rateLimit', () => {
    const policy = resolveRetryPolicy('google-places');
    expect(policy.retryOn.has('rateLimit')).toBe(true);
    expect(policy.retryOn.has('serverError')).toBe(false);
    expect(policy.retryOn.has('timeout')).toBe(false);
    expect(policy.maxRetries).toBe(2);
  });

  it('returns tomtom policy with rateLimit and timeout', () => {
    const policy = resolveRetryPolicy('tomtom');
    expect(policy.retryOn.has('rateLimit')).toBe(true);
    expect(policy.retryOn.has('timeout')).toBe(true);
    expect(policy.retryOn.has('serverError')).toBe(false);
    expect(policy.maxRetries).toBe(2);
  });

  it('returns overpass policy with all three classes', () => {
    const policy = resolveRetryPolicy('overpass');
    expect(policy.retryOn.has('rateLimit')).toBe(true);
    expect(policy.retryOn.has('timeout')).toBe(true);
    expect(policy.retryOn.has('serverError')).toBe(true);
    expect(policy.maxRetries).toBe(3);
  });

  it('matches provider case-insensitively', () => {
    const policy = resolveRetryPolicy('Open-Meteo');
    expect(policy.retryOn.has('rateLimit')).toBe(true);
    expect(policy.retryOn.has('serverError')).toBe(true);
  });

  it('returns fallback policy for unknown provider', () => {
    const policy = resolveRetryPolicy('unknown-provider');
    expect(policy.retryOn.has('rateLimit')).toBe(true);
    expect(policy.retryOn.has('serverError')).toBe(false);
    expect(policy.retryOn.has('timeout')).toBe(false);
    expect(policy.maxRetries).toBe(2);
  });

  it('respects override policy', () => {
    const override: RetryPolicy = {
      retryOn: new Set(['timeout']),
      maxRetries: 5,
      backoffMs: () => 100,
    };
    const policy = resolveRetryPolicy('google-places', override);
    expect(policy).toBe(override);
    expect(policy.maxRetries).toBe(5);
  });
});

describe('429 honoring Retry-After', () => {
  it('retries on 429 and succeeds on subsequent attempt', async () => {
    const responses = [
      createMockResponse({ status: 429 }),
      createMockResponse({ status: 200 }),
    ];
    const fetchMock = makeFetchMock(responses);

    const result = await fetchJson<{ data: string }>(
      { url: 'https://api.example.com/test', provider: 'open-meteo' },
      fetchMock as unknown as typeof fetch,
    );

    expect(result).toEqual({ data: 'ok' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('honors Retry-After header in seconds', async () => {
    const responses = [
      createMockResponse({
        status: 429,
        headers: { 'retry-after': '1' },
      }),
      createMockResponse({ status: 200 }),
    ];
    const fetchMock = makeFetchMock(responses);

    await fetchJson<{ data: string }>(
      { url: 'https://api.example.com/test', provider: 'open-meteo' },
      fetchMock as unknown as typeof fetch,
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('exhausts retries on persistent 429', async () => {
    const responses = [
      createMockResponse({ status: 429 }),
      createMockResponse({ status: 429 }),
      createMockResponse({ status: 429 }),
      createMockResponse({ status: 429 }),
    ];
    const fetchMock = makeFetchMock(responses);

    await expect(
      fetchJson<{ data: string }>(
        { url: 'https://api.example.com/test', provider: 'open-meteo', retryCount: 3 },
        fetchMock as unknown as typeof fetch,
      ),
    ).rejects.toThrow();

    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('uses policy maxRetries when retryCount not specified', async () => {
    const responses = [
      createMockResponse({ status: 429 }),
      createMockResponse({ status: 429 }),
      createMockResponse({ status: 429 }),
      createMockResponse({ status: 200 }),
    ];
    const fetchMock = makeFetchMock(responses);

    const result = await fetchJson<{ data: string }>(
      { url: 'https://api.example.com/test', provider: 'open-meteo' },
      fetchMock as unknown as typeof fetch,
    );

    expect(result).toEqual({ data: 'ok' });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});

describe('timeout retry behavior', () => {
  it('retries timeout when policy allows (tomtom)', async () => {
    const items = [
      { _throw: createTimeoutError() },
      createMockResponse({ status: 200 }),
    ];
    const fetchMock = makeFetchMockMixed(items);

    const result = await fetchJson<{ data: string }>(
      { url: 'https://api.example.com/test', provider: 'tomtom' },
      fetchMock as unknown as typeof fetch,
    );

    expect(result).toEqual({ data: 'ok' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does NOT retry timeout when policy disallows (google-places)', async () => {
    const items = [{ _throw: createTimeoutError() }];
    const fetchMock = makeFetchMockMixed(items);

    await expect(
      fetchJson<{ data: string }>(
        { url: 'https://api.example.com/test', provider: 'google-places' },
        fetchMock as unknown as typeof fetch,
      ),
    ).rejects.toThrow();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries timeout with overpass policy', async () => {
    const items = [
      { _throw: createTimeoutError() },
      { _throw: createTimeoutError() },
      createMockResponse({ status: 200 }),
    ];
    const fetchMock = makeFetchMockMixed(items);

    const result = await fetchJson<{ data: string }>(
      { url: 'https://api.example.com/test', provider: 'overpass' },
      fetchMock as unknown as typeof fetch,
    );

    expect(result).toEqual({ data: 'ok' });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

describe('5xx classification and retry', () => {
  it('retries 503 when policy allows (open-meteo)', async () => {
    const responses = [
      createMockResponse({ status: 503 }),
      createMockResponse({ status: 200 }),
    ];
    const fetchMock = makeFetchMock(responses);

    const result = await fetchJson<{ data: string }>(
      { url: 'https://api.example.com/test', provider: 'open-meteo' },
      fetchMock as unknown as typeof fetch,
    );

    expect(result).toEqual({ data: 'ok' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does NOT retry 503 when policy disallows (google-places)', async () => {
    const responses = [
      createMockResponse({ status: 503 }),
      createMockResponse({ status: 200 }),
    ];
    const fetchMock = makeFetchMock(responses);

    await expect(
      fetchJson<{ data: string }>(
        { url: 'https://api.example.com/test', provider: 'google-places' },
        fetchMock as unknown as typeof fetch,
      ),
    ).rejects.toThrow();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries 500 with open-meteo policy', async () => {
    const responses = [
      createMockResponse({ status: 500 }),
      createMockResponse({ status: 200 }),
    ];
    const fetchMock = makeFetchMock(responses);

    const result = await fetchJson<{ data: string }>(
      { url: 'https://api.example.com/test', provider: 'open-meteo' },
      fetchMock as unknown as typeof fetch,
    );

    expect(result).toEqual({ data: 'ok' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('exhausts retries on persistent 503', async () => {
    const responses = [
      createMockResponse({ status: 503 }),
      createMockResponse({ status: 503 }),
      createMockResponse({ status: 503 }),
      createMockResponse({ status: 503 }),
    ];
    const fetchMock = makeFetchMock(responses);

    await expect(
      fetchJson<{ data: string }>(
        { url: 'https://api.example.com/test', provider: 'open-meteo', retryCount: 3 },
        fetchMock as unknown as typeof fetch,
      ),
    ).rejects.toThrow();

    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});

describe('provider-specific policy examples', () => {
  it('open-meteo retries 5xx but not timeout', async () => {
    const responses = [
      createMockResponse({ status: 502 }),
      createMockResponse({ status: 200 }),
    ];
    const fetchMock = makeFetchMock(responses);

    const result = await fetchJson<{ data: string }>(
      { url: 'https://api.example.com/test', provider: 'open-meteo' },
      fetchMock as unknown as typeof fetch,
    );

    expect(result).toEqual({ data: 'ok' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('mapillary retries 5xx and 429 but not timeout', async () => {
    const responses = [
      createMockResponse({ status: 500 }),
      createMockResponse({ status: 200 }),
    ];
    const fetchMock = makeFetchMock(responses);

    const result = await fetchJson<{ data: string }>(
      { url: 'https://api.example.com/test', provider: 'mapillary' },
      fetchMock as unknown as typeof fetch,
    );

    expect(result).toEqual({ data: 'ok' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('custom override policy takes precedence', async () => {
    const customPolicy: RetryPolicy = {
      retryOn: new Set(['rateLimit', 'timeout', 'serverError']),
      maxRetries: 5,
      backoffMs: () => 10,
    };

    const items = [
      { _throw: createTimeoutError() },
      createMockResponse({ status: 503 }),
      createMockResponse({ status: 200 }),
    ];
    const fetchMock = makeFetchMockMixed(items);

    const result = await fetchJson<{ data: string }>(
      {
        url: 'https://api.example.com/test',
        provider: 'google-places',
        policy: customPolicy,
      },
      fetchMock as unknown as typeof fetch,
    );

    expect(result).toEqual({ data: 'ok' });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

// ─── Phase 5.3 Circuit breaker state transitions ──

describe('normalizeProviderKey', () => {
  it('normalizes Open-Meteo Current Weather to open-meteo', () => {
    expect(normalizeProviderKey('Open-Meteo Current Weather')).toBe('open-meteo');
  });

  it('normalizes Open-Meteo Historical Weather to open-meteo', () => {
    expect(normalizeProviderKey('Open-Meteo Historical Weather')).toBe('open-meteo');
  });

  it('normalizes open-meteo to open-meteo', () => {
    expect(normalizeProviderKey('open-meteo')).toBe('open-meteo');
  });

  it('leaves other providers unchanged (lowercased)', () => {
    expect(normalizeProviderKey('google-places')).toBe('google-places');
    expect(normalizeProviderKey('Google-Places')).toBe('google-places');
  });
});

describe('CircuitBreaker', () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    vi.useFakeTimers();
    breaker = new CircuitBreaker('test-provider', {
      failureThreshold: 3,
      recoveryTimeoutMs: 100,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts in closed state', () => {
    expect(breaker.getState()).toBe('closed');
    expect(breaker.canExecute()).toBe(true);
  });

  it('transitions to open after failureThreshold consecutive failures', () => {
    breaker.recordFailure();
    expect(breaker.getState()).toBe('closed');
    breaker.recordFailure();
    expect(breaker.getState()).toBe('closed');
    breaker.recordFailure();
    expect(breaker.getState()).toBe('open');
    expect(breaker.canExecute()).toBe(false);
  });

  it('transitions to half-open after recoveryTimeoutMs', () => {
    breaker.recordFailure();
    breaker.recordFailure();
    breaker.recordFailure();
    expect(breaker.getState()).toBe('open');

    vi.advanceTimersByTime(100);

    expect(breaker.getState()).toBe('half-open');
    expect(breaker.canExecute()).toBe(true);
  });

  it('transitions from half-open to closed on success', () => {
    breaker.recordFailure();
    breaker.recordFailure();
    breaker.recordFailure();
    vi.advanceTimersByTime(100);
    expect(breaker.getState()).toBe('half-open');

    breaker.recordSuccess();

    expect(breaker.getState()).toBe('closed');
    expect(breaker.canExecute()).toBe(true);
  });

  it('transitions from half-open back to open on failure', () => {
    breaker.recordFailure();
    breaker.recordFailure();
    breaker.recordFailure();
    vi.advanceTimersByTime(100);
    expect(breaker.getState()).toBe('half-open');

    breaker.recordFailure();

    expect(breaker.getState()).toBe('open');
    expect(breaker.canExecute()).toBe(false);
  });

  it('resets consecutive failures on success in closed state', () => {
    breaker.recordFailure();
    breaker.recordFailure();
    breaker.recordSuccess();
    breaker.recordFailure();
    breaker.recordFailure();
    expect(breaker.getState()).toBe('closed');
    breaker.recordFailure();
    expect(breaker.getState()).toBe('open');
  });

  it('reports accurate stats', () => {
    breaker.recordFailure();
    breaker.recordSuccess();
    breaker.recordFailure();

    const stats = breaker.getStats();
    expect(stats.state).toBe('closed');
    expect(stats.consecutiveFailures).toBe(1);
    expect(stats.totalRequests).toBe(3);
    expect(stats.totalFailures).toBe(2);
    expect(stats.lastFailureAt).not.toBeNull();
  });

  it('can be reset manually', () => {
    breaker.recordFailure();
    breaker.recordFailure();
    breaker.recordFailure();
    expect(breaker.getState()).toBe('open');

    breaker.reset();

    expect(breaker.getState()).toBe('closed');
    expect(breaker.getStats().consecutiveFailures).toBe(0);
  });
});

describe('CircuitBreakerRegistry', () => {
  let registry: CircuitBreakerRegistry;

  beforeEach(() => {
    registry = new CircuitBreakerRegistry().withOptions({
      failureThreshold: 3,
      recoveryTimeoutMs: 100,
    });
  });

  it('returns same breaker instance for same normalized key', () => {
    const a = registry.get('Open-Meteo Current Weather');
    const b = registry.get('Open-Meteo Historical Weather');
    expect(a).toBe(b);
  });

  it('returns different breakers for different providers', () => {
    const a = registry.get('open-meteo');
    const b = registry.get('google-places');
    expect(a).not.toBe(b);
  });

  it('resets all breakers', () => {
    const om = registry.get('open-meteo');
    const gp = registry.get('google-places');
    om.recordFailure();
    om.recordFailure();
    om.recordFailure();
    gp.recordFailure();
    gp.recordFailure();
    gp.recordFailure();

    registry.resetAll();

    expect(om.getState()).toBe('closed');
    expect(gp.getState()).toBe('closed');
  });

  it('resets individual provider', () => {
    const om = registry.get('open-meteo');
    const gp = registry.get('google-places');
    om.recordFailure();
    om.recordFailure();
    om.recordFailure();
    gp.recordFailure();

    registry.reset('open-meteo');

    expect(om.getState()).toBe('closed');
    expect(gp.getState()).toBe('closed');
    expect(gp.getStats().consecutiveFailures).toBe(1);
  });
});

function getCircuitBreakerStateMetric(provider: string): number | undefined {
  const entries = appMetrics.snapshot().circuit_breaker_state ?? [];
  const entry = entries.find((item) => item.labels.provider === provider);
  return typeof entry?.value === 'number' ? entry.value : undefined;
}

function getCircuitBreakerRejectionMetric(provider: string): number | undefined {
  const entries = appMetrics.snapshot().circuit_breaker_rejections_total ?? [];
  const entry = entries.find((item) => item.labels.provider === provider);
  return typeof entry?.value === 'number' ? entry.value : undefined;
}

describe('circuit breaker metrics', () => {
  beforeEach(() => {
    appMetrics.reset();
    circuitBreakerRegistry.clear();
    circuitBreakerRegistry.withOptions({
      failureThreshold: 1,
      recoveryTimeoutMs: 1000,
    });
  });

  afterEach(() => {
    circuitBreakerRegistry.clear();
    appMetrics.reset();
  });

  it('publishes provider-scoped state for fetch failures and fast rejections', async () => {
    const provider = 'Overpass Metrics Test Provider';
    const providerKey = normalizeProviderKey(provider);
    const fetchMock = vi.fn(async () => new Response('fail', { status: 503 }));

    await expect(
      fetchJson<{ data: string }>(
        { url: 'https://api.example.com/test', provider, retryCount: 0 },
        fetchMock as unknown as typeof fetch,
      ),
    ).rejects.toThrow();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getCircuitBreakerStateMetric(providerKey)).toBe(2);
    expect(getCircuitBreakerRejectionMetric(providerKey)).toBeUndefined();

    await expect(
      fetchJson<{ data: string }>(
        { url: 'https://api.example.com/test', provider },
        fetchMock as unknown as typeof fetch,
      ),
    ).rejects.toThrow(CircuitBreakerOpenError);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getCircuitBreakerStateMetric(providerKey)).toBe(2);
    expect(getCircuitBreakerRejectionMetric(providerKey)).toBe(1);
  });
});

describe('fetchJson circuit breaker integration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    circuitBreakerRegistry.clear();
    circuitBreakerRegistry.withOptions({
      failureThreshold: 3,
      recoveryTimeoutMs: 100,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    circuitBreakerRegistry.clear();
  });

  it('fast-rejects when breaker is open', async () => {
    const fetchMock = vi.fn(async () => new Response('fail', { status: 503 }));

    // Trip the breaker: 3 separate requests that each fail with 503 (retryCount: 0)
    for (let i = 0; i < 3; i++) {
      await expect(
        fetchJson<{ data: string }>(
          { url: 'https://api.example.com/test', provider: 'open-meteo', retryCount: 0 },
          fetchMock as unknown as typeof fetch,
        ),
      ).rejects.toThrow();
    }

    // Now breaker should be open — fast reject
    await expect(
      fetchJson<{ data: string }>(
        { url: 'https://api.example.com/test', provider: 'open-meteo' },
        fetchMock as unknown as typeof fetch,
      ),
    ).rejects.toThrow(CircuitBreakerOpenError);

    // No additional fetch calls — breaker rejected immediately
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('does not trip breaker on non-retryable 4xx', async () => {
    const fetchMock = vi.fn(async () => new Response('bad', { status: 400 }));

    for (let i = 0; i < 5; i++) {
      await expect(
        fetchJson<{ data: string }>(
          { url: 'https://api.example.com/test', provider: 'open-meteo' },
          fetchMock as unknown as typeof fetch,
        ),
      ).rejects.toThrow();
    }

    // Breaker should still be closed — 400 is not retryable
    const stats = circuitBreakerRegistry.getStats('open-meteo');
    expect(stats?.state).toBe('closed');
  });

  it('recovers via half-open after recoveryTimeoutMs', async () => {
    const fetchMock = vi.fn(async () => new Response('fail', { status: 503 }));

    // Trip breaker with 3 failures
    for (let i = 0; i < 3; i++) {
      await expect(
        fetchJson<{ data: string }>(
          { url: 'https://api.example.com/test', provider: 'open-meteo', retryCount: 0 },
          fetchMock as unknown as typeof fetch,
        ),
      ).rejects.toThrow();
    }

    // Advance time past recovery timeout
    vi.advanceTimersByTime(100);

    // Next request should succeed and close the breaker
    fetchMock.mockImplementation(async () =>
      new Response(JSON.stringify({ data: 'ok' }), { status: 200 }),
    );

    const result = await fetchJson<{ data: string }>(
      { url: 'https://api.example.com/test', provider: 'open-meteo' },
      fetchMock as unknown as typeof fetch,
    );

    expect(result).toEqual({ data: 'ok' });
    const stats = circuitBreakerRegistry.getStats('open-meteo');
    expect(stats?.state).toBe('closed');
  });
});
