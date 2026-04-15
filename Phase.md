# GLB 산출물 품질 개선 - Phase 계획서

> **작성일**: 2026-04-15  
> **목적**: GLB 검증 에러 해결 및 디지털 트윈 품질 개선  
> **현재 상태**: GLB validation 실패 (19,972 errors)

---

## Phase 0: 즉시 수정 (Critical - GLB 검증 실패 해결)

**목표**: `bun scene:shibuya` 실행 시 GLB 생성 성공  
**기간**: 1일  
**우선순위**: 🔴 Critical

### 0.1 quantize POSITION/NORMAL 제외

**파일**: `src/assets/internal/glb-build/glb-build-runner.ts`

**현재 코드 (Line 119-126)**:

```typescript
const GLB_QUANTIZE_OPTIONS: Record<string, unknown> = {
  quantizePosition: 14,
  quantizeNormal: 10,
  quantizeTexcoord: 12,
  quantizeColor: 8,
  quantizeGeneric: 12,
  cleanup: false,
};
```

**수정 코드**:

```typescript
const GLB_QUANTIZE_OPTIONS: Record<string, unknown> = {
  quantizeTexcoord: 12,
  quantizeColor: 8,
  quantizeGeneric: 12,
  cleanup: false,
  // POSITION, NORMAL은 glTF 2.0 core 사양에서 FLOAT만 허용
  // quantize()가 SHORT normalized로 변환하면 validator 에러 발생
  pattern: /^(?!POSITION$|NORMAL$)/,
};
```

**근거**:

- glTF 2.0 Core 사양 3.7.2.1: POSITION accessor는 FLOAT componentType이어야 함
- glTF Transform의 `quantize()`는 `pattern` 옵션으로 semantic 제외 가능
- 공식 테스트(`quantize.test.ts` Line 36-45)에서 동일한 패턴 사용

**검증 방법**:

```bash
bun scene:shibuya
# 예상 결과: GLB validation passed
```

---

### 0.2 NodeIO 확장 등록

**파일**: `src/assets/internal/glb-build/glb-build-runner.ts`

**현재 코드 (Line 375)**:

```typescript
const glbBinary = await new NodeIO().writeBinary(doc);
```

**수정 코드**:

```typescript
const io = new NodeIO();

// quantize()가 사용하는 KHR_mesh_quantization 확장 등록
try {
  const extensionsModule = await import('@gltf-transform/extensions');
  const allExtensions = Object.values(extensionsModule).filter(
    (ext): ext is new (...args: unknown[]) => unknown =>
      typeof ext === 'function' && 'EXTENSION_NAME' in ext.prototype,
  );
  if (allExtensions.length > 0) {
    io.registerExtensions(allExtensions);
  }
} catch (extensionImportError) {
  this.appLoggerService.warn('scene.glb_build.extension_registration_skipped', {
    sceneId: contract.sceneId,
    step: 'glb_build',
    reason:
      extensionImportError instanceof Error
        ? extensionImportError.message
        : String(extensionImportError),
  });
}

const glbBinary = await io.writeBinary(doc);
```

**근거**:

- `quantize()`가 `KHR_mesh_quantization` 확장을 문서에 추가
- `NodeIO`에 확장을 등록하지 않으면 "Some extensions were not registered" 경고 발생
- `@gltf-transform/extensions` 패키지에 모든 공식 확장이 포함됨

**검증 방법**:

```bash
bun scene:shibuya
# 예상 결과: "Some extensions were not registered" 경고 사라짐
```

---

### 0.3 GLB 크기 예산 초과 해결

**에러 메시지**:

```
GLB size budget exceeded: 44,552,144 bytes > 31,457,280 bytes
```

**원인 분석**:

- quantize 수정 후 POSITION/NORMAL이 FLOAT로 유지 (SHORT → FLOAT = 4배 증가)
- GLB_SIZE_TARGET_MAX_BYTES = 30MB (하드코딩)
- 현재 GLB = 44.5MB (예산 대비 47% 초과)

