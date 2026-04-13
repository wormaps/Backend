import { createHash } from 'node:crypto';
import { GeometryBuffers, Vec3 } from '../../compiler/road';
import { Coordinate } from '../../../places/types/place.types';
import {
  SceneCrossingDetail,
  SceneMeta,
} from '../../../scene/types/scene.types';
import {
  normalizeLocalRing as normalizeLocalRingUtil,
  signedAreaXZ as signedAreaXZUtil,
} from './geometry/glb-build-geometry-primitives.utils';
import { createCrosswalkGeometry as createCrosswalkGeometryUtil } from './geometry/glb-build-local-geometry.utils';

export function hashValue(value: unknown): string {
  return createHash('sha1').update(stableStringify(value)).digest('hex');
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

export function sortValue(value: unknown): unknown {
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

export function normalizeLocalRing(
  ring: Vec3[],
  direction: 'CW' | 'CCW',
): Vec3[] {
  return normalizeLocalRingUtil(ring, direction);
}

export function signedAreaXZ(points: Vec3[]): number {
  return signedAreaXZUtil(points);
}

export function createCrosswalkGeometry(
  origin: Coordinate,
  crossings: SceneCrossingDetail[],
  roads?: SceneMeta['roads'],
): GeometryBuffers {
  return createCrosswalkGeometryUtil(origin, crossings, roads);
}
