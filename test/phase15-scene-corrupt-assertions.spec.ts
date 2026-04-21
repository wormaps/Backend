import { describe, expect, it } from 'bun:test';
import {
  assertSceneEntityIntegrity,
  assertReadySceneContract,
  assertSceneMetaIntegrity,
  assertSceneDetailIntegrity,
} from '../src/scene/utils/scene-assertions.utils';
import { AppException } from '../src/common/errors/app.exception';
import { ERROR_CODES } from '../src/common/constants/error-codes';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function validSceneEntity(): Record<string, unknown> {
  return {
    sceneId: 'scene-001',
    placeId: 'place-001',
    name: 'Test Scene',
    centerLat: 35.6595,
    centerLng: 139.7004,
    radiusM: 500,
    status: 'READY',
    metaUrl: '/api/scenes/scene-001/meta',
    assetUrl: null,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
  };
}

function validMeta(): Record<string, unknown> {
  return {
    sceneId: 'scene-001',
    placeId: 'place-001',
    name: 'Test Scene',
    generatedAt: '2025-01-01T00:00:00.000Z',
    origin: { lat: 35.6595, lng: 139.7004 },
    bounds: {
      radiusM: 500,
      northEast: { lat: 35.664, lng: 139.705 },
      southWest: { lat: 35.655, lng: 139.695 },
    },
    stats: { buildingCount: 10, roadCount: 5, walkwayCount: 2, poiCount: 3 },
    detailStatus: 'FULL',
    roads: [],
    buildings: [],
    walkways: [],
    pois: [],
  };
}

function validDetail(): Record<string, unknown> {
  return {
    sceneId: 'scene-001',
    placeId: 'place-001',
    generatedAt: '2025-01-01T00:00:00.000Z',
    detailStatus: 'FULL',
    crossings: [],
    roadMarkings: [],
    streetFurniture: [],
    vegetation: [],
    landCovers: [],
    linearFeatures: [],
    facadeHints: [],
    signageClusters: [],
    provenance: {
      mapillaryUsed: false,
      mapillaryImageCount: 0,
      mapillaryFeatureCount: 0,
      osmTagCoverage: {
        coloredBuildings: 0,
        materialBuildings: 0,
        crossings: 0,
        streetFurniture: 0,
        vegetation: 0,
      },
      overrideCount: 0,
    },
    annotationsApplied: [],
  };
}

function validStoredScene(): Record<string, unknown> {
  return {
    requestKey: 'rk-001',
    query: 'shibuya',
    scene: validSceneEntity(),
    meta: validMeta(),
    detail: validDetail(),
    place: {
      placeId: 'place-001',
      name: 'Test Place',
      formattedAddress: 'Tokyo, Japan',
      location: { lat: 35.6595, lng: 139.7004 },
    },
  };
}

// ---------------------------------------------------------------------------
// assertSceneEntityIntegrity
// ---------------------------------------------------------------------------