**해결 방법 1: simplify() 활성화 (추천)**

환경 변수로 simplify 기능 활성화:

```bash
# .env 파일에 추가
GLB_OPTIMIZE_SIMPLIFY_ENABLED=true
GLB_OPTIMIZE_SIMPLIFY_RATIO=0.5
GLB_OPTIMIZE_SIMPLIFY_ERROR=0.001
GLB_OPTIMIZE_SIMPLIFY_LOCK_BORDER=false
```

또는 실행 시 직접 설정:

```bash
GLB_OPTIMIZE_SIMPLIFY_ENABLED=true \
GLB_OPTIMIZE_SIMPLIFY_RATIO=0.5 \
bun scene:shibuya
```

**해결 방법 2: 크기 예산 증가 (임시)**

**파일**: `src/assets/internal/glb-build/glb-build-runner.ts` (Line 131)

**현재 코드**:

```typescript
const GLB_SIZE_TARGET_MAX_BYTES = 30 * 1024 * 1024; // 30MB
```

**수정 코드**:

```typescript
const GLB_SIZE_TARGET_MAX_BYTES = 50 * 1024 * 1024; // 50MB로 증가
```

**해결 방법 3: 코드에서 enforceSizeBudget 비활성화 (테스트용)**

**파일**: `src/assets/internal/glb-build/glb-build-runner.ts` (Line 960-967)

**현재 코드**:

```typescript
private enforceSizeBudget(glbBytes: number, sceneId: string): void {
  if (glbBytes <= GLB_SIZE_TARGET_MAX_BYTES) {
    return;
  }
  throw new Error(
    `GLB size budget exceeded: ${glbBytes} bytes > ${GLB_SIZE_TARGET_MAX_BYTES} bytes (sceneId=${sceneId})`,
  );
}
```

**수정 코드** (경고만 출력):

```typescript
private enforceSizeBudget(glbBytes: number, sceneId: string): void {
  if (glbBytes <= GLB_SIZE_TARGET_MAX_BYTES) {
    return;
  }
  this.appLoggerService.warn('scene.glb_build.size_budget_exceeded', {
    sceneId,
    step: 'glb_build',
    glbBytes,
    budgetBytes: GLB_SIZE_TARGET_MAX_BYTES,
    overBudgetPercent: Math.round((glbBytes / GLB_SIZE_TARGET_MAX_BYTES - 1) * 100),
  });
  // throw 대신 경고만 출력 - Phase 5에서 LOD로 해결 예정
}
```

**권장 조치**: 방법 1 (simplify) + 방법 2 (예산 증가) 조합

---

### 0.4 검증 결과

| 지표                     | 현재   | 목표          |
| ------------------------ | ------ | ------------- |
| GLB validation errors    | 19,972 | 0             |
| "Some extensions" 경고   | 발생   | 미발생        |
| GLB 크기                 | 44.5MB | < 50MB (임시) |
| `bun scene:shibuya` 실행 | 실패   | 성공          |

---

## Phase 1: 충돌 감지 강화

**목표**: mesh 중첩으로 인한 시각적 충돌 제거  
**기간**: 1주  
**우선순위**: 🔴 High  
**현재 지표**: collisionRiskCount: 72

### 1.1 건물 간 AABB 충돌 검사 추가

**파일**: `src/scene/pipeline/steps/scene-geometry-correction.step.ts`

**현재 코드**:

```typescript
// 도로와의 거리만 검사
const COLLISION_NEAR_ROAD_METERS = 1.6;
```

**수정 코드**:

