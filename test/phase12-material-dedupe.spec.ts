import { describe, expect, it } from 'bun:test';
import {
  buildMaterialCacheKey,
  computeMaterialReuseDiagnostics,
  installMaterialCache,
  type MaterialCacheStats,
} from '../src/assets/internal/glb-build/glb-build-material-cache';
import {
  FACADE_FRAME_OFFSET_FROM_SHELL,
  WINDOW_OFFSET_FROM_PANEL,
} from '../src/assets/compiler/building/building-mesh.facade-frame.utils';

describe('Phase 12 Material Cache — bucket normalization', () => {
  const sceneId = 'test-scene';
  const tuningSignature = 'default';

  it('maps #6d6a64 and #6e6b65 to the same cache bucket', () => {
    const key1 = buildMaterialCacheKey(
      sceneId,
      tuningSignature,
      'building-shell-concrete-#6d6a64',
    );
    const key2 = buildMaterialCacheKey(
      sceneId,
      tuningSignature,
      'building-shell-concrete-#6e6b65',
    );
    expect(key1).toBe(key2);
  });

  it('maps #6d6a64 and #2a3f8e to different cache buckets', () => {
    const key1 = buildMaterialCacheKey(
      sceneId,
      tuningSignature,
      'building-shell-concrete-#6d6a64',
    );
    const key2 = buildMaterialCacheKey(
      sceneId,
      tuningSignature,
      'building-shell-concrete-#2a3f8e',
    );
    expect(key1).not.toBe(key2);
  });

  it('passes known bucket names through without quantization', () => {
    const key = buildMaterialCacheKey(
      sceneId,
      tuningSignature,
      'building-shell-concrete-neutral-mid',
    );
    expect(key).toContain('neutral-mid');
  });

  it('normalizes panel colors by bucket', () => {
    const key1 = buildMaterialCacheKey(
      sceneId,
      tuningSignature,
      'building-panel-warm-#a08060',
    );
    const key2 = buildMaterialCacheKey(
      sceneId,
      tuningSignature,
      'building-panel-warm-#a18161',
    );
    expect(key1).toBe(key2);
  });

  it('normalizes billboard colors by bucket', () => {
    const key1 = buildMaterialCacheKey(
      sceneId,
      tuningSignature,
      'billboard-cool-#4a7ca7',
    );
    const key2 = buildMaterialCacheKey(
      sceneId,
      tuningSignature,
      'billboard-cool-#4b7da8',
    );
    expect(key1).toBe(key2);
  });

  it('falls back to full name for non-matching patterns', () => {
    const key = buildMaterialCacheKey(
      sceneId,
      tuningSignature,
      'some-other-material',
    );
    expect(key).toBe(`${sceneId}::${tuningSignature}::some-other-material`);
  });
});

describe('Phase 12 Material Cache — reuse diagnostics', () => {
  it('computes materialReuseRate from hits and misses', () => {
    const stats: MaterialCacheStats = { hits: 70, misses: 30 };
    const diag = computeMaterialReuseDiagnostics(stats);
    expect(diag.materialReuseRate).toBe(0.7);
    expect(diag.totalMaterialsCreated).toBe(100);
    expect(diag.uniqueMaterialKeys).toBe(30);
  });

  it('records instanced group and building counts', () => {
    const stats: MaterialCacheStats = { hits: 50, misses: 20 };
    const diag = computeMaterialReuseDiagnostics(stats, 5, 120);
    expect(diag.instancedGroupCount).toBe(5);
    expect(diag.instancedBuildingCount).toBe(120);
  });

  it('returns zero rate when no materials created', () => {
    const stats: MaterialCacheStats = { hits: 0, misses: 0 };
    const diag = computeMaterialReuseDiagnostics(stats);
    expect(diag.materialReuseRate).toBe(0);
  });
});

describe('Phase 12 Depth Bias — shell/panel/window ordering', () => {
  it('panel offset from shell is 0.02m', () => {
    expect(FACADE_FRAME_OFFSET_FROM_SHELL).toBe(0.02);
  });

  it('window offset from panel is 0.01m', () => {
    expect(WINDOW_OFFSET_FROM_PANEL).toBe(0.01);
  });

  it('total window offset from shell equals panel + window offset', () => {
    const totalWindowOffset = FACADE_FRAME_OFFSET_FROM_SHELL + WINDOW_OFFSET_FROM_PANEL;
    expect(totalWindowOffset).toBe(0.03);
  });
});

describe('Phase 12 Material Cache — installMaterialCache integration', () => {
  it('caches materials by normalized bucket key', () => {
    const stats: MaterialCacheStats = { hits: 0, misses: 0 };
    const createdMaterials: string[] = [];
    const doc = {
      createMaterial: (name: string) => {
        createdMaterials.push(name);
        return { name, setExtras: () => {} };
      },
    } as unknown as Record<string, unknown>;

    installMaterialCache(doc, 'scene-1', stats, 'default');

    const createMaterial = doc.createMaterial as (name: string) => unknown;

    createMaterial('building-shell-concrete-#6d6a64');
    createMaterial('building-shell-concrete-#6e6b65');
    createMaterial('building-shell-concrete-#2a3f8e');

    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(2);
    expect(createdMaterials.length).toBe(2);
  });
});
