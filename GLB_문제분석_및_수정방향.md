# GLB 산출물 문제 분석 및 수정 방향

> **분석 일시**: 2026-04-15  
> **분석 대상**: WorMap Backend (NestJS 기반 디지털 트윈 프로젝트)  
> **분석 목적**: GLB 산출물 품질 문제의 근본 원인 파악 및 재설계 방향 도출

---

## 1. 문제 현상 (사용자 보고)

| #   | 문제 현상                                     | 심각도      |
| --- | --------------------------------------------- | ----------- |
| 1   | mesh 중첩으로 멀리서 보면 crash 발생          | 🔴 Critical |
| 2   | 건물 외벽/층이 이어지지 않아 공중에 떠있음    | 🔴 Critical |
| 3   | 건물 외형이 너무 단순하며 재질/색상 정보 없음 | 🟡 High     |
| 4   | 전체적으로 mesh/material이 하나로 묶여있음    | 🟡 High     |
| 5   | 실제 장소 데이터가 아닌 "추론"으로 GLB 생성   | 🔴 Critical |
| 6   | 디지털 트윈 프로젝트가 "추론 프로젝트"가 됨   | 🔴 Critical |

---

## 2. 로그 데이터 분석 결과

### 2.1 시부야 씬 진단 로그

**파일**: `/Users/user/wormapb/data/scene/scene-shibuya-scramble-crossing-mnyh6uo2.diagnostics.log`

| 지표                      | 값                   | 문제 설명                 |
| ------------------------- | -------------------- | ------------------------- |
| collisionRiskCount        | **72**               | 72개 건물이 도로와 겹침   |
| groundedGapCount          | **22**               | 22개 건물이 공중에 떠있음 |
| averageGroundOffsetM      | **0.132**            | 평균 13.2cm 떠있음        |
| maxGroundOffsetM          | **0.24**             | 최대 24cm 떠있음          |
| invalidSetbackJoinCount   | **7**                | 7개 건물 층 연결 실패     |
| buildingCount             | 2,590                | 전체 건물 수              |
| selectedBuildingCount     | 1,450                | 선택된 건물 수            |
| GLB 크기                  | **57,022,168 bytes** | 약 57MB (비효율적)        |
| heroOverrideRate          | **0.003**            | 0.3%만 실제 데이터 반영   |
| fallbackProceduralRate    | 0                    | 추론 fallback 비율        |
| districtMaterialDiversity | **8**                | 재질 다양성 부족          |
| overallScore              | **0.679**            | 전체 품질 점수 67.9%      |
| structure                 | 0.802                | 구조 점수                 |
| atmosphere                | 0.596                | 분위기 점수               |
| placeReadability          | 0.599                | 장소 가독성 점수          |

### 2.2 품질 점수 분석

```
Baseline (PROCEDURAL_ONLY): 0.473
Target (LANDMARK_ENRICHED):  0.679
개선폭:                      0.206

→ 여전히 32%의 품질 격차 존재
```

### 2.3 소스 레지스트리 상태

| 소스               | 활성화  | 커버리지           | 비고                    |
| ------------------ | ------- | ------------------ | ----------------------- |
| OSM (Overpass)     | ✅      | FULL               | 공통 구조 레이어        |
| Google Places      | ✅ CORE | 장소 의미/랜드마크 |
| Mapillary          | ✅      | FULL               | 거리 객체/파사드/사인   |
| CURATED_ASSET_PACK | ❌      | NONE               | 적용 가능한 데이터 없음 |
| PHOTOREAL_3D_TILES | ❌      | NONE               | 엔진 통합 안됨          |
| CAPTURED_MESH      | ❌      | NONE               | 별도 캡처 메쉬 없음     |

---

## 3. 근본 원인 분석

### 3.1 충돌 감지 문제 (collisionRiskCount: 72)

**파일**: `src/scene/pipeline/steps/scene-geometry-correction.step.ts`

**현재 코드**:

```typescript
const COLLISION_NEAR_ROAD_METERS = 1.6;
const BASE_GROUND_OFFSET_ON_COLLISION_METERS = 0.06;
const MAX_GROUND_OFFSET_ON_COLLISION_METERS = 0.24;
```

**문제점**:

1. **도로와의 거리만 검사** - 건물 간 충돌 검사 없음
2. `COLLISION_NEAR_ROAD_METERS = 1.6` - 도로에서 1.6m 이내만 충돌로 판단
3. 실제 mesh 중첩은 검사하지 않음
4. 충돌 시 건물을 들어올리는 방식으로만 대응 (근본 해결 아님)

**결과**: 건물끼리 겹쳐도 감지하지 못하고, 시각적으로 중첩된 mesh가 생성됨

### 3.2 건물이 공중에 떠있는 문제 (groundedGapCount: 22)

**파일**: `src/assets/compiler/building/building-mesh.shell.builder.ts`

**현재 코드**:

```typescript
const MIN_FOUNDATION_DEPTH = 0.35;
const MAX_FOUNDATION_DEPTH = 0.9;
const SETBACK_OVERLAP = 0.01; // ← 1cm만 겹침

export function resolveBuildingVerticalBase(
  building: SceneMeta['buildings'][number],
): number {
  return Number((building.terrainOffsetM ?? 0).toFixed(3));
}
```

**문제점**:

1. `SETBACK_OVERLAP = 0.01` (1cm) - 층과 층 사이의 겹침이 너무 작음
2. `groundOffsetM`이 도로와의 충돌 시에만 설정됨 (6~24cm)
3. 지형 변화를 고려하지 않음 (`TERRAIN_RELIEF_SCALE = 0.18`로 축소)
4. 건물 자체의 높이 변화나 지형 변화를 고려하지 않음

**결과**: 층과 층이 이어지지 않고, 공중에 떠있는 것처럼 보임

### 3.3 건물 외벽 연결 문제 (invalidSetbackJoinCount: 7)

**파일**: `src/assets/compiler/building/building-mesh.shell.builder.ts`

**현재 코드**:

```typescript
const MAX_SAFE_SETBACK_LEVELS_WITHOUT_COLLAPSE = 3;

// geometry-correction.step.ts에서
const likelyInvalidJoin =
  estimatedRemaining < MIN_SETBACK_USABLE_VERTICES ||
  setbackLevels > MAX_SAFE_SETBACK_LEVELS_WITHOUT_COLLAPSE;
```

**문제점**:

1. vertex 수로만 유효성 검사 (실제 geometry 검사 안 함)
2. setback 연결 시 겹침이 너무 작음
3. `MAX_SAFE_SETBACK_LEVELS_WITHOUT_COLLAPSE = 3`으로 제한

**결과**: setback이 있는 건물의 층이 이어지지 않음

### 3.4 재질 단순화 문제 (districtMaterialDiversity: 8)

**파일**: `src/assets/compiler/materials/glb-material-factory.scene.ts`

**현재 재질 정의**:

```typescript
// 색상 + metallic + roughness만 있음
ground: doc
  .createMaterial('ground')
  .setBaseColorFactor([0.52, 0.55, 0.5, 1])
  .setMetallicFactor(0)
  .setRoughnessFactor(1);
```

**문제점**:

1. 텍스처 기반이 아닌 색상 기반 재질
2. 건물별 고유 색상이 아닌, 카테고리별 색상 적용
3. Mapillary에서 facade palette를 가져오지만 실제로는 거의 사용되지 않음
4. `createBuildingShellMaterial`에서 해시 기반 색상 선택

**결과**: 모든 건물이 비슷한 색상/재질로 보임

### 3.5 추론 기반 vs 실제 데이터 기반 문제

**파일**: `src/scene/services/vision/scene-facade-vision.service.ts`

**현재 추론 로직**:

```typescript
const weakEvidence = nearbyImageCount === 0 && nearbyFeatureCount === 0;
const inferenceReasonCodes: InferenceReasonCode[] = [];

if (nearbyImageCount === 0) {
  inferenceReasonCodes.push('MISSING_MAPILLARY_IMAGES');
}
if (nearbyFeatureCount === 0) {
  inferenceReasonCodes.push('MISSING_MAPILLARY_FEATURES');
}
if (!building.facadeColor) {
  inferenceReasonCodes.push('MISSING_FACADE_COLOR');
}
if (!building.facadeMaterial) {
  inferenceReasonCodes.push('MISSING_FACADE_MATERIAL');
}
```

**문제점**:

1. Mapillary 데이터가 없으면 추론에 의존
2. `weakEvidence`일 때 팔레트 드리프트 적용
3. `heroOverrideRate: 0.003` - 99.7%가 추론
4. 실제 장소 데이터가 부족하면 해시 기반 랜덤 선택

**결과**: 디지털 트윈이 아닌 "추론 프로젝트"가 됨

### 3.6 Mesh가 하나로 묶여있는 문제

**파일**: `src/assets/internal/glb-build/glb-build-runner.ts`

**현재 구조**:

```typescript
// 모든 mesh가 하나의 버퍼에 저장
const buffer = doc.createBuffer('scene-buffer');
const scene = doc.createScene(contract.sceneId);

// LOD 시스템 없음
// 선택적 로딩 불가
```

**문제점**:

1. 모든 mesh가 하나의 버퍼에 저장
2. LOD(Level of Detail) 시스템이 부족함
3. 선택적 로딩이 불가능함
4. triangle budget이 하드코딩됨

**결과**: 57MB의 큰 GLB 파일, 메모리 비효율적

---

## 4. 건물 스타일 추론 시스템 분석

**파일**: `src/scene/services/vision/building-style-resolver.service.ts`

### 4.1 건물 프리셋 분류 로직

```typescript
private classifyBuildingPreset(input: BuildingStyleInput): BuildingPreset {
  const area = Math.abs(polygonSignedArea(input.outerRing)) * 111_320 * 111_320;
  const material = `${input.facadeMaterial ?? ''} ${input.roofMaterial ?? ''}`.toLowerCase();

  if (input.usage === 'TRANSIT') return 'station_block';
  if (input.heightMeters >= 60 || (input.heightMeters >= 38 &&
      (material.includes('glass') || input.usage === 'COMMERCIAL'))) {
    return 'glass_tower';
  }
  if (input.usage === 'COMMERCIAL' && area >= 1_600) return 'mall_block';
  if (input.heightMeters >= 24) {
    return input.usage === 'COMMERCIAL' ? 'office_midrise' : 'mixed_midrise';
  }
  if (input.heightMeters <= 12 && area <= 1_800) return 'small_lowrise';
  return 'mixed_midrise';
}
```

**문제점**:

- 높이와 면적만으로 프리셋 결정
- 실제 건물 특성(외벽 재질, 창문 비율 등) 무시
- 해시 기반 랜덤 색상 선택

### 4.2 재질 클래스 결정 로직

```typescript
resolveMaterialClass(input: BuildingStyleInput, preset?: BuildingPreset): MaterialClass {
  const rawMaterial = `${input.facadeMaterial ?? ''} ${input.roofMaterial ?? ''}`.toLowerCase();

  if (rawMaterial.includes('glass')) return 'glass';
  if (rawMaterial.includes('brick')) return 'brick';
  if (rawMaterial.includes('metal') || rawMaterial.includes('steel')) return 'metal';
  if (rawMaterial.includes('concrete') || rawMaterial.includes('cement')) return 'concrete';

  switch (preset) {
    case 'glass_tower': return 'glass';
    case 'mall_block':
    case 'station_block': return 'concrete';
    case 'small_lowrise': {
      const seed = `${input.outerRing[0]?.lat ?? 0}:${input.outerRing[0]?.lng ?? 0}`;
      const hash = seed.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
      const variants: MaterialClass[] = ['brick', 'concrete', 'mixed'];
      return variants[hash % variants.length];  // ← 해시 기반 랜덤!
    }
    default: return input.usage === 'COMMERCIAL' ? 'glass' : 'mixed';
  }
}
```

**문제점**:

- `facadeMaterial`이 없으면 해시 기반 랜덤 선택
- 좌표를 해시로 변환하여 재질 결정 (비논리적)

---

## 5. 외부 라이브러리 베스트 프랙티스

### 5.1 glTF Transform (메모리 효율)

**권장 파이프라인**:

```
prune → dedup → weld → quantize/reorder → draco/meshopt
```

**핵심 함수**:

- `prune()`: 사용하지 않는 노드/재질 제거
- `dedup()`: 중복 재질/메시 병합
- `weld()`: 비트와이즈 동일한 정점 병합
- `quantize()`: 정점 데이터 압축
- `join()`: 호환 가능한 primitive 병합 (draw call 감소)
- `simplify()`: LOD용 저해상도 메시 생성
- `instance()`: 반복 파츠 인스턴싱

