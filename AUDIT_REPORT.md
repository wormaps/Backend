# WorMap 디지털 트윈 프로젝트 — 종합 코드 감사 리포트

> **작성일**: 2026-04-20
> **범위**: 전체 코드베이스 (242개 .ts 파일, 데이터 레이어, GLB 컴파일러, 파이프라인, 스토리지, 테스트, 인프라)
> **발견된 문제**: **180+ 개**

---

## 📊 요약

| 심각도 | 개수 | 핵심 영역 |
|--------|------|-----------|
| 🔴 CRITICAL | 23 | 보안, 데이터 손실, 지오메트리 파괴 |
| 🟠 HIGH | 47 | 타입 안전성, 성능, 메모리, 아키텍처 |
| 🟡 MEDIUM | 68 | 매직 넘버, 중복 코드, 에러 처리 |
| ⚪ LOW | 42 | 네이밍, 문서화, 데드 코드 |

---

## 🔴 CRITICAL — 즉시 수정 필요 (23개)

### 1. `.env` 파일에 프로덕션 API 키 노출

**위치**: `/Users/user/wormapb/.env` (전체 파일)

| 라인 | 키 | 유형 |
|------|-----|------|
| 5-7 | `GOOGLE_OAUTH_CLIENT`, `GOOGLE_CLIENT_SECRET_KEY`, `GOOGLE_API_KEY` | Google OAuth |
| 10 | `TOMTOM_API_KEY=uO5k0OinDqQV9wQB8nqK...` | TomTom Traffic |
| 19 | `OPENAI_KEY=sk-proj-qn9Dho8oqaX-roIUEFY...` | OpenAI |
| 22-23 | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Redis |
| 26-27 | `MAPILLARY_ACCESS_TOKEN`, `MAPILLARY_SECRET_KEY` | Mapillary |

**위험**: Git에 커밋된 경우 모든 키 즉시 회전 필요. `.gitignore`에 `.env` 추가 필수.

---

### 2. OSM 건물 중복 제거 미구현 — 3,664개 중복

**위치**: `src/places/clients/overpass/overpass.partitions.ts`

현재 `id` 기반 중복 제거만 수행. 동일 건물이 OSM `way`(단순 다각형)와 `relation`(복합 다각형) 두 형태로 동시 등록됨.

```typescript
// overpass.partitions.ts:189
// 현재: id 기반만 체크
// 필요: footprint IoU(Intersection over Union) 기반 중복 제거
```

**영향**:
- `buildingOverlapCount: 3,664`
- `totalOverlapAreaM2: 240,310㎡`
- `highSeverityOverlap: 2,154개`
- 동일 좌표에 두 shell → GPU Z-fighting → 건물이 "깨져" 보임

---

### 3. Terrain Offset이 GLB Geometry에 반영 안됨

**위치**: `src/scene/pipeline/steps/scene-terrain-fusion.step.ts:41`

```typescript
const profile = this.terrainProfileService.resolve(sceneId, {
  bounds,
} as any);  // ← as any 타입 안전성 위반
```

**문제**:
- DEM 샘플 81개 가져오지만 `terrainAnchoredBuildingCount: 0`
- `terrainAnchoredRoadCount: 0`
- `transportTerrainCoverageRatio: 0`
- Terrain fusion step이 `terrainOffsetM`을 계산하지만 GLB 빌드 시 실제 geometry에 적용 안됨
- 땅이 평평하게 보임 — 고도 차이 0

**근본 원인**: `resolveDemSampleRelief()` (`road-mesh.builder.ts:595-629`)에서 `relief * 0.18`로 과도하게 감쇠. 최대 ±0.45m 제한.

---

### 4. Setback 갭 — 건물 외벽/층 분리

**위치**: `src/assets/compiler/building/building-mesh.shell.builder.ts:24`

```typescript
const SETBACK_OVERLAP = 0.05;  // 5cm 갭 — podium↔tower 사이 단절
```

`podium_tower`, `stepped_tower` 전략에서 하부 구조와 상부 구조가 5cm 떨어짐. 이 갭이 시각적으로 "건물 분리"로 나타남.

**추가**: `insetRing()`이 setback 단계에서 3개 미만 정점을 반환하면 해당 층이 완전히 생략됨:

```typescript
// building-mesh.shell.builder.ts:77-79
if (nextRing.length < 3) {
  metrics.invalidSetbackJoinCount += 1;
  break;  // 해당 층부터 전체 생략
}
```

---

### 5. Material 투명도 버그 — 유리창이 불투명

**위치**: `src/assets/compiler/materials/glb-material-factory.enhanced.ts:146-152`

```typescript
return doc
  .createMaterial(`window-glass-${type}`)
  .setBaseColorFactor([...params.baseColor, params.alpha ?? 1])
  // BUG: setAlphaMode('BLEND') 호출 누락!
```

유리창 material에 alpha 값은 설정하지만 `AlphaMode`를 `BLEND`로 설정하지 않아 완전히 불투명으로 렌더링됨.

---

### 6. Street Furniture `pushBox` 노말 불일치 — 쉐이딩 파괴

**위치**: `src/assets/compiler/street-furniture/street-furniture-mesh.geometry.utils.ts:4-86`

```typescript
const normal = faceNormals.find((f) => f.indices.includes(i))?.normal ?? [0, 1, 0];
```