describe('assertSceneEntityIntegrity', () => {
  it('passes for a valid scene entity', () => {
    expect(() => assertSceneEntityIntegrity(validSceneEntity(), 'test')).not.toThrow();
  });

  it('throws SCENE_CORRUPT when scene is null', () => {
    try {
      assertSceneEntityIntegrity(null, 'test');
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(AppException);
      expect((e as AppException).code).toBe(ERROR_CODES.SCENE_CORRUPT);
    }
  });

  it('throws SCENE_CORRUPT when scene is not an object', () => {
    try {
      assertSceneEntityIntegrity('not-an-object', 'test');
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(AppException);
      expect((e as AppException).code).toBe(ERROR_CODES.SCENE_CORRUPT);
    }
  });

  it('throws SCENE_CORRUPT when sceneId is missing', () => {
    const scene = validSceneEntity();
    delete scene.sceneId;
    try {
      assertSceneEntityIntegrity(scene, 'test');
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(AppException);
      expect((e as AppException).code).toBe(ERROR_CODES.SCENE_CORRUPT);
    }
  });

  it('throws SCENE_CORRUPT when sceneId is empty string', () => {
    const scene = { ...validSceneEntity(), sceneId: '' };
    try {
      assertSceneEntityIntegrity(scene, 'test');
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(AppException);
      expect((e as AppException).code).toBe(ERROR_CODES.SCENE_CORRUPT);
    }
  });

  it('throws SCENE_CORRUPT when name is missing', () => {
    const scene = validSceneEntity();
    delete scene.name;
    try {
      assertSceneEntityIntegrity(scene, 'test');
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(AppException);
      expect((e as AppException).code).toBe(ERROR_CODES.SCENE_CORRUPT);
    }
  });

  it('throws SCENE_CORRUPT when centerLat is not a number', () => {
    const scene = { ...validSceneEntity(), centerLat: 'not-a-number' };
    try {
      assertSceneEntityIntegrity(scene, 'test');
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(AppException);
      expect((e as AppException).code).toBe(ERROR_CODES.SCENE_CORRUPT);
    }
  });

  it('throws SCENE_CORRUPT when centerLat is NaN', () => {
    const scene = { ...validSceneEntity(), centerLat: NaN };
    try {
      assertSceneEntityIntegrity(scene, 'test');
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(AppException);
      expect((e as AppException).code).toBe(ERROR_CODES.SCENE_CORRUPT);
    }
  });

  it('throws SCENE_CORRUPT when radiusM is missing', () => {
    const scene = validSceneEntity();
    delete scene.radiusM;
    try {
      assertSceneEntityIntegrity(scene, 'test');
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(AppException);
      expect((e as AppException).code).toBe(ERROR_CODES.SCENE_CORRUPT);
    }
  });

  it('throws SCENE_CORRUPT when createdAt is missing', () => {
    const scene = validSceneEntity();
    delete scene.createdAt;
    try {
      assertSceneEntityIntegrity(scene, 'test');
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(AppException);
      expect((e as AppException).code).toBe(ERROR_CODES.SCENE_CORRUPT);
    }
  });

  it('throws SCENE_CORRUPT when placeId field is missing entirely', () => {
    const scene = validSceneEntity();
    delete scene.placeId;
    try {
      assertSceneEntityIntegrity(scene, 'test');
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(AppException);
      expect((e as AppException).code).toBe(ERROR_CODES.SCENE_CORRUPT);
    }
  });

  it('passes when placeId is null (allowed)', () => {
    const scene = { ...validSceneEntity(), placeId: null };
    expect(() => assertSceneEntityIntegrity(scene, 'test')).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// assertReadySceneContract
// ---------------------------------------------------------------------------

describe('assertReadySceneContract', () => {
  it('passes for a valid READY stored scene', () => {
    expect(() => assertReadySceneContract(validStoredScene() as never)).not.toThrow();
  });

  it('throws SCENE_CORRUPT when scene is missing', () => {
    const stored = validStoredScene();
    delete stored.scene;
    try {
      assertReadySceneContract(stored as never);
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(AppException);
      expect((e as AppException).code).toBe(ERROR_CODES.SCENE_CORRUPT);
    }
  });

  it('throws SCENE_CORRUPT when status is not READY', () => {
    const stored = validStoredScene();
    (stored.scene as Record<string, unknown>).status = 'PENDING';
    try {
      assertReadySceneContract(stored as never);
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(AppException);
      expect((e as AppException).code).toBe(ERROR_CODES.SCENE_CORRUPT);
    }
  });

  it('throws SCENE_CORRUPT when meta is missing', () => {
    const stored = validStoredScene();
    delete stored.meta;
    try {
      assertReadySceneContract(stored as never);
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(AppException);
      expect((e as AppException).code).toBe(ERROR_CODES.SCENE_CORRUPT);
    }
  });

  it('throws SCENE_CORRUPT when detail is missing', () => {
    const stored = validStoredScene();
    delete stored.detail;
    try {
      assertReadySceneContract(stored as never);
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(AppException);
      expect((e as AppException).code).toBe(ERROR_CODES.SCENE_CORRUPT);
    }
  });

  it('throws SCENE_CORRUPT when place is missing', () => {
    const stored = validStoredScene();
    delete stored.place;
    try {
      assertReadySceneContract(stored as never);
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(AppException);
      expect((e as AppException).code).toBe(ERROR_CODES.SCENE_CORRUPT);
    }
  });
});

// ---------------------------------------------------------------------------
// assertSceneMetaIntegrity
// ---------------------------------------------------------------------------

describe('assertSceneMetaIntegrity', () => {
  it('passes for a valid meta object', () => {
    const meta = validMeta();
    expect(() => assertSceneMetaIntegrity(meta, 'scene-001')).not.toThrow();
  });

  it('throws SCENE_CORRUPT when meta is null', () => {
    try {
      assertSceneMetaIntegrity(null, 'scene-001');
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(AppException);
      expect((e as AppException).code).toBe(ERROR_CODES.SCENE_CORRUPT);
    }
  });

  it('throws SCENE_CORRUPT when roads is not an array', () => {
    const meta = { ...validMeta(), roads: 'not-array' };
    try {
      assertSceneMetaIntegrity(meta, 'scene-001');
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(AppException);
      expect((e as AppException).code).toBe(ERROR_CODES.SCENE_CORRUPT);
    }
  });

  it('throws SCENE_CORRUPT when buildings is not an array', () => {
    const meta = { ...validMeta(), buildings: 'not-array' };
    try {
      assertSceneMetaIntegrity(meta, 'scene-001');
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(AppException);
      expect((e as AppException).code).toBe(ERROR_CODES.SCENE_CORRUPT);
    }
  });

  it('throws SCENE_CORRUPT when generatedAt is missing', () => {
    const meta = validMeta();
    const broken = { ...meta };
    delete (broken as Record<string, unknown>).generatedAt;
    try {
      assertSceneMetaIntegrity(broken, 'scene-001');
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(AppException);
      expect((e as AppException).code).toBe(ERROR_CODES.SCENE_CORRUPT);
    }
  });
});

// ---------------------------------------------------------------------------
// assertSceneDetailIntegrity
// ---------------------------------------------------------------------------

describe('assertSceneDetailIntegrity', () => {
  it('passes for a valid detail object', () => {
    const detail = validDetail();
    expect(() => assertSceneDetailIntegrity(detail, 'scene-001')).not.toThrow();
  });

  it('throws SCENE_CORRUPT when detail is null', () => {
    try {
      assertSceneDetailIntegrity(null, 'scene-001');
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(AppException);
      expect((e as AppException).code).toBe(ERROR_CODES.SCENE_CORRUPT);
    }
  });

  it('throws SCENE_CORRUPT when crossings is not an array', () => {
    const detail = { ...validDetail(), crossings: 'not-array' };
    try {
      assertSceneDetailIntegrity(detail, 'scene-001');
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(AppException);
      expect((e as AppException).code).toBe(ERROR_CODES.SCENE_CORRUPT);
    }
  });

  it('throws SCENE_CORRUPT when provenance is missing', () => {
    const detail = validDetail();
    const broken = { ...detail };
    delete (broken as Record<string, unknown>).provenance;
    try {
      assertSceneDetailIntegrity(broken, 'scene-001');
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(AppException);
      expect((e as AppException).code).toBe(ERROR_CODES.SCENE_CORRUPT);
    }
  });

  it('throws SCENE_CORRUPT when facadeHints is not an array', () => {
    const detail = { ...validDetail(), facadeHints: 'not-array' };
    try {
      assertSceneDetailIntegrity(detail, 'scene-001');
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(AppException);
      expect((e as AppException).code).toBe(ERROR_CODES.SCENE_CORRUPT);
    }
  });
});

// ---------------------------------------------------------------------------
// Error code existence
// ---------------------------------------------------------------------------

describe('ERROR_CODES.SCENE_CORRUPT', () => {
  it('is defined as SCENE_CORRUPT', () => {
    expect(ERROR_CODES.SCENE_CORRUPT).toBe('SCENE_CORRUPT');
  });
});