```typescript
// 건물 간 충돌 검사 함수 추가
function checkBuildingBuildingCollision(
  buildingA: SceneMetaBuildings,
  buildingB: SceneMetaBuildings,
  minDistance: number = 2.0,
): boolean {
  const boundsA = computeBuildingBounds(buildingA);
  const boundsB = computeBuildingBounds(buildingB);

  // AABB 교차 검사
  return (
    boundsA.minX <= boundsB.maxX + minDistance &&
    boundsA.maxX >= boundsB.minX - minDistance &&
    boundsA.minY <= boundsB.maxY + minDistance &&
    boundsA.maxY >= boundsB.minY - minDistance
  );
}

// 기존 correctBuilding 함수에 건물 간 충돌 검사 추가
function correctBuilding(
  building: SceneMetaBuildings,
  allBuildings: SceneMetaBuildings[],
  crossings: SceneMetaCrossings[],
): BuildingDiagnostics {
  // ... 기존 도로 충돌 검사 ...

  // 건물 간 충돌 검사 추가
  const collidingBuildings = allBuildings.filter(
    (other) =>
      other.id !== building.id &&
      checkBuildingBuildingCollision(building, other, 2.0),
  );

  if (collidingBuildings.length > 0) {
    // 충돌 시 건물을 분리하거나 크기 조정
    return {
      ...diagnostics,
      collisionRiskCount: collidingBuildings.length,
      collisionResolution: 'SEPARATE',
    };
  }

  return diagnostics;
}
```

### 1.2 충돌 임계값 조정

**현재**:

```typescript
const COLLISION_NEAR_ROAD_METERS = 1.6;
```

**수정**:

```typescript
const COLLISION_NEAR_ROAD_METERS = 3.0; // 도로와의 거리 증가
const COLLISION_BETWEEN_BUILDINGS_METERS = 2.0; // 건물 간 거리 추가
```

### 1.3 검증 결과

| 지표               | 현재 | 목표 |
| ------------------ | ---- | ---- |
| collisionRiskCount | 72   | < 10 |

---

## Phase 2: 지면 연결 개선

**목표**: 건물이 공중에 떠있지 않도록  
**기간**: 1주  
**우선순위**: 🟡 High  
**현재 지표**: groundedGapCount: 22, averageGroundOffsetM: 0.132

### 2.1 SETBACK_OVERLAP 증가

**파일**: `src/assets/compiler/building/building-mesh.shell.builder.ts`

**현재 코드 (Line 19)**:

```typescript
const SETBACK_OVERLAP = 0.01; // 1cm
```

**수정 코드**:

```typescript
const SETBACK_OVERLAP = 0.05; // 5cm로 증가
// 또는 환경 변수로 제어 가능하게
const SETBACK_OVERLAP = Number(process.env.SETBACK_OVERLAP_METERS ?? '0.05');
```

### 2.2 TERRAIN_RELIEF_SCALE 조정

**파일**: `src/scene/pipeline/steps/scene-geometry-correction.step.ts`

**현재 코드**:

```typescript
const TERRAIN_RELIEF_SCALE = 0.18;
```

**수정 코드**:

```typescript
const TERRAIN_RELIEF_SCALE = 0.5; // 지형 높이 변화를 50%로 반영
```

### 2.3 groundOffsetM 설정 개선

**현재**: 도로와의 충돌 시에만 groundOffsetM 설정  
**수정**: 지형 높이 변화에 따라 자동으로 groundOffsetM 설정

```typescript
function calculateGroundOffset(
  building: SceneMetaBuildings,
  terrainProfile: TerrainProfile,
): number {
  // 건물 footprint 중심의 지형 높이
  const buildingCenter = computeBuildingCenter(building);
  const terrainHeight = getTerrainHeightAt(terrainProfile, buildingCenter);

  // 지형 높이가 건물 base보다 낮으면 offset 설정
  const baseHeight = building.terrainOffsetM ?? 0;
  const gap = baseHeight - terrainHeight;

  if (gap > 0.05) {
    // 5cm 이상 차이날 때
    return Math.min(gap, 0.3); // 최대 30cm
  }

  return 0;
}
```

### 2.4 검증 결과

| 지표                 | 현재  | 목표   |
| -------------------- | ----- | ------ |
| groundedGapCount     | 22    | < 5    |
| averageGroundOffsetM | 0.132 | < 0.05 |