Face normal을 vertex normal에 잘못 매핑. 평면 쉐이딩이어야 할 곳에 스무스 쉐이딩 적용. 가로등, 신호등, 벤즈가 "이상한 빛"을 받음.

---

### 7. Triangulation 실패 시 fallback — 원래 형태와 완전 다른 geometry

**위치**: `src/assets/compiler/building/building-mesh.shell.builder.ts:317-326`

```typescript
if (triangles.length === 0) {
  pushBox(geometry, bounds.minX, bounds.minZ, bounds.maxX, bounds.maxZ, baseY, topY);
  return;  // footprint과 무관한 경계박스로 대체
}
```

Triangulate가 실패하면 원래 footprint 대신 단순 경계박스를 생성. L자, T자 건물이 직사각형으로 바뀜.

---

### 8. Gable/Hipped Roof — 비직사각형 footprint에서 파괴

**위치**: `src/assets/compiler/building/building-mesh.shell.builder.ts:570-660`

```typescript
const ridgeA: Vec3 = ridgeAlongX
  ? [bounds.minX, ridgeHeight, (bounds.minZ + bounds.maxZ) / 2]
  : [(bounds.minX + bounds.maxX) / 2, ridgeHeight, bounds.minZ];
```

Gable roof가 직사각형 bounds를 가정. L자, U자 건물에서 능선이 건물 밖으로 나가거나 왜곡됨.

---

### 9. `insetRing` Y좌표 손실 — 고도 정보 파괴

**위치**: `src/assets/compiler/building/building-mesh.shell.builder.ts:123-130`

```typescript
return points.map((point) => [
  center[0] + (point[0] - center[0]) * (1 - ratio),
  0,  // BUG: Y 좌표를 0으로 하드코딩 — 원래 고도 정보 손실!
  center[2] + (point[2] - center[2]) * (1 - ratio),
]);
```

Setback 단계에서 Y좌표(고도)를 0으로 덮어씀. 경사지 건물에서 층이 수평으로 왜곡됨.

---

### 10. 환경변수 검증 누락 — 7개 필수 키 미검증

**위치**: `src/config/env.validation.ts:12-22`

Joi 스키마에서 다음 키가 검증에서 완전 누락:
- `OPENAI_KEY`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `GOOGLE_OAUTH_CLIENT` / `GOOGLE_CLIENT_SECRET_KEY`
- `MAPILLARY_SECRET_KEY`
- `OPEN_ELEVATION_URL`

---

### 11. Mapillary 비활성화 — 관측 기반 재질 1%

**위치**: `data/scene/scene-akihabara-tokyo-mo6hnbpq.meta.json`

```json.
"mapillaryUsed": false,
"observedAppearanceRatio": 0.01
```

Mapillary 토큰/커버리지 실패로 모든 facade hint가 추론. `resolvedFallbackSource: 'PLACE_CHARACTER'` — 실제 관측 대신 지역 특성 기반 추측.

**영향**: 아키하바라 특색(전자상가, 네사인, 콘크리트)이 반영되지 않고 일반적 분포.

---

### 12. CORS null origin 허용

**위치**: `src/main.ts:50-62`

```typescript
if (!origin) {
  callback(null, true);  // Origin 없는 요청(curl, 스크립트) 허용
  return;
}
```

---

### 13. Open Elevation 어댑터 — 모든 에러를 빈 배열로 삼킴

**위치**: `src/scene/infrastructure/terrain/open-elevation.adapter.ts:27-65`

```typescript
catch {
  return [];  // HTTP 에러, 파싱 에러, 네트워크 에러 모두 빈 배열
}
```

 terrain 데이터 실패를 알 수 없음. 빈 배열이 반환되어 terrain이 평평해짐.

---

### 14. Weather/Traffic fetch 에러 silent failure

**위치**: `src/places/services/snapshot/place-snapshot.service.ts:45-47`

```typescript
catch {
  weatherObservation = null;  // 에러 로깅 없이 null
}
```

---

### 15. Quality Gate에서 generationMs/glbBytes 하드코딩 0

**위치**: `src/scene/services/generation/scene-quality-gate.service.ts:43-50`

```typescript
const modeComparison = buildSceneModeComparisonReport(
  sceneMeta,
  sceneDetail,
  {
    generationMs: 0,  // 하드코딩
    glbBytes: 0,      // 하드코딩
  },
);
```

---

### 16. `as unknown as` 타입 캐스팅 — 타입 시스템 무력화

**위치**: `src/scene/pipeline/steps/scene-geometry-correction.step.ts:175`

```typescript
} as unknown as SceneGeometryDiagnostic,
```

TypeScript의 타입 체크를 의도적으로 우회. 런타임 에러 가능성.

---

### 17. Terrain Fusion `as any`

**위치**: `src/scene/pipeline/steps/scene-terrain-fusion.step.ts:41`

```typescript
const profile = this.terrainProfileService.resolve(sceneId, {
  bounds,
} as any);
```

---

### 18. GLB Validation이 파일 쓰기 후에 실행

**위치**: `src/assets/internal/glb-build/glb-build-runner.pipeline.ts:351-411`

```typescript
await io.writeBinary(glbDocument, buffer);  // 먼저 씀
// ... 그 후에 validate
```