### 5.2 Earcut (폴리곤 삼각화)

**특성**:

- 2D 전용 (footprint를 평면에 투영 필요)
- holes 지원
- `deviation()`으로 검증 가능
- self-intersection은 사전 검증 필요

**사용법**:

```typescript
const triangles = earcut(positions, holeIndices, dimensions);
const deviation = earcut.deviation(
  positions,
  holeIndices,
  dimensions,
  triangles,
);
```

### 5.3 Three.js (렌더링 최적화)

**LOD 구현**:

```typescript
const lod = new THREE.LOD();
lod.addLevel(highDetailMesh, 0); // 가까이
lod.addLevel(mediumDetailMesh, 50); // 중간
lod.addLevel(lowDetailMesh, 100); // 멀리
```

**InstancedMesh (반복 요소)**:

```typescript
const instancedMesh = new THREE.InstancedMesh(geometry, material, count);
for (let i = 0; i < count; i++) {
  instancedMesh.setMatrixAt(i, matrix);
}
```

**충돌 감지**:

```typescript
const box1 = new THREE.Box3().setFromObject(mesh1);
const box2 = new THREE.Box3().setFromObject(mesh2);
const isColliding = box1.intersectsBox(box2);
```

### 5.4 glTF Validator (검증)

**사용법**:

```typescript
const report = await validator.validateBytes(glbBinary, {
  uri: 'scene.glb',
  maxIssues: 1000,
});
if (report.issues.numErrors > 0) {
  console.error(report.issues.messages);
}
```

---

## 6. 수정 대상 파일 목록

### 6.1 즉시 수정 필요 (Critical)

| 파일                                                          | 역할        | 수정 내용                             |
| ------------------------------------------------------------- | ----------- | ------------------------------------- |
| `src/scene/pipeline/steps/scene-geometry-correction.step.ts`  | 충돌 감지   | 건물 간 AABB 충돌 검사 추가           |
| `src/assets/compiler/building/building-mesh.shell.builder.ts` | 건물 외벽   | SETBACK_OVERLAP을 0.05m 이상으로 증가 |
| `src/scene/services/vision/scene-facade-vision.service.ts`    | facade 추론 | 데이터 기반 우선, 추론 비율 줄이기    |

### 6.2 중요 수정 (High)

| 파일                                                           | 역할        | 수정 내용                             |
| -------------------------------------------------------------- | ----------- | ------------------------------------- |
| `src/assets/internal/glb-build/glb-build-runner.ts`            | GLB 생성    | LOD 시스템 추가, mesh 분리            |
| `src/assets/compiler/materials/glb-material-factory.scene.ts`  | 재질        | 텍스처 기반 재질 시스템 도입          |
| `src/scene/services/vision/building-style-resolver.service.ts` | 건물 스타일 | 해시 기반 랜덤 제거, 실제 데이터 우선 |

### 6.3 개선 필요 (Medium)

| 파일                                                                    | 역할      | 수정 내용          |
| ----------------------------------------------------------------------- | --------- | ------------------ |
| `src/scene/pipeline/steps/scene-asset-profile.step.ts`                  | 에셋 선택 | LOD 기반 에셋 선택 |
| `src/assets/internal/glb-build/stages/glb-build-building-hero.stage.ts` | 건물 mesh | 인스턴싱 적용      |
| `src/assets/internal/glb-build/glb-build-mesh-node.ts`                  | mesh 노드 | semantic 그룹 분리 |

---

## 7. 재설계 로드맵

### Phase 1: 충돌 감지 강화 (1주)

**목표**: mesh 중첩 제거

**작업**:

1. 건물 간 AABB 충돌 검사 추가
2. Three.js `Box3.intersectsBox()` 활용
3. 충돌 시 자동 분리 로직 구현
4. 충돌 임계값 조정 (1.6m → 3m)

**성공 기준**: collisionRiskCount = 0

### Phase 2: 지면 연결 개선 (1주)

**목표**: 건물이 공중에 뜨지 않도록

**작업**:

1. `SETBACK_OVERLAP`을 0.05~0.1m로 증가
2. `TERRAIN_RELIEF_SCALE`을 0.5 이상으로 설정
3. 실제 지형 데이터 반영 로직 개선
4. 건물 foundation 깊이 증가

