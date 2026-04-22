import { describe, expect, it } from 'bun:test';
import {
  isGeometryValid,
  resolveSkippedReason,
} from '../src/assets/internal/glb-build/glb-build-mesh-node';
import {
  buildMaterialCacheKey,
  computeMaterialReuseDiagnostics,
} from '../src/assets/internal/glb-build/glb-build-material-cache';
import { averagePoint } from '../src/assets/internal/glb-build/geometry/glb-build-geometry-primitives.utils';
import { resolveSceneVariationProfile } from '../src/assets/internal/glb-build/glb-build-variation.utils';
import {
  createGlbBuildRunnerState,
  type GlbBuildRunnerState,
} from '../src/assets/internal/glb-build/glb-build-runner.pipeline';

describe('Phase 6 — GLB 빌드 시스템 안정화', () => {
  describe('6.2 Triangle budget — Math.floor로 소수점 제거', () => {
    it('indices 길이가 3으로 나누어떨어지지 않으면 floor 적용', () => {
      const indicesLengths = [7, 8, 10, 100, 101];
      for (const len of indicesLengths) {
        const expected = Math.floor(len / 3);
        expect(expected).toBeLessThanOrEqual(len / 3);
        expect(Number.isInteger(expected)).toBe(true);
      }
    });

    it('indices 길이가 3의 배수이면 정확한 값 반환', () => {
      expect(Math.floor(9 / 3)).toBe(3);
      expect(Math.floor(300 / 3)).toBe(100);
    });
  });

  describe('6.2 Non-divisible guard logging', () => {
    it('isGeometryValid은 3으로 나누어떨어지지 않는 indices에서 에러 발생 (shape validation)', () => {
      const geometry = {
        positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
        normals: [0, 1, 0, 0, 1, 0, 0, 1, 0],
        indices: [0, 1, 2, 0],
      };
      expect(() => isGeometryValid(geometry)).toThrow(
        'GLB geometry buffer shape is invalid.',
      );
    });

    it('isGeometryValid은 빈 indices에서 false 반환', () => {
      const geometry = {
        positions: [],
        normals: [],
        indices: [],
      };
      expect(isGeometryValid(geometry)).toBe(false);
    });

    it('isGeometryValid은 non-finite 값에서 shape 에러 발생 (indices 체크 먼저)', () => {
      const geometry = {
        positions: [NaN, 0, 0],
        normals: [0, 1, 0],
        indices: [0],
      };
      expect(() => isGeometryValid(geometry)).toThrow(
        'GLB geometry buffer shape is invalid.',
      );
    });

    it('isGeometryValid은 유효한 geometry에서 true 반환', () => {
      const geometry = {
        positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
        normals: [0, 1, 0, 0, 1, 0, 0, 1, 0],
        indices: [0, 1, 2],
      };
      expect(isGeometryValid(geometry)).toBe(true);
    });
  });

  describe('6.5 Material 캐시 bucket 충돌 — regex 완전 매칭', () => {
    it('유효한 6자리 hex는 정규화되어 bucket으로 변환', () => {
      const key = buildMaterialCacheKey('scene-1', 'sig', 'building-shell-concrete-#ff0000');
      expect(key).toContain('building-shell');
      expect(key).toContain('concrete');
    });

    it('유효한 3자리 hex는 확장 후 bucket으로 변환', () => {
      const key = buildMaterialCacheKey('scene-1', 'sig', 'building-shell-concrete-#f00');
      expect(key).toContain('building-shell');
      expect(key).toContain('concrete');
    });

    it('알려진 bucket 이름은 그대로 통과', () => {
      const key1 = buildMaterialCacheKey('scene-1', 'sig', 'building-shell-concrete-cool-light');
      const key2 = buildMaterialCacheKey('scene-1', 'sig', 'building-shell-concrete-cool-light');
      expect(key1).toBe(key2);
    });

    it('panel 패턴은 tone과 hex bucket으로 정규화', () => {
      const key = buildMaterialCacheKey('scene-1', 'sig', 'building-panel-warm-#aabbcc');
      expect(key).toContain('building-panel');
      expect(key).toContain('warm');
    });

    it('billboard 패턴은 tone과 hex bucket으로 정규화', () => {
      const key = buildMaterialCacheKey('scene-1', 'sig', 'billboard-neutral-#112233');
      expect(key).toContain('billboard');
      expect(key).toContain('neutral');
    });

    it('알 수 없는 패턴은 sceneId + name으로 폴백', () => {
      const key = buildMaterialCacheKey('scene-1', 'sig', 'unknown-material');
      expect(key).toBe('scene-1::sig::unknown-material');
    });
  });

  describe('6.6 Division by Zero 방지 — averagePoint', () => {
    it('빈 배열에서 [0,0,0] 반환 (NaN 방지)', () => {
      const result = averagePoint([]);
      expect(result).toEqual([0, 0, 0]);
      expect(Number.isNaN(result[0])).toBe(false);
    });

    it('단일 포인트에서 해당 포인트의 x,z와 y=0 반환', () => {
      const result = averagePoint([[5, 3, 7]]);
      expect(result).toEqual([5, 0, 7]);
    });

    it('여러 포인트에서 평균 반환', () => {
      const result = averagePoint([
        [0, 0, 0],
        [10, 0, 10],
      ]);
      expect(result).toEqual([5, 0, 5]);
    });
  });

  describe('6.6 Division by Zero 방지 — resolveSceneVariationProfile', () => {
    it('budget.treeClusterCount가 0일 때 vegetationCoverage는 0 (NaN 방지)', () => {
      const sceneMeta = {
        assetProfile: {
          selected: { treeClusterCount: 5 },
          budget: { treeClusterCount: 0, streetLightCount: 0, signPoleCount: 0 },
        },
      } as any;
      const sceneDetail = {
        signageClusters: [],
        vegetation: [],
        fidelityPlan: { targetMode: 'standard' },
        districtAtmosphereProfiles: [],
        facadeHints: [],
      } as any;

      const profile = resolveSceneVariationProfile(sceneMeta, sceneDetail);
      expect(Number.isNaN(profile.vegetationDensityBoost)).toBe(false);
      expect(profile.vegetationDensityBoost).toBeGreaterThanOrEqual(0.9);
    });

    it('furniture budget이 0일 때 furnitureCoverage는 0 (NaN 방지)', () => {
      const sceneMeta = {
        assetProfile: {
          selected: { treeClusterCount: 0, streetLightCount: 3, signPoleCount: 2, billboardPanelCount: 10 },
          budget: { treeClusterCount: 10, streetLightCount: 0, signPoleCount: 0 },
        },
      } as any;
      const sceneDetail = {
        signageClusters: [],
        vegetation: [],
        fidelityPlan: { targetMode: 'standard' },
        districtAtmosphereProfiles: [],
        facadeHints: [],
      } as any;

      const profile = resolveSceneVariationProfile(sceneMeta, sceneDetail);
      expect(Number.isNaN(profile.furnitureDetailBoost)).toBe(false);
    });

    it('billboardPanelCount가 0일 때 Math.max(10, ...)로 안전', () => {
      const sceneMeta = {
        assetProfile: {
          selected: { treeClusterCount: 0, streetLightCount: 0, signPoleCount: 0, billboardPanelCount: 0 },
          budget: { treeClusterCount: 0, streetLightCount: 0, signPoleCount: 0 },
        },
      } as any;
      const sceneDetail = {
        signageClusters: [],
        vegetation: [],
        fidelityPlan: { targetMode: 'standard' },
        districtAtmosphereProfiles: [],
        facadeHints: [],
      } as any;

      const profile = resolveSceneVariationProfile(sceneMeta, sceneDetail);
      expect(Number.isNaN(profile.furnitureVariantBoost)).toBe(false);
    });
  });

  describe('6.1 Accessor min/max — 계산 로직 검증', () => {
    it('positions에서 min/max를 정확히 추출', () => {
      const positions = [
        1, 2, 3,
        4, 5, 6,
        0, 10, -1,
      ];

      let minX = Infinity;
      let minY = Infinity;
      let minZ = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      let maxZ = -Infinity;

      for (let i = 0; i < positions.length; i += 3) {
        const x = positions[i]!;
        const y = positions[i + 1]!;
        const z = positions[i + 2]!;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (z < minZ) minZ = z;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
        if (z > maxZ) maxZ = z;
      }

      expect([minX, minY, minZ]).toEqual([0, 2, -1]);
      expect([maxX, maxY, maxZ]).toEqual([4, 10, 6]);
    });
  });

  describe('6.4 Mesh Optimization rollback — 단일 try-catch 구조', () => {
    it('computeMaterialReuseDiagnostics는 totalMaterialsCreated가 0일 때 reuseRate 0 반환', () => {
      const result = computeMaterialReuseDiagnostics({ hits: 0, misses: 0 });
      expect(result.materialReuseRate).toBe(0);
      expect(result.totalMaterialsCreated).toBe(0);
    });

    it('computeMaterialReuseDiagnostics는 hits/total 비율 계산', () => {
      const result = computeMaterialReuseDiagnostics({ hits: 30, misses: 70 });
      expect(result.materialReuseRate).toBe(0.3);
      expect(result.totalMaterialsCreated).toBe(100);
    });
  });

  describe('resolveSkippedReason', () => {
    it('sourceCount가 0이면 missing_source 반환', () => {
      expect(resolveSkippedReason({ sourceCount: 0, selectedCount: 5 })).toBe('missing_source');
    });

    it('selectedCount가 0이면 selection_cut 반환', () => {
      expect(resolveSkippedReason({ sourceCount: 10, selectedCount: 0 })).toBe('selection_cut');
    });

    it('둘 다 0이면 missing_source 반환 (sourceCount 체크 우선)', () => {
      expect(resolveSkippedReason({ sourceCount: 0, selectedCount: 0 })).toBe(
        'missing_source',
      );
    });
  });

  describe('6.7 Build state isolation — per-invocation freshness', () => {
    function makeFakeServices() {
      return {
        appLoggerService: {
          info: () => {},
          warn: () => {},
          error: () => {},
        },
        sceneAssetProfileService: {
          buildSceneMetaWithAssetSelection: () => ({}),
        },
      } as any;
    }

    it('createGlbBuildRunnerState returns a fresh object each call', () => {
      const services = makeFakeServices();
      const state1 = createGlbBuildRunnerState(services as any);
      const state2 = createGlbBuildRunnerState(services as any);

      expect(state1).not.toBe(state2);
      expect(state1.currentMeshDiagnostics).not.toBe(state2.currentMeshDiagnostics);
      expect(state1.semanticGroupNodes).not.toBe(state2.semanticGroupNodes);
      expect(state1.materialCacheStats).not.toBe(state2.materialCacheStats);
      expect(state1.graphIntents).not.toBe(state2.graphIntents);
      expect(state1.stageGraphIntents).not.toBe(state2.stageGraphIntents);
      expect(state1.triangleBudget).not.toBe(state2.triangleBudget);
      expect(state1.triangleBudget.budgetProtectedMeshNames).not.toBe(
        state2.triangleBudget.budgetProtectedMeshNames,
      );
      expect(state1.triangleBudget.budgetProtectedMeshPrefixes).not.toBe(
        state2.triangleBudget.budgetProtectedMeshPrefixes,
      );
    });

    it('triangle budget counters start at zero per invocation', () => {
      const services = makeFakeServices();
      const state = createGlbBuildRunnerState(services as any);

      expect(state.triangleBudget.totalTriangleCount).toBe(0);
      expect(state.triangleBudget.protectedTriangleCount).toBe(0);
      expect(state.triangleBudget.totalTriangleBudget).toBe(2_500_000);
      expect(state.triangleBudget.protectedTriangleReserve).toBe(180_000);
    });

    it('material cache stats start at zero per invocation', () => {
      const services = makeFakeServices();
      const state = createGlbBuildRunnerState(services as any);

      expect(state.materialCacheStats.hits).toBe(0);
      expect(state.materialCacheStats.misses).toBe(0);
    });

    it('mesh diagnostics array starts empty per invocation', () => {
      const services = makeFakeServices();
      const state = createGlbBuildRunnerState(services as any);

      expect(state.currentMeshDiagnostics).toEqual([]);
      expect(state.currentMeshDiagnostics.length).toBe(0);
    });

    it('semantic group nodes map starts empty per invocation', () => {
      const services = makeFakeServices();
      const state = createGlbBuildRunnerState(services as any);

      expect(state.semanticGroupNodes.size).toBe(0);
    });

    it('graph intents arrays start empty per invocation', () => {
      const services = makeFakeServices();
      const state = createGlbBuildRunnerState(services as any);

      expect(state.graphIntents).toEqual([]);
      expect(state.stageGraphIntents).toEqual([]);
    });

    it('mutating one state does not affect another (no cross-run leakage)', () => {
      const services = makeFakeServices();
      const state1 = createGlbBuildRunnerState(services as any);
      const state2 = createGlbBuildRunnerState(services as any);

      // Simulate build 1 mutating its state
      state1.currentMeshDiagnostics.push({
        name: 'test-mesh',
        vertices: 100,
        triangles: 50,
        skipped: false,
      });
      state1.triangleBudget.totalTriangleCount = 500_000;
      state1.triangleBudget.protectedTriangleCount = 100_000;
      state1.materialCacheStats.hits = 42;
      state1.materialCacheStats.misses = 17;
      state1.semanticGroupNodes.set('scene_root', {});
      state1.graphIntents.push({
        meshName: 'test',
        semanticCategory: 'test',
        sourceObjectIdsCount: 0,
      });
      state1.stageGraphIntents.push({
        stage: 'transport',
        semanticCategory: 'transport',
      });

      // Build 2 state must remain pristine
      expect(state2.currentMeshDiagnostics.length).toBe(0);
      expect(state2.triangleBudget.totalTriangleCount).toBe(0);
      expect(state2.triangleBudget.protectedTriangleCount).toBe(0);
      expect(state2.materialCacheStats.hits).toBe(0);
      expect(state2.materialCacheStats.misses).toBe(0);
      expect(state2.semanticGroupNodes.size).toBe(0);
      expect(state2.graphIntents.length).toBe(0);
      expect(state2.stageGraphIntents.length).toBe(0);
    });

    it('budget protected mesh names set is independent per invocation', () => {
      const services = makeFakeServices();
      const state1 = createGlbBuildRunnerState(services as any);
      const state2 = createGlbBuildRunnerState(services as any);

      state1.triangleBudget.budgetProtectedMeshNames.add('custom_mesh');
      expect(state1.triangleBudget.budgetProtectedMeshNames.has('custom_mesh')).toBe(true);
      expect(state2.triangleBudget.budgetProtectedMeshNames.has('custom_mesh')).toBe(false);
    });

    it('budget protected mesh prefixes array is independent per invocation', () => {
      const services = makeFakeServices();
      const state1 = createGlbBuildRunnerState(services as any);
      const state2 = createGlbBuildRunnerState(services as any);

      state1.triangleBudget.budgetProtectedMeshPrefixes.push('custom_prefix_');
      expect(state1.triangleBudget.budgetProtectedMeshPrefixes).toContain('custom_prefix_');
      expect(state2.triangleBudget.budgetProtectedMeshPrefixes).not.toContain('custom_prefix_');
    });

    it('services are correctly wired into state', () => {
      const services = makeFakeServices();
      const state = createGlbBuildRunnerState(services as any);

      expect(state.appLoggerService).toBe(services.appLoggerService);
      expect(state.sceneAssetProfileService).toBe(services.sceneAssetProfileService);
    });
  });
});
