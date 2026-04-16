import { Injectable } from '@nestjs/common';

type MetricType = 'counter' | 'gauge' | 'summary';

type MetricLabels = Record<string, string | number | boolean>;

interface SummaryMetricValue {
  count: number;
  sum: number;
  min: number;
  max: number;
}

interface MetricDefinition {
  help: string;
  type: MetricType;
  values: Map<string, number | SummaryMetricValue>;
}

@Injectable()
export class AppMetricsService {
  private readonly metrics = new Map<string, MetricDefinition>();

  incrementCounter(
    name: string,
    value = 1,
    labels: MetricLabels = {},
    help = '',
  ): void {
    const metric = this.ensureMetric(name, 'counter', help);
    const key = serializeLabels(labels);
    const current = (metric.values.get(key) as number | undefined) ?? 0;
    metric.values.set(key, current + value);
  }

  setGauge(
    name: string,
    value: number,
    labels: MetricLabels = {},
    help = '',
  ): void {
    const metric = this.ensureMetric(name, 'gauge', help);
    metric.values.set(serializeLabels(labels), value);
  }

  observeDuration(
    name: string,
    value: number,
    labels: MetricLabels = {},
    help = '',
  ): void {
    const metric = this.ensureMetric(name, 'summary', help);
    const key = serializeLabels(labels);
    const current =
      (metric.values.get(key) as SummaryMetricValue | undefined) ??
      {
        count: 0,
        sum: 0,
        min: Number.POSITIVE_INFINITY,
        max: Number.NEGATIVE_INFINITY,
      };
    current.count += 1;
    current.sum += value;
    current.min = Math.min(current.min, value);
    current.max = Math.max(current.max, value);
    metric.values.set(key, current);
  }

  renderPrometheus(): string {
    const lines: string[] = [];
    for (const [name, metric] of this.metrics.entries()) {
      if (metric.help) {
        lines.push(`# HELP ${name} ${metric.help}`);
      }
      lines.push(`# TYPE ${name} ${metric.type}`);
      for (const [labelKey, value] of metric.values.entries()) {
        const labels = parseLabelKey(labelKey);
        if (metric.type === 'summary') {
          const summary = value as SummaryMetricValue;
          lines.push(
            `${name}_count${formatLabels(labels)} ${summary.count}`,
            `${name}_sum${formatLabels(labels)} ${roundMetric(summary.sum)}`,
            `${name}_min${formatLabels(labels)} ${
              summary.count > 0 ? roundMetric(summary.min) : 0
            }`,
            `${name}_max${formatLabels(labels)} ${
              summary.count > 0 ? roundMetric(summary.max) : 0
            }`,
          );
          continue;
        }

        lines.push(`${name}${formatLabels(labels)} ${roundMetric(value as number)}`);
      }
    }
    return `${lines.join('\n')}\n`;
  }

  reset(): void {
    this.metrics.clear();
  }

  snapshot(): Record<
    string,
    Array<{
      labels: MetricLabels;
      value: number | SummaryMetricValue;
    }>
  > {
    const snapshot: Record<
      string,
      Array<{
        labels: MetricLabels;
        value: number | SummaryMetricValue;
      }>
    > = {};
    for (const [name, metric] of this.metrics.entries()) {
      snapshot[name] = [...metric.values.entries()].map(([labelKey, value]) => ({
        labels: parseLabelKey(labelKey),
        value:
          metric.type === 'summary'
            ? {
                ...(value as SummaryMetricValue),
              }
            : (value as number),
      }));
    }
    return snapshot;
  }

  private ensureMetric(
    name: string,
    type: MetricType,
    help: string,
  ): MetricDefinition {
    const existing = this.metrics.get(name);
    if (existing) {
      if (existing.type !== type) {
        throw new Error(`Metric type mismatch for ${name}`);
      }
      return existing;
    }

    const created: MetricDefinition = {
      help,
      type,
      values: new Map(),
    };
    this.metrics.set(name, created);
    return created;
  }
}

function serializeLabels(labels: MetricLabels): string {
  return Object.entries(labels)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${String(value)}`)
    .join('|');
}

function parseLabelKey(labelKey: string): MetricLabels {
  if (!labelKey) {
    return {};
  }

  return Object.fromEntries(
    labelKey.split('|').map((item) => {
      const [key, value] = item.split('=');
      return [key ?? '', value ?? ''];
    }),
  );
}

function formatLabels(labels: MetricLabels): string {
  const entries = Object.entries(labels).sort(([a], [b]) => a.localeCompare(b));
  if (entries.length === 0) {
    return '';
  }
  return `{${entries
    .map(([key, value]) => `${key}="${escapeLabelValue(String(value))}"`)
    .join(',')}}`;
}

function escapeLabelValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/"/g, '\\"');
}

function roundMetric(value: number): number {
  return Number.isInteger(value) ? value : Number(value.toFixed(3));
}