**성공 기준**: groundedGapCount = 0, averageGroundOffsetM < 0.05

### Phase 3: 재질 다양화 (2주)

**목표**: 건물별 고유 외형 구현

**작업**:

1. 텍스처 기반 재질 시스템 도입
2. Mapillary 이미지에서 facade 색상 추출
3. 건물별 고유 색상 적용
4. 재질 캐시 최적화

**성공 기준**: districtMaterialDiversity > 20

### Phase 4: 데이터 기반 전환 (2주)

**목표**: 추론 비율 대폭 감소

**작업**:

1. heroOverrideRate를 0.3 이상으로 목표
2. weakEvidence 비율 줄이기
3. 실제 장소 데이터 우선 적용
4. CURATED_ASSET_PACK 통합

**성공 기준**: heroOverrideRate > 0.3, weakEvidence < 0.5

### Phase 5: LOD + 메모리 최적화 (1주)

**목표**: GLB 크기 50% 감소

**작업**:

1. `gltf-transform`의 `simplify()` 활용
2. `InstancedMesh`로 반복 요소 최적화
3. 선택적 로딩 가능한 GLB 구조
4. mesh 분리 및 LOD 레벨 추가

**성공 기준**: GLB 크기 < 30MB, 로딩 시간 50% 감소

---

## 8. 성공 지표

| 지표                      | 현재값 | 목표값 | 측정 방법                |
| ------------------------- | ------ | ------ | ------------------------ |
| collisionRiskCount        | 72     | 0      | geometry-correction 로그 |
| groundedGapCount          | 22     | 0      | geometry-correction 로그 |
| averageGroundOffsetM      | 0.132  | < 0.05 | geometry-correction 로그 |
| invalidSetbackJoinCount   | 7      | 0      | geometry-correction 로그 |
| GLB 크기                  | 57MB   | < 30MB | 파일 크기                |
| heroOverrideRate          | 0.003  | > 0.3  | glb_build 로그           |
| districtMaterialDiversity | 8      | > 20   | glb_build 로그           |
| overallScore              | 0.679  | > 0.85 | fidelity metrics         |
| atmosphere                | 0.596  | > 0.75 | fidelity metrics         |
| placeReadability          | 0.599  | > 0.80 | fidelity metrics         |

---

## 9. 참고 자료

### 프로젝트 문서

- `/Users/user/wormapb/README.md` - 프로젝트 개요
- `/Users/user/wormapb/PRD.md` - 제품 요구사항
- `/Users/user/wormapb/acctecture.md` - 아키텍처 문서

### 로그 파일

- `/Users/user/wormapb/data/scene/scene-shibuya-scramble-crossing-mnyh6uo2.diagnostics.log`
- `/Users/user/wormapb/data/scenes/scene-shibuya.diagnostics.log`
- `/Users/user/wormapb/data/scenes/scene-geometry-correction.diagnostics.log`

### 핵심 소스 파일

- `src/scene/pipeline/steps/scene-geometry-correction.step.ts`
- `src/assets/compiler/building/building-mesh.shell.builder.ts`
- `src/scene/services/vision/scene-facade-vision.service.ts`
- `src/scene/services/vision/building-style-resolver.service.ts`
- `src/assets/internal/glb-build/glb-build-runner.ts`
- `src/assets/compiler/materials/glb-material-factory.scene.ts`

---

## 10. 결론

이 프로젝트는 현재 **"추론 기반 프로젝트"** 상태입니다.

**핵심 문제**: 실제 장소 데이터 대신 해시 기반 랜덤 추론에 의존

**해결 방향**:

1. 충돌 감지 강화 → mesh 중첩 제거
2. 지면 연결 개선 → 공중 부유 제거
3. 재질 다양화 → 건물별 고유 외형
4. 데이터 기반 전환 → 추론 비율 감소
5. LOD + 최적화 → 메모리 효율성 향상

**예상 기간**: 7주 (Phase 1~5)

**기대 효과**:

- GLB 품질 점수 0.679 → 0.85+ (25% 향상)
- GLB 크기 57MB → 30MB (47% 감소)
- 실제 데이터 반영률 0.3% → 30%+ (100배 향상)

---

_분석 완료: 2026-04-15_
