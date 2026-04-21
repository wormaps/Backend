import { ERROR_CODES } from '../../common/constants/error-codes';
import { AppException } from '../../common/errors/app.exception';
import type { StoredScene } from '../types/scene-api.types';

/**
 * Scene family assertion helpers.
 *
 * Focused on READY/read-contract critical fields only:
 * - sceneId presence & type
 * - status field validity
 * - meta / detail / place presence for READY scenes
 *
 * No external validation library — lightweight custom assertions.
 */

// ---------------------------------------------------------------------------
// Core assertion primitives
// ---------------------------------------------------------------------------

function assert(
  condition: boolean,
  code: keyof typeof ERROR_CODES,
  message: string,
  detail?: Record<string, unknown>,
): void {
  if (!condition) {
    throw new AppException({
      code: ERROR_CODES[code],
      message,
      detail: detail ?? null,
      status: 409,
    });
  }
}

function assertString(
  value: unknown,
  fieldName: string,
  sceneId?: string,
): asserts value is string {
  assert(
    typeof value === 'string' && value.length > 0,
    'SCENE_CORRUPT',
    `scene.${fieldName} is missing or empty`,
    { sceneId, field: fieldName, expectedType: 'non-empty string' },
  );
}

function assertNumber(
  value: unknown,
  fieldName: string,
  sceneId?: string,
): asserts value is number {
  assert(
    typeof value === 'number' && Number.isFinite(value),
    'SCENE_CORRUPT',
    `scene.${fieldName} is missing or not a finite number`,
    { sceneId, field: fieldName, expectedType: 'finite number' },
  );
}

function assertObject(
  value: unknown,
  fieldName: string,
  sceneId?: string,
): asserts value is Record<string, unknown> {
  assert(
    value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value),
    'SCENE_CORRUPT',
    `scene.${fieldName} is missing or not an object`,
    { sceneId, field: fieldName, expectedType: 'object' },
  );
}

// ---------------------------------------------------------------------------
// Scene entity assertions (critical fields for read-contract)
// ---------------------------------------------------------------------------

/**
 * Assert that the parsed scene entity has all critical fields required
 * for the read contract (sceneId, placeId, name, centerLat, centerLng,
 * radiusM, status, createdAt, updatedAt).
 */
export function assertSceneEntityIntegrity(
  scene: unknown,
  sourceLabel: string,
): void {
  assertObject(scene, 'scene');

  const obj = scene as Record<string, unknown>;
  const sceneId = obj.sceneId as string | undefined;

  assertString(obj.sceneId, 'sceneId', sceneId);
  assertString(obj.name, 'name', sceneId);
  assertString(obj.status, 'status', sceneId);
  assertString(obj.createdAt, 'createdAt', sceneId);
  assertString(obj.updatedAt, 'updatedAt', sceneId);
  assertNumber(obj.centerLat, 'centerLat', sceneId);
  assertNumber(obj.centerLng, 'centerLng', sceneId);
  assertNumber(obj.radiusM, 'radiusM', sceneId);

  // placeId may be null but must exist
  assert(
    'placeId' in obj,
    'SCENE_CORRUPT',
    'scene.placeId field is missing',
    { sceneId, field: 'placeId' },
  );
}

/**
 * Assert that a StoredScene has the critical fields required for a
 * READY scene: meta, detail, and place must all be present.
 */
export function assertReadySceneContract(
  stored: StoredScene,
): void {
  const sceneId = stored.scene?.sceneId ?? 'unknown';

  assert(
    stored.scene !== undefined && stored.scene !== null,
    'SCENE_CORRUPT',
    'storedScene.scene is missing',
    { sceneId },
  );

  assert(
    stored.scene.status === 'READY',
    'SCENE_CORRUPT',
    `storedScene.scene.status is "${stored.scene.status}", expected "READY"`,
    { sceneId, actualStatus: stored.scene.status },
  );

  assert(
    stored.meta !== undefined && stored.meta !== null,
    'SCENE_CORRUPT',
    'storedScene.meta is missing for READY scene',
    { sceneId },
  );

  assert(
    stored.detail !== undefined && stored.detail !== null,
    'SCENE_CORRUPT',
    'storedScene.detail is missing for READY scene',
    { sceneId },
  );

  assert(
    stored.place !== undefined && stored.place !== null,
    'SCENE_CORRUPT',
    'storedScene.place is missing for READY scene',
    { sceneId },
  );
}

/**
 * Assert that a meta object has the critical fields required by the
 * read contract: sceneId, placeId, name, generatedAt, origin, bounds,
 * stats, detailStatus, roads, buildings, walkways, pois.
 */
export function assertSceneMetaIntegrity(
  meta: unknown,
  sceneId?: string,
): void {
  assertObject(meta, 'meta', sceneId);
  const obj = meta as Record<string, unknown>;

  assertString(obj.sceneId, 'meta.sceneId', sceneId);
  assertString(obj.placeId, 'meta.placeId', sceneId);
  assertString(obj.name, 'meta.name', sceneId);
  assertString(obj.generatedAt, 'meta.generatedAt', sceneId);
  assertObject(obj.origin, 'meta.origin', sceneId);
  assertObject(obj.bounds, 'meta.bounds', sceneId);
  assertObject(obj.stats, 'meta.stats', sceneId);
  assertString(obj.detailStatus, 'meta.detailStatus', sceneId);

  assert(
    Array.isArray(obj.roads),
    'SCENE_CORRUPT',
    'meta.roads is not an array',
    { sceneId, field: 'meta.roads' },
  );
  assert(
    Array.isArray(obj.buildings),
    'SCENE_CORRUPT',
    'meta.buildings is not an array',
    { sceneId, field: 'meta.buildings' },
  );
  assert(
    Array.isArray(obj.walkways),
    'SCENE_CORRUPT',
    'meta.walkways is not an array',
    { sceneId, field: 'meta.walkways' },
  );
  assert(
    Array.isArray(obj.pois),
    'SCENE_CORRUPT',
    'meta.pois is not an array',
    { sceneId, field: 'meta.pois' },
  );
}

/**
 * Assert that a detail object has the critical fields required by the
 * read contract: sceneId, placeId, generatedAt, detailStatus, crossings,
 * streetFurniture, vegetation, facadeHints, provenance.
 */
export function assertSceneDetailIntegrity(
  detail: unknown,
  sceneId?: string,
): void {
  assertObject(detail, 'detail', sceneId);
  const obj = detail as Record<string, unknown>;

  assertString(obj.sceneId, 'detail.sceneId', sceneId);
  assertString(obj.placeId, 'detail.placeId', sceneId);
  assertString(obj.generatedAt, 'detail.generatedAt', sceneId);
  assertString(obj.detailStatus, 'detail.detailStatus', sceneId);

  assert(
    Array.isArray(obj.crossings),
    'SCENE_CORRUPT',
    'detail.crossings is not an array',
    { sceneId, field: 'detail.crossings' },
  );
  assert(
    Array.isArray(obj.streetFurniture),
    'SCENE_CORRUPT',
    'detail.streetFurniture is not an array',
    { sceneId, field: 'detail.streetFurniture' },
  );
  assert(
    Array.isArray(obj.vegetation),
    'SCENE_CORRUPT',
    'detail.vegetation is not an array',
    { sceneId, field: 'detail.vegetation' },
  );
  assert(
    Array.isArray(obj.facadeHints),
    'SCENE_CORRUPT',
    'detail.facadeHints is not an array',
    { sceneId, field: 'detail.facadeHints' },
  );
  assertObject(obj.provenance, 'detail.provenance', sceneId);
}
