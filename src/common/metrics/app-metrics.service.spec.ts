import { describe, expect, it, beforeEach } from '@jest/globals';
import { appMetrics } from './metrics.instance';

describe('AppMetricsService', () => {
  beforeEach(() => {
    appMetrics.reset();
  });

  it('renders counters, gauges, and summaries in prometheus format', () => {
    appMetrics.incrementCounter('external_api_requests_total', 1, {
      provider: 'Google Places',
      outcome: 'success',
      statusClass: '2xx',
    });
    appMetrics.setGauge('cache_entries', 12);
    appMetrics.observeDuration('glb_build_duration_ms', 123.456, {
      outcome: 'success',
    });

    const output = appMetrics.renderPrometheus();

    expect(output).toContain('# TYPE external_api_requests_total counter');
    expect(output).toContain(
      'external_api_requests_total{outcome="success",provider="Google Places",statusClass="2xx"} 1',
    );
    expect(output).toContain('# TYPE cache_entries gauge');
    expect(output).toContain('cache_entries 12');
    expect(output).toContain('# TYPE glb_build_duration_ms summary');
    expect(output).toContain(
      'glb_build_duration_ms_count{outcome="success"} 1',
    );
    expect(output).toContain('glb_build_duration_ms_sum{outcome="success"} 123.456');
  });
});