유효하지 않은 GLB가 이미 디스크에 기록됨.

---

### 19. Material 캐시 무제한 성장

**위치**: `src/assets/internal/glb-build/glb-build-material-cache.ts:25`

```typescript
const materialCache = new Map<string, unknown>();  // 크기 제한 없음
```

장기 실행 프로세스에서 메모리 누수.

---

### 20. Bucket 충돌 — 192개 버킷에 모든 색상 양자화

**위치**: `src/assets/internal/glb-build/glb-build-material-cache.ts:163-202`

`quantizeHexToBucket()`이 brightness(16) × hue(12) = 192개 버킷만 생성. 서로 다른 색상이 동일 버킷에 충돌.

---

### 21. Accessor min/max 누락 — glTF 스펙 위반

**위치**: `src/assets/internal/glb-build/glb-build-mesh-node.ts:152-170`

Position accessor에 `.setMin()`/`.setMax()` 호출 누락. glTF validator에서 실패.

---

### 22. Triangle budget 계산 — 인덱스가 3의 배수인지 검증 안함

**위치**: `src/assets/internal/glb-build/glb-build-mesh-node.ts:91`

```typescript
const triangleCount = geometry.indices.length / 3;  // 나누어떨어지지 않으면 소수점
```

---

### 23. Queue 경합 조건 — `isProcessingQueue` 플래그 비원자적

**위치**: `src/scene/services/generation/scene-generation.service.ts:232-237`

```typescript
if (this.isProcessingQueue) {  // 체크
  return;
}
this.isProcessingQueue = true;  // 설정 — 비원자적
```

동시 요청 시 두 개의 queue processing이 시작될 수 있음.

---

## 🟠 HIGH — 중요 (47개)

### 데이터 수집 레이어

| # | 파일 | 라인 | 문제 |
|---|------|------|------|
| 24 | `overpass.transport.ts` | 191 | `timeoutMs: 40000` 하드코딩 |
| 25 | `overpass.transport.ts` | 107-109 | 비-Error 예외가 일반 Error로 변환 — 스택 트레이스 손실 |
| 26 | `overpass.mapper.ts` | 43-44 | `node.lat as number` — 안전하지 않은 타입 단언 |
| 27 | `overpass.mapper.ts` | 403-442 | `while (remaining.length > 0)` + 중첩 `while (progressed)` — malformed data에서 무한 루프 가능성 |
| 28 | `overpass.mapper.ts` | 404 | `remaining.shift()!` — non-null assertion |
| 29 | `overpass.query.ts` | 36 | `[timeout:25]` 하드코딩 |
| 30 | `google-places.client.ts` | 67, 120 | API URL 하드코딩 |
| 31 | `google-places.client.ts` | 79 | `languageCode: 'en'` 하드코딩 |
| 32 | `mapillary.client.ts` | 119 | `Math.max(1, Math.min(2000, input?.limit ?? 60))` — 매직 넘버 |
| 33 | `mapillary.client.ts` | 399 | `(input as MapillaryFeatureRaw & { images?: unknown })` — unsafe cast |
| 34 | `tomtom-traffic.client.ts` | 54 | `absolute/14/json` — 줌 레벨 14 하드코딩 |
| 35 | `tomtom-traffic.client.ts` | 151-168 | 한국 전용 호스트/바운딩박스 하드코딩 |
| 36 | `open-meteo.client.ts` | 296-306 | 시간 해결 (12, 18, 22시) 하드코딩 |
| 37 | `open-meteo.client.ts` | 318 | `precipitation >= 0.2` 임계값 하드코딩 |
| 38 | `external-places.service.ts` | 28-38 | 부분 실패 처리 안됨 (Google 성공, Overpass 실패 시) |
| 39 | `building-height.estimator.ts` | 7 | `JAPANESE_FLOOR_HEIGHT_METERS = 3.5` — 전역 적용 (Phase 13에서 3.2m로 지적됨) |
| 40 | `fetch-json.ts` | 157 | `data as T` — 런타임 검증 없이 캐스팅 |

### GLB Compiler