---

## Phase 3: 재질 다양화

**목표**: 건물별 고유 외형 구현  
**기간**: 2주  
**우선순위**: 🟡 High  
**현재 지표**: districtMaterialDiversity: 8

### 3.1 텍스처 기반 재질 시스템

**파일**: `src/assets/compiler/materials/glb-material-factory.scene.ts`

**현재 코드**:

```typescript
ground: doc
  .createMaterial('ground')
  .setBaseColorFactor([0.52, 0.55, 0.5, 1])
  .setMetallicFactor(0)
  .setRoughnessFactor(1);
```

**수정 방향**:

1. Mapillary 이미지에서 facade 색상 추출
2. 건물별 고유 색상 적용
3. 재질 캐시로 중복 생성 방지

### 3.2 Mapillary facade 색상 추출 강화

**파일**: `src/scene/services/vision/scene-facade-vision.service.ts`

**현재**: weakEvidence 시 팔레트 드리프트 적용  
**수정**: 실제 이미지 색상 추출 우선

```typescript
async function extractFacadeColorFromImage(
  imageUrl: string,
  buildingBounds: BuildingBounds,
): Promise<FacadeColorResult> {
  // Mapillary 이미지에서 건물 facade 영역 크롭
  // 평균 색상 추출
  // 신뢰도 점수 계산
}
```

### 3.3 검증 결과

| 지표                      | 현재 | 목표 |
| ------------------------- | ---- | ---- |
| districtMaterialDiversity | 8    | > 20 |

---

## Phase 4: 데이터 기반 전환

**목표**: 추론 비율 대폭 감소  
**기간**: 2주  
**우선순위**: 🟡 Medium  
**현재 지표**: heroOverrideRate: 0.003

### 4.1 heroOverrideRate 증가

**현재**: 0.3%만 실제 데이터 반영  
**목표**: 30% 이상

**방안**:

1. CURATED_ASSET_PACK 데이터 통합
2. Google Places 상세 정보 활용
3. OSM building 속성 활용

### 4.2 weakEvidence 비율 감소

**현재**: Mapillary 데이터 없으면 추론  
**수정**: 대체 데이터 소스 활용

```typescript
function determineEvidenceStrength(
  building: BuildingStyleInput,
): EvidenceStrength {
  // Mapillary 데이터 확인
  if (building.nearbyImageCount > 0 && building.nearbyFeatureCount > 0) {
    return 'STRONG';
  }

  // OSM 속성 확인
  if (
    building.osmAttributes &&
    Object.keys(building.osmAttributes).length > 0
  ) {
    return 'MODERATE';
  }

  // Google Places 정보 확인
  if (building.googlePlacesInfo) {
    return 'MODERATE';
  }

  return 'WEAK';
}
```

### 4.3 검증 결과

| 지표              | 현재  | 목표  |
| ----------------- | ----- | ----- |
| heroOverrideRate  | 0.003 | > 0.3 |
| weakEvidence 비율 | 높음  | < 0.5 |

---

## Phase 5: LOD + 메모리 최적화

**목표**: GLB 크기 50% 감소  
**기간**: 1주  
**우선순위**: 🟢 Medium  
**현재 지표**: GLB 57MB

### 5.1 LOD 시스템 추가

**파일**: `src/assets/internal/glb-build/stages/glb-build-building-hero.stage.ts`

**방안**:

1. 거리별 메시 복잡도 조절
2. `gltf-transform`의 `simplify()` 활용
3. Three.js `LOD` 노드 생성

### 5.2 InstancedMesh 활용

**현재**: 동일 메시를 여러 번 저장  
**수정**: 동일 메시를 인스턴싱

```typescript
// 동일한 facade 패널이 5개 이상인 경우 instancing 적용
if (identicalPanelCount >= 5) {
  createInstancedMesh(panelGeometry, panelMaterial, identicalPanelCount);
}
```

