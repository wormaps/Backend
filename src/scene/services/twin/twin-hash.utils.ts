import { createHash } from 'node:crypto';
import type { Coordinate } from '../../../places/types/place.types';
import type {
  TwinPropertyOrigin,
  ValidationGateResult,
  ValidationReport,
} from '../../types/scene.types';

export function hashValue(value: unknown): string {
  return createHash('sha1').update(stableStringify(value)).digest('hex');
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => sortValue(entry));
  }
  if (value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = sortValue((value as Record<string, unknown>)[key]);
        return acc;
      }, {});
  }
  return value;
}

export function roundMetric(value: number): number {
  return Math.round(value * 100) / 100;
}

export function roundConfidence(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function resolveCoordinateCenter(points: Coordinate[]): Coordinate {
  if (points.length === 0) {
    return { lat: 0, lng: 0 };
  }

  const totals = points.reduce(
    (acc, point) => ({
      lat: acc.lat + point.lat,
      lng: acc.lng + point.lng,
    }),
    { lat: 0, lng: 0 },
  );

  return {
    lat: totals.lat / points.length,
    lng: totals.lng / points.length,
  };
}

export function resolveEvidenceConfidence(
  strength: 'none' | 'weak' | 'medium' | 'strong' | undefined,
): number {
  switch (strength) {
    case 'strong':
      return 0.9;
    case 'medium':
      return 0.7;
    case 'weak':
      return 0.4;
    case 'none':
      return 0.2;
    default:
      return 0.25;
  }
}

export function resolveGateSummary(
  gates: ValidationGateResult[],
): ValidationReport['summary'] {
  if (gates.some((gate) => gate.state === 'FAIL')) {
    return 'FAIL';
  }
  if (gates.some((gate) => gate.state === 'WARN')) {
    return 'WARN';
  }
  return 'PASS';
}