| # | 파일 | 라인 | 문제 |
|---|------|------|------|
| 41 | `building-mesh.shell.builder.ts` | 210 | `lodLevel` 캐스팅 — `'HIGH'|'MEDIUM'|'LOW'` 외 값 가능 |
| 42 | `building-mesh.shell.builder.ts` | 47-91 | `collectBuildingShellClosureMetrics` — O(n²) 루프 |
| 43 | `building-mesh.shell.builder.ts` | 506-520 | `triangulateRings` — 동적 배열 성장, 사전 할당 없음 |
| 44 | `building-mesh.shell.builder.ts` | 695-705 | `resolveBuildingGeometryStrategy` — explicit strategy 검증 안함 |
| 45 | `building-mesh.window.builder.ts` | 316-384 | 3중 중첩 루프 + 문자열 해싱 per 윈도우 |
| 46 | `building-mesh.window.builder.ts` | 456-463 | `stableUnitNoise` — 문자열 charCodeAt 반복 — tall building에서 병목 |
| 47 | `building-mesh.window.builder.ts` | 554-555 | `void frameWidth; void sillDepth;` — 데드 코드 |
| 48 | `building-mesh.window.builder.ts` | 465-505 | 40+ 프로퍼티 수동 생성 — `Object.assign`으로 대체 가능 |
| 49 | `building-mesh.facade-frame.utils.ts` | 39-78 | `edgeIndex` 범위 검증 없이 `ring[edgeIndex]` 접근 |
| 50 | `building-mesh.hero.builder.ts` | 199 | `anchors.slice(0, 8)` — anchors가 undefined 가능 |
| 51 | `road-mesh.builder.ts` | 49-85 | Ground mesh 9x9 그리드 — disposal 메커니즘 없음 |
| 52 | `road-mesh.builder.ts` | 514-556 | Crosswalk Y-offset — O(crossings × roads × path_points) |
| 53 | `road-mesh.path.utils.ts` | 34-60 | Path strip 자체 교차 검증 없음 — sharp corner에서 overlapping triangles |
| 54 | `road-mesh.path.utils.ts` | 88-118 | Curb 수직면 flat normal — smooth shading 없음 |
| 55 | `vegetation-mesh.builder.ts` | 97-208 | `variantPool` 무제한 성장 가능 |
| 56 | `vegetation-mesh.builder.ts` | 373-413 | `createVegetationGeometry` — 단순 박스 생성, 내보내기만 됨 |
| 57 | `glb-material-factory.scene-materials.ts` | 264-296 | `as Record<AccentTone, any>` — 타입 안전성 상실 |
| 58 | `glb-material-factory.scene-materials.ts` | 88-97 | `setAlphaMode('MASK')` without texture — fully opaque |
| 59 | `glb-material-factory.scene.utils.ts` | 98-104 | `hexToRgb` — malformed input에서 NaN 반환 |
| 60 | `glb-build-runner.helpers.ts` | 45-301 | `optimizeGlbDocument` — 3중 중첩 try-catch, 부분 변환 상태 가능 |
| 61 | `glb-build-runner.helpers.ts` | 151-156 | Simplify transform index -2 — 배열 길이 체크 없음 |
| 62 | `glb-build-runner.pipeline.ts` | 127-131 | Dynamic import 매 빌드마다 로드 — 메모리 churn |
| 63 | `glb-build-runner.pipeline.ts` | 354 | 30MB 사이즈 체크 하드코딩 |
| 64 | `glb-build-hierarchy.ts` | 36-64 | `resolveParentNode` — 동시 빌드에서 duplicate group nodes |
| 65 | `glb-build-hierarchy.ts` | 61 | `(root ?? scene).addChild(node)` — root undefined 시 hierarchy 우회 |
| 66 | `glb-build-semantic-trace.ts` | 4 | `name.startsWith('building_')` — "building_materials_texture"도 매칭 |
| 67 | `glb-build-variation.utils.ts` | 13-14 | `budget.treeClusterCount`가 0이면 NaN (0/0) |
| 68 | `glb-build-style-metrics.ts` | 157-158 | `groupFacadeHintsByPanelColor()` 재호출 — 불필요한 재계산 |
| 69 | `glb-build-graph-intent.ts` | 87-92 | `prototypeKey` counting — 새 키에 0 추가, undercounting |
| 70 | `glb-build-runner.config.ts` | 117-134 | `parseNumericEnv()` — 파싱 에러 시 로깅 없이 fallback 반환 |

### 파이프라인/서비스

| # | 파일 | 라인 | 문제 |
|---|------|------|------|
| 71 | `scene-generation-pipeline.service.ts` | 134-151 | `fidelityPlan` 수동 전달 — 누락 시 데이터 불일치 |
| 72 | `scene-geometry-correction.step.ts` | 180, 187 | `void appendSceneDiagnosticsLog()` — fire-and-forget, 로그 손실 가능 |
| 73 | `scene-terrain-fusion.step.ts` | 70, 158 | `void appendSceneDiagnosticsLog()` — 동일 문제 |
| 74 | `scene-hero-override-applier.service.ts` | 173 | `void` async — fire-and-forget |
| 75 | `scene-hero-override-applier.service.ts` | 729라인 | God object — landmark, facade, crossing, signage, furniture, decals, intersection 모두 담당 |
| 76 | `scene-asset-profile.service.ts` | 557라인 | 복잡한 선택 로직 — 높은 인지 부하 |
| 77 | `scene-generation.service.ts` | 847라인 | queue + failure + metrics + orchestration 모두 담당 |
| 78 | `scene-traffic-live.service.ts` | 114-136 | `Promise.all` + silent `failedSegmentCount++` — 부분 실패 숨김 |
| 79 | `scene-vision.service.ts` | 136-158 | Mapillary 에러 로깅 없이 fallback 생성 |
| 80 | `scene-fidelity-metrics.utils.ts` | 146-174 | 매직 넘버 가중치 (0.45, 0.35, 0.2) — 문서화 없음 |
| 81 | `scene-fidelity-planner.service.ts` | 278-304 | 10개 항목 가중 합산 — 각 가중치 근거 없음 |
| 82 | `place-character.value-object.ts` | 166-189 | `start_date` 파싱 — `parseInt(startYear.slice(0, 4), 10)` — 불충분한 검증 |
| 83 | `scene-hero-override-matcher.service.ts` | 137-154, 634-654 | `averageCoordinate()` 중복 정의 (여러 파일에서) |

### 스토리지

