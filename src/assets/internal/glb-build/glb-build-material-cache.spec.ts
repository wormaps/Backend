import { buildMaterialCacheKey } from './glb-build-material-cache';

describe('glb-build-material-cache', () => {
  it('includes tuning signature in the cache key', () => {
    const keyA = buildMaterialCacheKey(
      'scene-1',
      'tuning-a',
      'building-shell-glass-cool-light',
    );
    const keyB = buildMaterialCacheKey(
      'scene-1',
      'tuning-b',
      'building-shell-glass-cool-light',
    );

    expect(keyA).not.toBe(keyB);
    expect(keyA).toContain('tuning-a');
    expect(keyB).toContain('tuning-b');
  });
});