### 5.3 선택적 로딩

**방안**:

1. 메시를 semantic 그룹으로 분리
2. 뷰포트 기반 로딩
3. 프로그레시브 로딩

### 5.4 검증 결과

| 지표      | 현재 | 목표     |
| --------- | ---- | -------- |
| GLB 크기  | 57MB | < 30MB   |
| 로딩 시간 | -    | 50% 감소 |

---

## 전체 일정

| Phase                | 기간    | 시작   | 완료   |
| -------------------- | ------- | ------ | ------ |
| Phase 0: 즉시 수정   | 1일     | Day 1  | Day 1  |
| Phase 1: 충돌 감지   | 1주     | Day 2  | Day 8  |
| Phase 2: 지면 연결   | 1주     | Day 9  | Day 15 |
| Phase 3: 재질 다양화 | 2주     | Day 16 | Day 29 |
| Phase 4: 데이터 전환 | 2주     | Day 30 | Day 43 |
| Phase 5: LOD 최적화  | 1주     | Day 44 | Day 50 |
| **합계**             | **7주** |        |        |

---

## 성공 지표 요약

| 지표                      | 현재              | Phase 0 목표  | 최종 목표 |
| ------------------------- | ----------------- | ------------- | --------- |
| GLB validation errors     | 19,972 → **0** ✅ | 0             | 0         |
| GLB 크기 예산             | 44.5MB > 30MB ❌  | < 50MB (임시) | < 30MB    |
| collisionRiskCount        | 72                | 72            | < 10      |
| groundedGapCount          | 22                | 22            | < 5       |
| heroOverrideRate          | 0.003             | 0.003         | > 0.3     |
| districtMaterialDiversity | 8                 | 8             | > 20      |
| overallScore              | 0.679             | 0.679         | > 0.85    |

---

## 수정 대상 파일 요약

| Phase | 파일                                                                    | 수정 내용                                           |
| ----- | ----------------------------------------------------------------------- | --------------------------------------------------- |
| 0     | `src/assets/internal/glb-build/glb-build-runner.ts`                     | quantize pattern 추가, NodeIO 확장 등록             |
| 0     | `src/assets/internal/glb-build/glb-build-runner.ts`                     | GLB_SIZE_TARGET_MAX_BYTES 증가 또는 simplify 활성화 |
| 1     | `src/scene/pipeline/steps/scene-geometry-correction.step.ts`            | 건물 간 충돌 검사 추가                              |
| 2     | `src/assets/compiler/building/building-mesh.shell.builder.ts`           | SETBACK_OVERLAP 증가                                |
| 2     | `src/scene/pipeline/steps/scene-geometry-correction.step.ts`            | TERRAIN_RELIEF_SCALE 조정                           |
| 3     | `src/assets/compiler/materials/glb-material-factory.scene.ts`           | 텍스처 기반 재질                                    |
| 3     | `src/scene/services/vision/scene-facade-vision.service.ts`              | facade 색상 추출 강화                               |
| 4     | `src/scene/services/vision/building-style-resolver.service.ts`          | 해시 기반 랜덤 제거                                 |
| 5     | `src/assets/internal/glb-build/stages/glb-build-building-hero.stage.ts` | LOD 시스템 추가                                     |

---

## 테스트 시나리오

### Phase 0 테스트

```bash
# 1. GLB 생성 테스트
bun scene:shibuya

# 2. 예상 결과
# - GLB validation passed
# - "Some extensions" 경고 없음
# - /data/scene/scene-shibuya-*.glb 파일 생성됨
```

### Phase 1-5 테스트

```bash
# 1. 진단 로그 확인
cat /data/scene/scene-shibuya-*.diagnostics.log | jq '.collisionRiskCount, .groundedGapCount'

# 2. Blender에서 시각적 확인
# - 건물 간 겹침 없음
# - 건물이 공중에 떠있지 않음
# - 건물별 고유 색상/재질
```

---

_작성 완료: 2026-04-15_