| # | 파일 | 라인 | 문제 |
|---|------|------|------|
| 84 | `scene.repository.ts` | 212-225 | `evictOldestSceneIfNeeded` — requestIndex 순회 삭제 O(n×m) |
| 85 | `scene-storage.utils.ts` | 107-142 | File-based lock — stale lock 감지에서 race condition (체크→삭제→재시도) |
| 86 | `scene.repository.ts` | 68-70 | `findById` catch에서 `undefined` 반환 — 에러 로깅 없음 |
| 87 | `scene.repository.ts` | 93-95 | `findByRequestKey` catch에서 `undefined` 반환 — 파일 파싱 실패 구분 불가 |

### 보안/인프라

| # | 파일 | 라인 | 문제 |
|---|------|------|------|
| 88 | `main.ts` | 17 | Helmet 기본 설정 — CSP 미정의 |
| 89 | `main.ts` | 22-29 | 글로벌 rate limit만 (100 req/min) — 고비용 엔드포인트 제한 없음 |
| 90 | `health.service.ts` | 98-111 | Mapillary 토큰 없으면 `true` 반환 — 설정 문제 은폐 |
| 91 | `health.service.ts` | 9-14 | Redis health check 누락 |
| 92 | `env.validation.ts` | 12-22 | Joi 스키마 불완전 (위 #10 참조) |
| 93 | `.github/workflows/` | 전체 | CI/CD 파이프라인 전무 |
| 94 | `tsconfig.json` | 22-24 | `noImplicitAny: false`, `strictBindCallApply: false`, `noFallthroughCasesInSwitch: false` |
| 95 | `external-url-validation.util.ts` | 92-95 | IP 검증 로직 버그 — octet 길이 ≠ 4일 때 `true` 반환 |
| 96 | `fetch-json.ts` | 54-98 | 429 외 에러에 대한 retry 전략 부재 |
| 97 | `app-logger.service.ts` | 43-61 | stdout만 출력 — ELK/CloudWatch/Datadog 연동 없음 |
| 98 | `metrics.controller.ts` | 전체 | 인증 없이 metrics 노출 |
| 99 | `main.ts` | 15 | `app.enableShutdownHooks()`만 호출 — 활성 job 정리 로직 없음 |
| 100 | `ttl-cache.service.ts` | 전체 | 테스트 전무 |

---

## 🟡 MEDIUM — 개선 필요 (68개)

### 매직 넘버 (문서화/상수화 필요)

| # | 파일 | 라인 | 값 | 용도 |
|---|------|------|-----|------|
| 101 | `building-mesh.shell.builder.ts` | 22 | 0.4 | MIN_FOUNDATION_DEPTH |
| 102 | `building-mesh.shell.builder.ts` | 23 | 1.1 | MAX_FOUNDATION_DEPTH |
| 103 | `building-mesh.shell.builder.ts` | 25 | 0.5 | MIN_SETBACK_RING_AREA_M2 |
| 104 | `building-mesh.shell.builder.ts` | 76 | 0.12 | inset ratio |
| 105 | `building-mesh.shell.builder.ts` | 76 | 0.04 | stage multiplier |
| 106 | `building-mesh.shell.builder.ts` | 213 | 1.5 | simplify tolerance LOW |
| 107 | `building-mesh.shell.builder.ts` | 217 | 0.8 | simplify tolerance MEDIUM |
| 108 | `building-mesh.shell.builder.ts` | 224 | 0.52 | podium height ratio |
| 109 | `building-mesh.shell.builder.ts` | 253 | 0.58 | tower base ratio |
| 110 | `building-mesh.shell.builder.ts` | 296 | 0.72 | roof base ratio |
| 111 | `building-mesh.shell.builder.ts` | 414 | 0.45 | hero podium ratio (0.52와 불일치) |
| 112 | `building-mesh.window.builder.ts` | 100 | 420,000 | max window triangles |
| 113 | `building-mesh.window.builder.ts` | 119 | 3.6 | floor height (지역별 차이 없음) |
| 114 | `building-mesh.window.builder.ts` | 121 | 4/6/9 | LOD별 floor limit |
| 115 | `road-mesh.builder.ts` | 34-44 | 7개 Y offset | 레이어 순서 문서화 없음 |
| 116 | `road-mesh.builder.ts` | 45-47 | 0.072/0.041/0.036 | relief amplitude |
| 117 | `road-mesh.builder.ts` | 57 | 8 | ground grid resolution |
| 118 | `road-mesh.builder.ts` | 457-474 | 1.14/1.08/1.04/0.98/0.9 | road width scale |
| 119 | `overpass.resolve.utils.ts` | 8 | 2 | default lanes |
| 120 | `overpass.resolve.utils.ts` | 13 | 4 | default width (m) |
| 121 | `overpass.resolve.utils.ts` | 24-28 | 3.5/3.2/3 | lane width by class |
| 122 | `overpass.resolve.utils.ts` | 41 | 5 | pedestrian walkway width |
| 123 | `overpass.resolve.utils.ts` | 45 | 2.5 | steps width |
| 124 | `overpass.resolve.utils.ts` | 48 | 3 | default walkway width |
| 125 | `overpass.partitions.ts` | 189 | 3 | footprint tolerance (m) |
| 126 | `overpass.mapper.ts` | 244 | 2.4 | tree radius |
| 127 | `building-mesh-utils.ts` | 5-6 | 111,320 | earth radius approximation |
| 128 | `scene-geometry-correction.logic.ts` | 17-36 | 19개 상수 | 설명 없음 |
| 129 | `glb-build-runner.ts` | 59-85 | 2.5M/180K | triangle budget |
| 130 | `glb-build-runner.pipeline.ts` | 354 | 30MB | size limit |
| 131 | `glb-build-runner.config.ts` | 31 | 600,000 | default timeout (10분) |
| 132 | `scene-storage.utils.ts` | 87 | 1MB | log rotation size |
| 133 | `scene-storage.utils.ts` | 88 | 3 | max backups |
| 134 | `scene-storage.utils.ts` | 110 | 15분 | stale lock timeout |
| 135 | `scene-hero-override-matcher.service.ts` | 10 | 22 | fallback match radius (m) |
| 136 | `scene-generation.service.ts` | 35 | 2 | max generation attempts |
| 137 | `scene-generation.service.ts` | 779-787 | 300/600/1000 | scale별 radius |
| 138 | `scene-quality-gate-thresholds.ts` | 전체 | 다수 | 임계값 근거 없음 |
| 139 | `scene-fidelity-mode-signal.utils.ts` | 전체 | 다수 | signal multiplier 의미 없음 |
| 140 | `glb-build-mesh-node.ts` | 55-63 | 1000/200 | LOD threshold |
| 141 | `glb-build-runner.helpers.ts` | 381-384 | 0.55 | simplification ratio |
| 142 | `glb-build-semantic-trace.ts` | 273 | 12 | SHA1 hash truncation length |
| 143 | `glb-build-graph-intent.ts` | 98 | 24 | instancing groups slice limit |
| 144 | `mapillary.client.ts` | 147 | 12 | max anchors |
| 145 | `mapillary.client.ts` | 152 | 160 | point query limit |
| 146 | `mapillary.client.ts` | 243-244 | 1/1.35/1.8, 0.01 | bbox scales, max area |
| 147 | `mapillary.client.ts` | 299 | 25 | radius (m) |
| 148 | `google-places.client.ts` | 157-169 | 0.002 | viewport fallback delta |
| 149 | `overpass.transport.ts` | 211 | 250 | backoff base (ms) |
| 150 | `fetch-json.ts` | 50 | 2 | default retry count |
| 151 | `fetch-json.ts` | 64 | 10000 | default timeout (ms) |
| 152 | `building-mesh.facade-frame.utils.ts` | 54 | 0.28 | min edge length |
| 153 | `building-mesh.geometry-primitives.ts` | 46 | 1e-6 | degenerate triangle threshold |
| 154 | `road-mesh.builder.ts` | 337 | 9.6/6.3 | crosswalk half-width |
| 155 | `road-mesh.builder.ts` | 343-345 | 10-16/7-12 | stripe count ranges |
| 156 | `vegetation-mesh.builder.ts` | 97-208 | 다수 | tree params |
| 157 | `glb-build-local-geometry.utils.ts` | 234 | 0.142 | crosswalk Y |
| 158 | `glb-build-material-cache.ts` | 109,118,125 | regex | `^` anchor만, `$` 누락 |
| 159 | `glb-build-style.utils.ts` | 217 | `:` | color key delimiter — color에 `:` 포함 시 파싱 파괴 |
| 160 | `overpass.partitions.ts` | 306 | 1e-12 | polygon area epsilon |
| 161 | `building-mesh.tone.utils.ts` | 전체 | 다수 | tone analysis thresholds |
| 162 | `building-mesh.panels.builder.ts` | 전체 | 다수 | density calculations |
| 163 | `building-mesh.roof-equipment.builder.ts` | 전체 | 다수 | arbitrary scaling |
| 164 | `building-mesh.entrance.builder.ts` | 전체 | 다수 | hardcoded dimensions |
| 165 | `building-mesh.facade-band.utils.ts` | 전체 | 다수 | undocumented ratios |
| 166 | `ground-material-profile.utils.ts` | 전체 | 다수 | incomplete land cover mapping |
| 167 | `street-furniture-mesh.assembly.ts` | 전체 | 다수 | magic numbers |
| 168 | `scene-geometry-correction.logic.ts` | 22 | 3 | COLLISION_NEAR_ROAD_METERS |
| 169 | `scene-geometry-correction.logic.ts` | 23 | 0.06 | BASE_GROUND_OFFSET_ON_COLLISION_METERS |

### 중복 코드

| # | 설명 | 영향 파일 |
|---|------|-----------|
| 170 | `toLocalPoint` — 좌표 변환 로직 4개 파일에 복제 | `building-mesh-utils.ts`, `road-mesh.geometry.utils.ts`, `vegetation-mesh-geometry.utils.ts`, `street-furniture-mesh.geometry.utils.ts` |
| 171 | `averageCoordinate` — 3개 파일에 복제 | `scene-hero-override-matcher.service.ts`, `scene-hero-override-applier.service.ts`, `scene-asset-profile.service.ts` |
| 172 | `distanceMeters` — 2개 파일에 복제 | `scene-hero-override-applier.service.ts`, `scene-geometry-correction.utils.ts` |
| 173 | `pushBox` — geometry primitive 2개 파일에 복제 | `building-mesh.geometry-primitives.ts`, `street-furniture-mesh.geometry.utils.ts` |
| 174 | `normalizeLocalRing` — 2개 파일 | `building-mesh-utils.ts`, `road-mesh.geometry.utils.ts` |
| 175 | `seedHappyPathMocks` — 동일 파일 내 3회 복제 | `phase14-integration-validation.spec.ts` |

### 테스트 문제

| # | 파일 | 문제 |
|---|------|------|
| 176 | 전체 테스트 (17개 파일) | 모든 외부 클라이언트 mocking — 실제 통합 테스트 없음 |
| 177 | `scene.integration.spec.ts` | `seedHappyPathMocks()`가 실제 로직 우회 |
| 178 | `phase14-integration-validation.spec.ts` | `as any` 6회 사용 |
| 179 | `phase11-place-readability.spec.ts` | `import { mock } from 'bun:test'` — 사용 안함 |
| 180 | `scene.service.spec.fixture.ts:515` | `process.env.TOMTOM_API_KEY = 'spec-key'` — 글로벌 환경 변형 |
| 181 | 전체 | E2E 테스트 전무 |
| 182 | 전체 | DB 상태 검증 없음 — mock 호출만 확인 |
| 183 | `phase9-terrain-fusion.spec.ts:108` | `expect(capturedPoints).toHaveLength(81)` — 81 근거 없음 |
| 184 | `phase14-integration-validation.spec.ts:256-257` | `void rm(testTerrainDir, ...)` — fire-and-forget 정리 |

---

## ⚪ LOW — 사소한 문제 (42개)

| # | 문제 | 위치 |
|---|------|------|
| 185 | `MVP_SYNTHETIC_RULES` 데드 코드 참조 | 테스트 파일 3곳 |
| 186 | 한국어 에러 메시지 — i18n 미지원 | `overpass.transport.ts:221`, `google-places.client.ts:142` 등 |
| 187 | `scene-meta-builder.step.ts:38` — `void detail` 미사용 파라미터 | |
| 188 | `scene.types.ts` — `SceneFacadeHint` optional 필드 과다 | |
| 189 | `scene-model.types.ts` — camelCase와 snake_case 혼용 | |
| 190 | 테스트 temp 디렉토리 충돌 가능성 | `.phase14-spec-temp`, `.phase9-spec-temp` |
| 191 | `TESTING.md` 부재 | |
| 192 | `main.ts:48` — 하드코딩 CORS origins | |
| 193 | 로그 로테이션은 구현되었지만 logrotate 미연동 | |
| 194 | Docker/Docker Compose 설정 부재 | |
| 195 | k8s 매니페스트 부재 | |
| 196 | Circuit breaker 패턴 부재 — 모든 외부 API | |
| 197 | Request-level timeout 미설정 | |
| 198 | `scene-semantic-coverage.utils.ts` — 카테고리 이름 변경 시 연쇄 수정 필요 | |
| 199 | `glb-build-runner.output.ts:109-123` — 3회 sequential await, Promise.all 미사용 | |
| 200 | `glb-build-runner.output.ts:76-84` — `groupedBuildings` 순회에서 `any` 타입 | |
| 201 | `scene-hero-override-matcher.service.ts:9` — manifest 배열에 1개 항목만 | |
| 202 | `place-catalog.service.ts` — fixture 기반, DB 미사용 | |
| 203 | `overpass.client.ts:202-204` — 하드코딩 카메라 위치 | |
| 204 | `overpass.client.ts:199` — 하드코딩 버전 `'2026.04-external'` | |
| 205 | `open-meteo.client.ts:88` — `source:` 앞 공백 | |
| 206 | `glb-build-runner.config.ts:98-115` — `parseBooleanEnv` 대소문자 처리 | |
| 207 | `scene.repository.ts:107` — `setTimeout(resolve, 0)` — ENOTEMPTY 재시도 | |
| 208 | `scene-fidelity-metrics.utils.ts` — signal multiplier 문서화 없음 | |
| 209 | `scene-quality-gate-geometry.ts` — 19개 상수 설명 없음 | |
| 210 | `scene-variation` — profile 계산 문서화 부족 | |
| 211 | `building-mesh.shell.builder.ts:94-121` — triangulate 함수 3단계 전달 | |
| 212 | `building-mesh.window.builder.ts:38-40` — fallback hint 생성 시 `facadeHints[0]` 접근 — 배열 비면 undefined | |
| 213 | `road-mesh.builder.ts:318` — `roads.length === 0` 체크 있지만 빈 배열 기본값 | |
| 214 | `glb-build-material-tuning.utils.ts` — tuning 계산 overflow 위험 | |
| 215 | `glb-build-facade-material-profile.utils.ts` — profile resolution fallback 체인 | |
| 216 | `glb-build-style.utils.ts` — color quantization 키에 sceneId 미포함 | |
| 217 | `glb-build-transport.stage.ts:170-191` — crosswalk_overlay 소스 count 이중 계산 | |
| 218 | `glb-build-transport.stage.ts:268-277` — median source count 필터 불일치 | |
| 219 | `glb-build-building-hero.stage.ts:504-514` — chunk 순서 미보존 — progressive loading 영향 | |
| 220 | `glb-build-street-context.stage.ts:465-470` — furniture type enum 검증 없음 | |
| 221 | `glb-build-street-context.stage.ts:61-73` — multiple filter passes | |
| 222 | `scene-hero-override-applier.service.ts:656-665` — distanceMeters 복제 | |
| 223 | `scene-geometry-correction.step.ts` — diagnostics append fire-and-forget | |
| 224 | `scene-terrain-profile.service.ts:170` — diagnostics append fire-and-forget | |
| 225 | `scene-asset-profile.step.ts:142` — diagnostics append fire-and-forget | |
| 226 | `scene-quality-gate-mesh-summary.ts:44-47` — 파일 읽기 에러 silent | |

---

## 📋 우선순위별 수정 로드맵

### Phase A — 즉시 (1-2주)

| 순위 | 작업 | 영향 파일 수 | 예상 효과 |
|------|------|-------------|-----------|
| 1 | `.env` 키 회전 + `.gitignore` 추가 | 1 | 보안 치명적 해결 |
| 2 | OSM footprint IoU 기반 중복 제거 | 2 | 건물 중복 3,664→50 이하, Z-fighting 제거 |
| 3 | Terrain offset GLB geometry 반영 | 4 | 고도 차이 실제 수준으로 |
| 4 | Setback 갭 수정 (join geometry) | 1 | 건물 외벽/층 분리 해결 |
| 5 | Window material alpha mode BLEND 설정 | 1 | 유리창 투명화 |
| 6 | Street furniture pushBox normal 수정 | 1 | 쉐이딩 정상화 |
| 7 | 환경변수 검증 완성 | 1 | 설정 오류 조기 발견 |

### Phase B — 단기 (2-4주)

| 순위 | 작업 | 영향 파일 수 | 예상 효과 |
|------|------|-------------|-----------|
| 8 | Mapillary 활성화 | 3 | observedAppearanceRatio 0.01→0.40+ |
| 9 | Material 캐시 크기 제한 + bucket 세분화 | 2 | 메모리 누수 방지, 색상 정확도 향상 |
| 10 | Accessor min/max 추가 | 1 | glTF 스펙 준수 |
| 11 | 일본 층고 3.2m→3.5m (또는 지역별) | 2 | 건물 높이 정확도 |
| 12 | 좌표 변환 공통 utility 추출 | 4 | 중복 제거, 일관성 |
| 13 | Fire-and-forget diagnostics → await + 에러 처리 | 5 | 진단 로그 신뢰성 |
| 14 | Queue 경합 조건 수정 (atomic flag) | 1 | 동시 처리 안정성 |
| 15 | GLB validation → write 이전으로 이동 | 1 | 유효하지 않은 GLB 방지 |

### Phase C — 중기 (1-2개월)

| 순위 | 작업 | 영향 파일 수 | 예상 효과 |
|------|------|-------------|-----------|
| 16 | God object 분할 (hero-override 729→3개) | 1 | 유지보수성 |
| 17 | CI/CD 파이프라인 구축 | 3 | 자동 테스트/배포 |
| 18 | E2E 테스트 도입 | 5+ | 실제 동작 검증 |
| 19 | Circuit breaker 외부 API | 6+ | 외부 장애 격리 |
| 20 | TypeScript strict mode 활성화 | 전체 | 타입 안전성 |
| 21 | 매직 넘비 상수화 + 문서화 | 30+ | 코드 가독성 |
| 22 | Gable/Hipped roof 비직사각형 지원 | 1 | 지붕 정확도 |
| 23 | Triangulation fallback 개선 | 1 | footprint 왜곡 방지 |
| 24 | Window stableUnitNoise 최적화 | 1 | 성능 향상 |
| 25 | PlaceReadability 개선 (street furniture, crosswalk, signage) | 5+ | PlaceReadability 0.185→0.60 |

### Phase D — 장기 (2-3개월)

| 순위 | 작업 | 예상 효과 |
|------|------|-----------|
| 26 | Docker/K8s 배포 인프라 | 프로덕션 배포 |
| 27 | Structured logging (ELK/Datadog) | 운영 가시성 |
| 28 | gl-matrix 등 수학 라이브러리 도입 | geometry 안정성 |
| 29 | GLB GPU instancing (EXT_mesh_gpu_instancing) | 렌더링 성능 |
| 30 | Overall Score 0.555→0.80 달성 | 최종 목표 |

---

## 🎯 핵심 수치 비교

| 지표 | 현재 | 목표 |
|------|------|------|
| Overall Score | 0.555 | 0.80 |
| Structure | 0.802 | 유지 |
| Atmosphere | 0.595 | 0.75 |
| **PlaceReadability** | **0.185** | **0.60** |
| buildingOverlapCount | 3,664 | <50 |
| terrainAnchoredBuildingCount | 0 | >80% |
| observedAppearanceRatio | 0.01 | 0.40+ |
| GLB 파일 크기 | 43MB | <25MB |
| Quality Gate | FAIL | PASS |
| CRITICAL diagnostics | 3개 | 0개 |

---

> **결론**: 이 프로젝트는 아키텍처 자체는 괜찮다 (DDD, 레이어 분리, 파이프라인 패턴). 하지만 **구현 디테일에서 180+ 개 문제**가 발견됨. 가장 큰 병목은 **OSM 중복 제거**와 **Terrain 반영**이며, 이 두 가지만 해결해도 시각적 품질이 40%→60% 이상 개선될 것으로 예상.
