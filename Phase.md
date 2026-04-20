# WorMap 디지털 트윈 — Phase별 개선 로드맵

> **작성일**: 2026-04-20
> **근거**: 종합 코드 감사 리포트 (180+ 개 문제 발견)
> **목표**: Overall Score 0.555 → 0.80, 현실 재현율 40% → 80%+

---

## 📋 전체 페이즈 요약

| Phase | 이름 | 심각도 | 예상 기간 | 핵심 지표 개선 |
|-------|------|--------|-----------|----------------|
| Phase 0 | 보안 긴급 조치 | 🔴 CRITICAL | 1일 | API 키 노출 제거 |
| Phase 1 | OSM 건물 중복 제거 | 🔴 CRITICAL | 3-5일 | buildingOverlapCount 3,664 → <50 |
| Phase 2 | Terrain Offset GLB 반영 | 🔴 CRITICAL | 3-5일 | terrainAnchoredBuildingCount 0 → 80%+ |
| Phase 3 | Setback 갭 + Geometry 파괴 수정 | 🔴 CRITICAL | 3-4일 | CRITICAL_SHELL_CLOSURE 제거 |
| Phase 4 | Material/렌더링 버그 수정 | 🔴 CRITICAL | 2-3일 | observedAppearanceRatio 0.01 → 0.20+ |
| Phase 5 | Mapillary 활성화 + 관측 기반 재질 | 🟠 HIGH | 3-5일 | observedAppearanceRatio 0.20 → 0.40+ |
| Phase 6 | GLB 빌드 시스템 안정화 | 🟠 HIGH | 3-4일 | glTF 스펙 준수, 메모리 안정 |
| Phase 7 | 타입 안전성 + 에러 처리 | 🟠 HIGH | 2-3일 | as any/unknown 제거 |
| Phase 8 | 중복 코드 제거 + 공통 Utility | 🟡 MEDIUM | 2-3일 | DRY 위반 6개 패턴 해결 |
| Phase 9 | 매직 넘버 상수화 + 문서화 | 🟡 MEDIUM | 2-3일 | 68개 매직 넘버 정리 |
| Phase 10 | Fire-and-Fire Async 수정 | 🟠 HIGH | 1-2일 | 로그 손실 방지 |
| Phase 11 | God Object 분할 | 🟠 HIGH | 3-5일 | 유지보수성 개선 |
| Phase 12 | 테스트 인프라 구축 | 🟠 HIGH | 3-5일 | E2E 테스트 도입 |
| Phase 13 | CI/CD 파이프라인 | 🟠 HIGH | 2-3일 | 자동화 구축 |
| Phase 14 | PlaceReadability 대폭 개선 | 🟡 MEDIUM | 5-7일 | 0.185 → 0.60 |
| Phase 15 | 성능 최적화 | 🟡 MEDIUM | 3-5일 | GLB 43MB → <25MB |
| Phase 16 | TypeScript Strict Mode | 🟡 MEDIUM | 2-3일 | 타입 안전성 완성 |

---

## Phase 0 — 보안 긴급 조치 (1일)

### 목표
프로덕션 API 키 노출 즉시 차단

### 작업 항목

#### 0.1 `.env` Git 추적 제외
- [ ] `.gitignore`에 `.env` 추가
- [ ] `.env.example`에 모든 필수 키 템플릿 추가 (현재 6개 누락)
- [ ] `.env`를 `.env.local`로 이동 (기존 git tracked 파일은 `git rm --cached`)

#### 0.2 `.env.example` 완성
추가해야 할 키 (현재 `env.validation.ts`에서 검증하지만 `.env.example`에 없음):
```
OPENAI_KEY=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
GOOGLE_OAUTH_CLIENT=
GOOGLE_CLIENT_SECRET_KEY=
MAPILLARY_SECRET_KEY=
OPEN_ELEVATION_URL=
SCENE_TERRAIN_DIR=
SCENE_DATA_DIR=
```

#### 0.3 환경변수 검증 완성
**파일**: `src/config/env.validation.ts`

현재 Joi 스키마에 누락된 키 추가:
```typescript
OPENAI_KEY: Joi.string().required(),
UPSTASH_REDIS_REST_URL: Joi.string().uri().required(),
UPSTASH_REDIS_REST_TOKEN: Joi.string().required(),
GOOGLE_OAUTH_CLIENT: Joi.string().required(),
GOOGLE_CLIENT_SECRET_KEY: Joi.string().required(),
MAPILLARY_SECRET_KEY: Joi.string().required(),
```

#### 0.4 API 키 회전 (Git에 커밋된 경우)
- [ ] Google API 키 회전
- [ ] TomTom API 키 회전
- [ ] OpenAI API 키 회전
- [ ] Upstash Redis 토큰 회전
- [ ] Mapillary 토큰 회전

### 검증
- [ ] `git log --all --full-history -- .env`에서 과거 커밋 확인
- [ ] `npm run start:dev` 시 환경변수 검증 통과 확인
- [ ] `.env`가 `.gitignore`에 있는지 확인

---

## Phase 1 — OSM 건물 중복 제거 (3-5일)

### 목표
`buildingOverlapCount: 3,664 → <50`, Z-fighting 제거

### 근본 원인
OSM에서 동일 건물이 `way`(단순 다각형)와 `relation`(복합 다각형) 두 형태로 동시 등록됨. 현재 `id` 기반 중복 제거만 수행하므로 두 형태가 별도 건물로 생성됨.

### 작업 항목

- [X] 1.1 Footprint IoU 계산 유틸리티
- [X] 1.2 Overpass 파티션 중복 제거 로직 (id + footprint IoU)
- [X] 1.3 Relation 우선순위 적용
- [X] 1.4 Spatial indexing 기반 성능 최적화
- [X] 1.5 진단 로깅 확장

#### 1.1 Footprint IoU 계산 유틸리티
**신규 파일**: `src/places/utils/footprint-overlap.utils.ts`

```typescript
interface FootprintOverlapResult {
  iou: number;           // Intersection over Union
  intersectionM2: number;
  unionM2: number;
}

function calculateFootprintIoU(
  ringA: Coordinate[],
  ringB: Coordinate[],
): FootprintOverlapResult;
```

- Shoelace formula로 면적 계산
- Polygon clipping으로 교차 면적 계산 (Sutherland-Hodgman 또는 SAT)
- IoU = intersection / union

#### 1.2 Overpass 파티션 중복 제거 로직
**파일**: `src/places/clients/overpass/overpass.partitions.ts`

현재 `deduplicateBuildings()` 함수를 확장:

```typescript
// 현재: id 기반만
const seen = new Set<string>();
return buildings.filter((b) => {
  if (seen.has(b.id)) return false;
  seen.add(b.id);
  return true;
});

// 변경: id + footprint IoU 기반
const result: OverpassBuilding[] = [];
for (const building of buildings) {
  const isDuplicate = result.some((existing) => {
    // 1. id 동일 → 중복
    if (existing.id === building.id) return true;
    // 2. footprint IoU > 0.85 → 동일 건물로 간주
    const { iou } = calculateFootprintIoU(
      existing.footprint,
      building.footprint,
    );
    return iou > 0.85;
  });
  if (!isDuplicate) {
    result.push(building);
  }
}
```

#### 1.3 Relation 우선순위
- `relation` 타입 건물이 `way`보다 완전한 geometry를 가질 가능성이 높음
- 중복 시 `relation` 우선 유지, `way` 제거
- 단, `relation`이 `way`보다 면적이 현저히 작으면 반대

#### 1.4 성능 최적화
- 4,000+ 건물의 O(n²) IoU 계산은 비현실적
- **Spatial indexing** 도입:
  - 건물을 grid cell로 분할 (예: 50m × 50m)
  - 동일/인접 cell 내 건물만 IoU 비교
  - AABB(경계박스) overlap 체크로 pre-filter

```typescript
// grid-based spatial index
const cellSize = 50; // meters
const grid = new Map<string, OverpassBuilding[]>();

function getCellKey(lat: number, lng: number): string {
  const cellLat = Math.floor(lat / (cellSize / 111320));
  const cellLng = Math.floor(lng / (cellSize / (111320 * Math.cos(lat * Math.PI / 180))));
  return `${cellLat},${cellLng}`;
}
```

#### 1.5 진단 로깅
**파일**: `src/places/clients/overpass/overpass.partitions.ts`

```typescript
this.appLoggerService.info('overpass.dedup.complete', {
  totalInput: buildings.length,
  afterIdDedup: afterIdDedup.length,
  afterIoUDedup: result.length,
  removedByIoU: afterIdDedup.length - result.length,
  dedupDurationMs: Date.now() - startedAt,
});
```

### 검증
- [ ] 아키하바라 테스트: buildingOverlapCount < 50
- [ ] totalOverlapAreaM2 < 5,000㎡
- [ ] highSeverityOverlap = 0
- [ ] GLB에서 Z-fighting 현상 제거
- [ ] 성능: dedup < 5초 (4,000 건물 기준)

---

## Phase 2 — Terrain Offset GLB 반영 (3-5일)

### 목표
`terrainAnchoredBuildingCount: 0 → 80%+`, 실제 지형 고도 반영

### 근본 원인
1. `scene-terrain-fusion.step.ts:41`에서 `as any` 타입 캐스팅으로 terrain profile resolve 불완전
2. `resolveDemSampleRelief()`에서 `relief * 0.18` 과도한 감쇠 (최대 ±0.45m)
3. DEM 샘플 81개는 계산되지만 건물/도로에 분배 로직 미작동

### 작업 항목

- [X] 2.1 Terrain Profile Resolve 타입 수정
- [X] 2.2 DEM Sample Relief 감쇠 계수 조정
- [X] 2.3 건물 Terrain Offset 분배 로직
- [X] 2.4 도로/Walkway Terrain Offset
- [X] 2.5 Ground Mesh DEM 연동
- [X] 2.6 Terrain Anchored Count 메트릭

#### 2.1 Terrain Profile Resolve 타입 수정
**파일**: `src/scene/pipeline/steps/scene-terrain-fusion.step.ts:38-46`

```typescript
// Before:
const profile = this.terrainProfileService.resolve(sceneId, {
  bounds,
} as any);

// After:
const profile = this.terrainProfileService.resolve(sceneId, {
  bounds,
  origin: placePackage.center,
  radiusM: radiusM,
});
```

`TerrainProfileService.resolve()` 시그니처를 정확히 정의하고 타입 캐스팅 제거.

#### 2.2 DEM Sample Relief 감쇠 계수 조정
**파일**: `src/assets/compiler/road/road-mesh.builder.ts:595-629`

```typescript
// Before:
return Number(Math.max(-0.45, Math.min(0.45, relief * 0.18)).toFixed(4));

// After:
// 실제 지형 고도를 그대로 반영 (감쇠 제거 또는 최소화)
return Number(Math.max(-5, Math.min(5), relief).toFixed(4));
```

건물에도 동일 적용: `src/assets/compiler/building/building-mesh.shell.builder.ts`의 `resolveBuildingVerticalBase()`.

#### 2.3 건물 Terrain Offset 분배 로직
**파일**: `src/scene/pipeline/steps/scene-terrain-fusion.step.ts`

현재 terrain 샘플 81개가 scene 전체에 대해 계산되지만, 개별 건물의 `terrainOffsetM`에 할당되지 않음.

```typescript
// 각 건물의 footprint 중심점에서 DEM 보간
function assignTerrainOffsetToBuildings(
  buildings: SceneMeta['buildings'],
  terrainProfile: TerrainProfile,
): SceneMeta['buildings'] {
  return buildings.map((building) => {
    const center = polygonCentroid(building.outerRing);
    const offset = interpolateDemAtPoint(center, terrainProfile.samples);
    return { ...building, terrainOffsetM: offset };
  });
}
```

#### 2.4 도로/Walkway Terrain Offset
**파일**: `src/scene/pipeline/steps/scene-terrain-fusion.step.ts`

```typescript
// 각 도로 path의 각 점에서 DEM 보간
function assignTerrainOffsetToRoads(
  roads: SceneMeta['roads'],
  terrainProfile: TerrainProfile,
): SceneMeta['roads'] {
  return roads.map((road) => {
    const offsets = road.path.map((point) =>
      interpolateDemAtPoint(point, terrainProfile.samples),
    );
    const avgOffset = offsets.reduce((a, b) => a + b, 0) / offsets.length;
    return { ...road, terrainOffsetM: avgOffset };
  });
}
```

#### 2.5 Ground Mesh DEM 연동
**파일**: `src/assets/compiler/road/road-mesh.builder.ts:49-85`

`createGroundGeometry()`에서 `resolveGroundElevationY()`가 DEM 샘플을 사용하지만, 현재 `resolveDemSampleRelief()`의 감쇠로 인해 효과가 미미. 2.2번 수정 후 자동 해결.

#### 2.6 Terrain Anchored Count 메트릭
**파일**: `src/scene/pipeline/steps/scene-terrain-fusion.step.ts`

```typescript
const anchoredBuildings = result.buildings.filter(
  (b) => Math.abs(b.terrainOffsetM ?? 0) > 0.01,
).length;

const anchoredRoads = result.roads.filter(
  (r) => Math.abs(r.terrainOffsetM ?? 0) > 0.01,
).length;

await appendSceneDiagnosticsLog(sceneId, 'terrain-fusion', {
  terrainAnchoredBuildingCount: anchoredBuildings,
  terrainAnchoredRoadCount: anchoredRoads,
  terrainAnchoredWalkwayCount: anchoredWalkways,
  transportTerrainCoverageRatio: /* 계산 */,
});
```

### 검증
- [ ] terrainAnchoredBuildingCount > 80% of total buildings
- [ ] terrainAnchoredRoadCount > 80% of total roads
- [ ] transportTerrainCoverageRatio > 0.8
- [ ] GLB에서 실제 지형 고도 확인 (언덕, 경사)
- [ ] CRITICAL_TERRAIN_TRANSPORT_ALIGNMENT_DETECTED 제거

---

## Phase 3 — Setback 갭 + Geometry 파괴 수정 (3-4일)

### 목표
건물 외벽/층 분리 현상 제거, CRITICAL_SHELL_CLOSURE 제거

### 작업 항목

- [X] 3.1 Setback 갭 제거
- [X] 3.2 insetRing Y좌표 보존
- [X] 3.3 Triangulation 실패 fallback 개선
- [X] 3.4 Gable/Hipped Roof 비직사각형 지원
- [X] 3.5 insetRing 퇴화 처리 개선

#### 3.1 Setback 갭 제거
**파일**: `src/assets/compiler/building/building-mesh.shell.builder.ts:24`

```typescript
// Before:
const SETBACK_OVERLAP = 0.05;  // 5cm 갭

// After:
const SETBACK_OVERLAP = 0.0;   // 갭 제거
// 또는 join geometry로 연결
```

`pushExtrudedPolygon()`에서 podium와 tower 사이를 연결하는 bridge geometry 추가:

```typescript
// podium top과 tower base 사이에 연결면 생성
function pushSetbackJoinGeometry(
  geometry: GeometryBuffers,
  podiumTopRing: Vec3[],
  towerBaseRing: Vec3[],
  baseY: number,
): void {
  // 두 링 사이를 삼각형으로 연결
  for (let i = 0; i < podiumTopRing.length; i += 1) {
    const p1 = podiumTopRing[i];
    const p2 = podiumTopRing[(i + 1) % podiumTopRing.length];
    const t1 = towerBaseRing[i];
    const t2 = towerBaseRing[(i + 1) % towerBaseRing.length];
    pushTriangle(geometry, p1, p2, t1);
    pushTriangle(geometry, p2, t2, t1);
  }
}
```

#### 3.2 insetRing Y좌표 보존
**파일**: `src/assets/compiler/building/building-mesh.shell.builder.ts:123-130`

```typescript
// Before:
return points.map((point) => [
  center[0] + (point[0] - center[0]) * (1 - ratio),
  0,  // BUG: Y 좌표 손실
  center[2] + (point[2] - center[2]) * (1 - ratio),
]);

// After:
return points.map((point) => [
  center[0] + (point[0] - center[0]) * (1 - ratio),
  point[1],  // 원래 Y 좌표 보존
  center[2] + (point[2] - center[2]) * (1 - ratio),
]);
```

#### 3.3 Triangulation 실패 fallback 개선
**파일**: `src/assets/compiler/building/building-mesh.shell.builder.ts:317-326`

```typescript
// Before:
if (triangles.length === 0) {
  pushBox(geometry, bounds.minX, bounds.minZ, bounds.maxX, bounds.maxZ, baseY, topY);
  return;
}

// After:
if (triangles.length === 0) {
  // 1. earcut 대신 다른 triangulation 시도
  // 2. footprint을 단순화 후 재시도
  // 3. 최후의 수단으로 경계박스 (로깅과 함께)
  this.appLoggerService.warn('building.triangulation.fallback', {
    buildingId: building.objectId,
    strategy,
    ringVertexCount: outerRing.length,
  });
  pushBox(geometry, bounds.minX, bounds.minZ, bounds.maxX, bounds.maxZ, baseY, topY);
  return;
}
```

#### 3.4 Gable/Hipped Roof 비직사각형 지원
**파일**: `src/assets/compiler/building/building-mesh.shell.builder.ts:570-660`

비직사각형 footprint에서 능선을 footprint 내부에 배치:

```typescript
function resolveRidgeForIrregularRing(
  ring: Vec3[],
  ridgeHeight: number,
  baseY: number,
): { ridgeA: Vec3; ridgeB: Vec3 } {
  const centroid = polygonCentroid(ring);
  const bounds = computeRingBounds(ring);

  // 직사각형이면 기존 로직
  if (isApproximatelyRectangular(ring)) {
    // ... 기존 로직
  }

  // 비직사각형: centroid에서 가장 긴 축 방향으로 능선
  const longestAxis = findLongestAxis(ring);
  const ridgeLength = boundsLength(longestAxis) * 0.6;

  return {
    ridgeA: [centroid[0] - ridgeLength / 2, ridgeHeight, centroid[2]],
    ridgeB: [centroid[0] + ridgeLength / 2, ridgeHeight, centroid[2]],
  };
}
```

#### 3.5 insetRing 퇴화 처리 개선
**파일**: `src/assets/compiler/building/building-mesh.shell.builder.ts:77-79`

```typescript
// Before:
if (nextRing.length < 3) {
  metrics.invalidSetbackJoinCount += 1;
  break;  // 해당 층부터 전체 생략
}

// After:
if (nextRing.length < 3) {
  // 현재 링을 그대로 사용 (더 이상 inset 불가)
  metrics.invalidSetbackJoinCount += 1;
  nextRing = [...currentRing];  // fallback: 현재 링 유지
}
```

### 검증
- [ ] CRITICAL_SHELL_CLOSURE_DETECTED 제거
- [ ] CRITICAL_ROOF_WALL_GAP_DETECTED 제거
- [ ] GLB에서 podium↔tower 단절 제거
- [ ] 경사지 건물 층 왜곡 제거
- [ ] L자/U자 건물 지붕 정상 렌더링

---

## Phase 4 — Material/렌더링 버그 수정 (2-3일)

### 목표
관찰 기반 재질 비율 개선, 렌더링 버그 제거

### 작업 항목

- [X] 4.1 Window Glass Alpha Mode
- [X] 4.2 Street Furniture pushBox Normal 수정
- [X] 4.3 Road Marking Alpha Mode
- [X] 4.4 hexToRgb 검증
- [X] 4.5 Material 캐시 크기 제한
- [X] 4.6 Material Bucket 세분화

#### 4.1 Window Glass Alpha Mode
**파일**: `src/assets/compiler/materials/glb-material-factory.enhanced.ts:146-152`

```typescript
// Before:
return doc
  .createMaterial(`window-glass-${type}`)
  .setBaseColorFactor([...params.baseColor, params.alpha ?? 1]);

// After:
return doc
  .createMaterial(`window-glass-${type}`)
  .setBaseColorFactor([...params.baseColor, params.alpha ?? 0.3])
  .setAlphaMode('BLEND')
  .setDoubleSided(true)
  .setMetallicFactor(0.1)
  .setRoughnessFactor(0.05);
```

#### 4.2 Street Furniture pushBox Normal 수정
**파일**: `src/assets/compiler/street-furniture/street-furniture-mesh.geometry.utils.ts:4-86`

Face normal을 vertex normal에 올바르게 매핑:

```typescript
// Before: face normals을 vertex에 잘못 매핑
const normal = faceNormals.find((f) => f.indices.includes(i))?.normal ?? [0, 1, 0];

// After: 각 vertex가 속한 face들의 normal 평균
for (const face of faces) {
  for (const vertexIndex of face.indices) {
    vertexNormals[vertexIndex][0] += face.normal[0];
    vertexNormals[vertexIndex][1] += face.normal[1];
    vertexNormals[vertexIndex][2] += face.normal[2];
    vertexNormalCounts[vertexIndex] += 1;
  }
}
// Normalize
for (let i = 0; i < vertexNormals.length; i += 1) {
  const count = vertexNormalCounts[i];
  if (count > 0) {
    vertexNormals[i] = normalize3d(
      vertexNormals[i][0] / count,
      vertexNormals[i][1] / count,
      vertexNormals[i][2] / count,
    );
  }
}
```

#### 4.3 Road Marking Alpha Mode
**파일**: `src/assets/compiler/materials/glb-material-factory.scene-materials.ts:88-97`

```typescript
// MASK mode without texture → BLEND로 변경 또는 texture 할당
.setAlphaMode('BLEND')
// setAlphaCutoff 제거 (texture 없을 때 의미 없음)
```

#### 4.4 hexToRgb 검증
**파일**: `src/assets/compiler/materials/glb-material-factory.scene.utils.ts:98-104`

```typescript
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = hex.replace('#', '');
  if (normalized.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return { r: 0.5, g: 0.5, b: 0.5 };  // fallback gray
  }
  const red = parseInt(normalized.slice(0, 2), 16) / 255;
  const green = parseInt(normalized.slice(2, 4), 16) / 255;
  const blue = parseInt(normalized.slice(4, 6), 16) / 255;
  return { r: red, g: green, b: blue };
}
```

#### 4.5 Material 캐시 크기 제한
**파일**: `src/assets/internal/glb-build/glb-build-material-cache.ts:25`

```typescript
// Before:
const materialCache = new Map<string, unknown>();

// After:
const MAX_MATERIAL_CACHE_SIZE = 500;
const materialCache = new Map<string, unknown>();

function setMaterialCacheEntry(key: string, value: unknown): void {
  if (materialCache.size >= MAX_MATERIAL_CACHE_SIZE) {
    const firstKey = materialCache.keys().next().value;
    if (firstKey) materialCache.delete(firstKey);
  }
  materialCache.set(key, value);
}
```

#### 4.6 Material Bucket 세분화
**파일**: `src/assets/internal/glb-build/glb-build-material-cache.ts:163-202`

```typescript
// Before: 16 × 12 = 192 buckets
// After: 32 × 24 = 768 buckets (더 세밀한 색상 구분)
const BRIGHTNESS_BUCKETS = 32;  // 16 → 32
const HUE_BUCKETS = 24;         // 12 → 24
```

### 검증
- [ ] 유리창 투명 렌더링 확인
- [ ] 가로등/신호등 쉐이딩 정상화
- [ ] Material 캐시 메모리 사용량 < 50MB
- [ ] 색상 충돌 감소 (bucket 192 → 768)

---

## Phase 5 — Mapillary 활성화 + 관측 기반 재질 (3-5일)

### 목표
`observedAppearanceRatio: 0.01 → 0.40+`, `mapillaryUsed: false → true`

### 작업 항목

- [X] 5.1 Mapillary 토큰/커버리지 진단
- [X] 5.2 Mapillary 커버리지 체크
- [X] 5.3 Fallback 로깅 개선
- [X] 5.4 PlaceCharacter fallback 신뢰도 표시

#### 5.1 Mapillary 토큰/커버리지 진단
**파일**: `src/places/clients/mapillary.client.ts`

```typescript
// 토큰 유효성 검사 추가
async function validateMapillaryToken(token: string): Promise<boolean> {
  try {
    const response = await fetch('https://graph.mapillary.com/images?limit=1', {
      headers: { Authorization: `OAuth ${token}` },
    });
    return response.ok || response.status === 404;  // 404는 토큰 유효 (데이터 없음)
  } catch {
    return false;
  }
}
```

#### 5.2 Mapillary 커버리지 체크
**파일**: `src/scene/services/vision/scene-vision.service.ts`

```typescript
// Mapillary 이미지 커버리지 확인
async function checkMapillaryCoverage(
  bounds: GeoBounds,
  token: string,
): Promise<{ hasCoverage: boolean; imageCount: number }> {
  // bounds 내 Mapillary 이미지 수 조회
  const response = await fetch(
    `https://graph.mapillary.com/images?bbox=${bounds.southWest.lng},${bounds.southWest.lat},${bounds.northEast.lng},${bounds.northEast.lat}&limit=1`,
    { headers: { Authorization: `OAuth ${token}` } },
  );
  const data = await response.json();
  return {
    hasCoverage: data.data?.length > 0,
    imageCount: data.data?.length ?? 0,
  };
}
```

#### 5.3 Fallback 로깅 개선
**파일**: `src/scene/services/vision/scene-vision.service.ts:136-158`

```typescript
} catch (error) {
  // Before: 에러 로깅 없이 fallback
  // After: 에러 상세 로깅
  this.appLoggerService.error('scene.vision.mapillary.failed', {
    sceneId,
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    fallbackUsed: true,
  });
  // ... fallback
}
```

#### 5.4 PlaceCharacter fallback 신뢰도 표시
**파일**: `src/scene/services/asset-profile/scene-asset-profile.service.ts`

PlaceCharacter 기반 추론 시 `weakEvidence: true` 명시:

```typescript
if (resolvedFallbackSource === 'PLACE_CHARACTER') {
  return {
    ...profile,
    weakEvidence: true,
    evidenceSource: 'PLACE_CHARACTER_FALLBACK',
    confidence: 0.3,  // 추론 신뢰도 낮게 설정
  };
}
```

### 검증
- [ ] mapillaryUsed: true
- [ ] observedAppearanceRatio > 0.40
- [ ] weakEvidenceRatio < 0.40
- [ ] Mapillary 실패 시 상세 로그 확인

---

## Phase 6 — GLB 빌드 시스템 안정화 (3-4일)

### 목표
glTF 스펙 준수, 메모리 안정, Triangle budget 정확

### 작업 항목

- [X] 6.1 Accessor min/max 추가
- [X] 6.2 Triangle budget 계산 수정
- [X] 6.3 GLB Validation → Write 이전
- [X] 6.4 Mesh Optimization 부분 변환 상태 방지
- [X] 6.5 Material 캐시 bucket 충돌 수정
- [X] 6.6 Division by Zero 방지

#### 6.1 Accessor min/max 추가
**파일**: `src/assets/internal/glb-build/glb-build-mesh-node.ts:152-170`

```typescript
// Position accessor에 min/max 추가
const positionAccessor = doc
  .createAccessor()
  .setType('VEC3')
  .setArray(positions)
  .setMin([minX, minY, minZ])
  .setMax([maxX, maxY, maxZ]);
```

#### 6.2 Triangle budget 계산 수정
**파일**: `src/assets/internal/glb-build/glb-build-mesh-node.ts:91`

```typescript
// Before:
const triangleCount = geometry.indices.length / 3;

// After:
if (geometry.indices.length % 3 !== 0) {
  this.appLoggerService.warn('glb-build.indices.not-divisible-by-3', {
    meshName,
    indicesLength: geometry.indices.length,
  });
}
const triangleCount = Math.floor(geometry.indices.length / 3);
```

#### 6.3 GLB Validation → Write 이전
**파일**: `src/assets/internal/glb-build/glb-build-runner.pipeline.ts:351-411`

```typescript
// Before: write → validate
await io.writeBinary(glbDocument, buffer);
const validation = await validateGlb(glbDocument);

// After: validate → write
const validation = await validateGlb(glbDocument);
if (validation.errors.length > 0) {
  this.appLoggerService.error('glb-build.validation.failed', {
    sceneId,
    errors: validation.errors,
  });
  throw new Error(`GLB validation failed: ${validation.errors.join(', ')}`);
}
await io.writeBinary(glbDocument, buffer);
```

#### 6.4 Mesh Optimization 부분 변환 상태 방지
**파일**: `src/assets/internal/glb-build/glb-build-runner.helpers.ts:45-301`

```typescript
// Before: 3중 중첩 try-catch, 부분 변환 가능
// After: 원본 문서 clone → 변환 시도 → 실패 시 원본 사용
async function optimizeGlbDocument(doc: Document): Promise<Document> {
  const originalJson = JSON.stringify(doc.getRoot().toJSON());

  try {
    // ... 최적화 시도
    return doc;
  } catch (error) {
    // 원본으로 복원
    const originalDoc = new Document();
    originalDoc.getRoot().fromJSON(JSON.parse(originalJson));
    this.appLoggerService.warn('glb-build.optimization.failed', { error });
    return originalDoc;
  }
}
```

#### 6.5 Material 캐시 bucket 충돌 수정
**파일**: `src/assets/internal/glb-build/glb-build-material-cache.ts:109,118,125`

```typescript
// Before: regex ^ anchor만, $ 누락
if (/^#?[0-9a-f]{6}$/i.test(color)) { ... }

// After: 완전 매칭
if (/^#?[0-9a-f]{6}$/i.test(color) && color.length <= 7) { ... }
```

#### 6.6 Division by Zero 방지
**파일**: `src/assets/internal/glb-build/glb-build-variation.utils.ts:13-25`

```typescript
// Before: 0/0 → NaN
const treeRatio = budget.treeClusterCount / selected.treeClusterCount;

// After:
const treeRatio = selected.treeClusterCount > 0
  ? budget.treeClusterCount / selected.treeClusterCount
  : 1;
```

### 검증
- [ ] glTF validator 통과 (0 errors)
- [ ] Triangle budget 정확 (소수점 없음)
- [ ] Mesh optimization 실패 시 원본 유지
- [ ] Division by Zero 없음 (NaN 체크)

---

## Phase 7 — 타입 안전성 + 에러 처리 (2-3일)

### 목표
`as any`, `as unknown as` 제거, 에러 처리 일관화

### 작업 항목

- [X] 7.1 `as unknown as` 제거
- [X] 7.2 `as any` 제거
- [X] 7.3 Overpass mapper 타입 단언 제거
- [X] 7.4 Open Elevation 어댑터 에러 로깅
- [X] 7.5 Weather/Trafetch 에러 로깅
- [X] 7.6 Scene Repository 에러 로깅

#### 7.1 `as unknown as` 제거
**파일**: `src/scene/pipeline/steps/scene-geometry-correction.step.ts:175`

```typescript
// Before:
} as unknown as SceneGeometryDiagnostic,

// After: proper type guard 또는 factory 함수
function createGeometryDiagnostic(
  type: SceneGeometryDiagnostic['type'],
  severity: SceneGeometryDiagnostic['severity'],
  details: Record<string, unknown>,
): SceneGeometryDiagnostic {
  return { type, severity, details, detectedAt: new Date().toISOString() };
}
```

#### 7.2 `as any` 제거
**파일**: `src/scene/pipeline/steps/scene-terrain-fusion.step.ts:41`

TerrainProfileService.resolve() 시그니처를 올바르게 정의.

#### 7.3 Overpass mapper 타입 단언 제거
**파일**: `src/places/clients/overpass/overpass.mapper.ts:43-44`

```typescript
// Before:
lat: node.lat as number,
lng: node.lon as number,

// After:
lat: typeof node.lat === 'number' ? node.lat : Number(node.lat),
lng: typeof node.lon === 'number' ? node.lon : Number(node.lon),
```

#### 7.4 Open Elevation 어댑터 에러 로깅
**파일**: `src/scene/infrastructure/terrain/open-elevation.adapter.ts:27-65`

```typescript
// Before:
catch {
  return [];
}

// After:
catch (error) {
  this.appLoggerService.error('terrain.open-elevation.fetch-failed', {
    url: this.baseUrl,
    pointCount: points.length,
    error: error instanceof Error ? error.message : String(error),
  });
  return [];
}
```

#### 7.5 Weather/Trafetch 에러 로깅
**파일**: `src/places/services/snapshot/place-snapshot.service.ts:45-47`

```typescript
// Before:
catch {
  weatherObservation = null;
}

// After:
catch (error) {
  this.appLoggerService.warn('place-snapshot.weather.fetch-failed', {
    placeId,
    error: error instanceof Error ? error.message : String(error),
  });
  weatherObservation = null;
}
```

#### 7.6 Scene Repository 에러 로깅
**파일**: `src/scene/storage/scene.repository.ts:68-70, 93-95`

```typescript
// Before:
catch {
  return undefined;
}

// After:
catch (error) {
  this.appLoggerService.warn('scene.repository.read-failed', {
    sceneId,
    error: error instanceof Error ? error.message : String(error),
  });
  return undefined;
}
```

### 검증
- [ ] `grep -r "as any" src/` → 0건
- [ ] `grep -r "as unknown as" src/` → 0건
- [ ] 모든 catch 블록에 로깅 추가
- [ ] LSP diagnostics clean

---

## Phase 8 — 중복 코드 제거 + 공통 Utility (2-3일)

### 목표
DRY 위반 6개 패턴 해결

### 작업 항목

- [X] 8.1 공통 좌표 변환 Utility
- [X] 8.2 공통 `averageCoordinate` Utility
- [X] 8.3 공통 `distanceMeters` Utility
- [X] 8.4 공통 `pushBox` Geometry Primitive

#### 8.1 공통 좌표 변환 Utility
**신규 파일**: `src/common/geo/coordinate-transform.utils.ts`

4개 파일에 복제된 `toLocalPoint`, `toLocalRing`, `normalizeLocalRing` 통합:

```typescript
// src/common/geo/coordinate-transform.utils.ts
export function toLocalPoint(
  origin: Coordinate,
  point: Coordinate,
): [number, number, number] {
  const metersPerLat = 111_320;
  const metersPerLng = 111_320 * Math.cos((origin.lat * Math.PI) / 180);
  return [
    (point.lng - origin.lng) * metersPerLng,
    0,
    -(point.lat - origin.lat) * metersPerLat,
  ];
}

export function toLocalRing(
  origin: Coordinate,
  ring: Coordinate[],
): Vec3[] {
  return ring.map((point) => toLocalPoint(origin, point));
}

export function normalizeLocalRing(
  ring: Vec3[],
  orientation: 'CW' | 'CCW',
): Vec3[] {
  // ... 기존 로직
}
```

**수정 대상 파일**:
- `src/assets/compiler/building/building-mesh-utils.ts` → import로 변경
- `src/assets/compiler/road/road-mesh.geometry.utils.ts` → import로 변경
- `src/assets/compiler/vegetation/vegetation-mesh-geometry.utils.ts` → import로 변경
- `src/assets/compiler/street-furniture/street-furniture-mesh.geometry.utils.ts` → import로 변경

#### 8.2 공통 `averageCoordinate` Utility
**신규 파일**: `src/common/geo/coordinate-utils.utils.ts`

3개 파일에 복제된 `averageCoordinate` 통합:

```typescript
export function averageCoordinate(ring: Coordinate[]): Coordinate | null {
  if (ring.length === 0) return null;
  const sum = ring.reduce(
    (acc, point) => ({
      lat: acc.lat + point.lat,
      lng: acc.lng + point.lng,
    }),
    { lat: 0, lng: 0 },
  );
  return {
    lat: sum.lat / ring.length,
    lng: sum.lng / ring.length,
  };
}
```

**수정 대상 파일**:
- `src/scene/services/hero-override/scene-hero-override-matcher.service.ts`
- `src/scene/services/hero-override/scene-hero-override-applier.service.ts`
- `src/scene/services/asset-profile/scene-asset-profile.service.ts`

#### 8.3 공통 `distanceMeters` Utility
기존 `src/scene/pipeline/steps/scene-geometry-correction.utils.ts`에 이미 존재. 중복 제거.

#### 8.4 공통 `pushBox` Geometry Primitive
**신규 파일**: `src/assets/compiler/geometry/primitives/box.utils.ts`

2개 파일에 복제된 `pushBox` 통합.

### 검증
- [ ] `grep -r "toLocalPoint" src/` → 1개 파일 (공통 utility)에서만 정의
- [ ] `grep -r "averageCoordinate" src/` → 1개 파일에서만 정의
- [ ] 모든 import 경로 정상
- [ ] LSP diagnostics clean

---

## Phase 9 — 매직 넘버 상수화 + 문서화 (2-3일)

### 목표
68개 매직 넘버를 명명된 상수로 전환 + 주석 추가

### 작업 항목

#### 9.1 Building Shell 상수
**파일**: `src/assets/compiler/building/building-mesh.shell.builder.ts`

```typescript
// Before:
const SETBACK_OVERLAP = 0.05;
const MIN_FOUNDATION_DEPTH = 0.4;
const MAX_FOUNDATION_DEPTH = 1.1;

// After:
/** Podium과 tower setback 사이 겹침 거리 (m). 0이면 join geometry 필요. */
const SETBACK_OVERLAP_M = 0.0;

/** 건물 기초 최소 깊이 (m). 지반 안정성 기준. */
const MIN_FOUNDATION_DEPTH_M = 0.4;

/** 건물 기초 최대 깊이 (m). 지하주차장 고려. */
const MAX_FOUNDATION_DEPTH_M = 1.1;

/** Setback 시 링 면적 최소값 (㎡). 이보다 작으면 inset 중단. */
const MIN_SETBACK_RING_AREA_M2 = 0.5;

/** Setback 단계당 inset 비율 (12%). 건축물 퇴보 규정 기반. */
const SETBACK_INSET_RATIO = 0.12;

/** Setback 단계별 추가 inset 비율 (4%씩 증가). */
const SETBACK_STAGE_INSET_INCREMENT = 0.04;
```

#### 9.2 Road 상수
**파일**: `src/assets/compiler/road/road-mesh.builder.ts`

```typescript
/** 도로 base Y 오프셋 (m). 지면 약간 위로. */
const ROAD_BASE_Y = 0.04;

/** 도로 marking Y 오프셋 (m). 도로 base 위. */
const ROAD_MARKING_Y = 0.094;

/** 횡단보도 Y 오프셋 (m). 도로 marking 위. */
const CROSSWALK_Y = 0.142;

/** 지형 relief 격자 해상도 (9×9 grid). */
const GROUND_GRID_RESOLUTION = 8;

/** 지형 relief 방사형 진폭 (m). */
const GROUND_RELIEF_RADIAL_AMPLITUDE_M = 0.072;
```

#### 9.3 Window 상수
**파일**: `src/assets/compiler/building/building-mesh.window.builder.ts`

```typescript
/** 창문 geometry 최대 triangle 수. GLB 크기 제한 기반. */
const MAX_WINDOW_TRIANGLES = 420_000;

/** 창문 1개당 예상 triangle 수 (budget 계산용). */
const WINDOW_TRIANGLES_PER_EMIT_ESTIMATE = 2;

/** 층고 기본값 (m). 상업용 건물 기준. */
const DEFAULT_FLOOR_HEIGHT_M = 3.6;

/** LOD별 최대 표시 층 수. */
const LOD_FLOOR_LIMITS = { LOW: 4, MEDIUM: 6, HIGH: 9 } as const;
```

#### 9.4 Overpass 상수
**파일**: `src/places/clients/overpass/overpass.resolve.utils.ts`

```typescript
/** 도로 차선당 기본 너비 (m). 도시부 기준. */
const DEFAULT_LANE_WIDTH_M = 3.5;

/** 2차로 도로 차선당 너비 (m). */
const TWO_LANE_WIDTH_M = 3.2;

/** 보행자 도로 기본 너비 (m). */
const PEDESTRIAN_WALKWAY_WIDTH_M = 5;

/** 계단 기본 너비 (m). */
const STEPS_WIDTH_M = 2.5;
```

#### 9.5 Geometry Correction 상수
**파일**: `src/scene/pipeline/steps/scene-geometry-correction.logic.ts`

```typescript
/** 건물-도로 충돌 판정 거리 (m). 이 이내면 충돌로 간주. */
const COLLISION_NEAR_ROAD_M = 3;

/** 충돌 시 건물 바닥 오프셋 (m). 도로 위로 이동. */
const BASE_GROUND_OFFSET_ON_COLLISION_M = 0.06;
```

### 검증
- [ ] `grep -rn "= [0-9]" src/`에서 의미 없는 매직 넘버 0건
- [ ] 모든 상수에 JSDoc 주석 추가
- [ ] 기존 동작 변경 없음 (값 동일)

---

## Phase 10 — Fire-and-Forget Async 수정 (1-2일)

### 목표
진단 로그 손실 방지

### 작업 항목

#### 10.1 `void appendSceneDiagnosticsLog()` → `await` + 에러 처리

**대상 파일**:
- `src/scene/pipeline/steps/scene-geometry-correction.step.ts:180, 187`
- `src/scene/pipeline/steps/scene-terrain-fusion.step.ts:70, 158`
- `src/scene/pipeline/steps/scene-asset-profile.step.ts:142`
- `src/scene/services/hero-override/scene-hero-override-applier.service.ts:173`
- `src/scene/services/spatial/scene-terrain-profile.service.ts:170`

```typescript
// Before:
void appendSceneDiagnosticsLog(sceneId, 'step-name', { ... });

// After:
try {
  await appendSceneDiagnosticsLog(sceneId, 'step-name', { ... });
} catch (error) {
  // 진단 로그 실패는 치명적이지 않음 — 경고만
  this.appLoggerService.warn('scene.diagnostics.log-failed', {
    sceneId,
    step: 'step-name',
    error: error instanceof Error ? error.message : String(error),
  });
}
```

### 검증
- [ ] `grep -rn "void appendSceneDiagnosticsLog" src/` → 0건
- [ ] 진단 로그 실패 시 경고 로그 확인

---

## Phase 11 — God Object 분할 (3-5일)

### 목표
729라인, 847라인, 557라인 파일 분할

### 작업 항목

#### 11.1 `scene-hero-override-applier.service.ts` (729라인) 분할

**현재 책임**:
1. Landmark annotation 적용
2. Facade hint 병합
3. Hero building 승격
4. Crossing decals 생성
5. Signage clusters 병합
6. Street furniture 병합
7. Intersection profiles 생성

**분할안**:
```
src/scene/services/hero-override/
├── scene-hero-override-applier.service.ts      (100라인 — orchestration만)
├── scene-landmark-applier.service.ts           (~150라인)
├── scene-facade-hint-merger.service.ts         (~100라인)
├── scene-crossing-decal-builder.service.ts     (~150라인)
├── scene-signage-merger.service.ts             (~80라인)
├── scene-furniture-merger.service.ts           (~80라인)
└── scene-intersection-profile.service.ts       (~100라인)
```

#### 11.2 `scene-generation.service.ts` (847라인) 분할

**현재 책임**:
1. Scene 생성/큐 관리
2. Generation lock
3. 실패 처리/재시도
4. Metrics 기록
5. Pipeline orchestration
6. Weather/Traffic 스냅샷

**분할안**:
```
src/scene/services/generation/
├── scene-generation.service.ts          (150라인 — orchestration만)
├── scene-queue-manager.service.ts       (~200라인)
├── scene-generation-lock.service.ts     (~100라인)
├── scene-failure-handler.service.ts     (~150라인)
├── scene-generation-metrics.service.ts  (~100라인)
└── scene-snapshot.service.ts            (~150라인 — weather/traffic)
```

#### 11.3 `scene-asset-profile.service.ts` (557라인) 분할

**현재 책임**:
1. Asset profile 계산
2. Material class 결정
3. Visual archetype 매핑
4. Context profile 해석

**분할안**:
```
src/scene/services/asset-profile/
├── scene-asset-profile.service.ts       (100라인 — orchestration)
├── asset-material-class.service.ts      (~150라인)
├── asset-visual-archetype.service.ts    (~150라인)
└── asset-context-profile.service.ts     (~120라인)
```

### 검증
- [ ] 각 파일 < 200라인
- [ ] 단일 책임 원칙 준수
- [ ] 기존 테스트 통과
- [ ] 순환 의존성 없음

---

## Phase 12 — 테스트 인프라 구축 (3-5일)

### 목표
E2E 테스트 도입, mocking 의존도 감소

### 작업 항목

#### 12.1 E2E 테스트 프레임워크
**신규 파일**: `test/e2e/scene-generation.e2e-spec.ts`

실제 외부 API를 mock하지 않고 테스트:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';

describe('SceneGeneration E2E', () => {
  // 실제 Overpass API 호출
  it('should deduplicate buildings from Overpass response', async () => {
    // 실제 아키하바라 좌표로 Overpass 쿼리
    // 중복 제거 후 건물 수 검증
  });

  // 실제 GLB 빌드
  it('should generate valid GLB file', async () => {
    // GLB 생성 → glTF validator 통과 확인
  });
});
```

#### 12.2 Integration 테스트 개선
**파일**: `test/scene.integration.spec.ts`

`seedHappyPathMocks()`를 실제 서비스 호출로 변경:

```typescript
// Before: 모든 외부 클라이언트 mock
// After: TestContainer 또는 local mock server 사용
```

#### 12.3 테스트 환경 변수 격리
**파일**: `src/scene/scene.service.spec.fixture.ts:515`

```typescript
// Before: process.env 직접 수정
process.env.TOMTOM_API_KEY = process.env.TOMTOM_API_KEY ?? 'spec-key';

// After: 테스트별 환경 변수 격리
const testEnv = { ...process.env, TOMTOM_API_KEY: 'spec-key' };
```

#### 12.4 Temp 디렉토리 충돌 방지
**파일**: 전체 테스트 파일

```typescript
// Before:
const testDir = join(process.cwd(), '.phase14-spec-temp');

// After:
const testDir = join(process.cwd(), `.spec-temp-${crypto.randomUUID()}`);
```

#### 12.5 테스트 정리 await
**파일**: `test/phase14-integration-validation.spec.ts:256-257`

```typescript
// Before:
void rm(testTerrainDir, { recursive: true, force: true });

// After:
await rm(testTerrainDir, { recursive: true, force: true });
```

### 검증
- [ ] E2E 테스트 5개 이상
- [ ] `bun test` 전체 통과
- [ ] Mock 의존도 50% 감소
- [ ] Temp 디렉토리 충돌 0건

---

## Phase 13 — CI/CD 파이프라인 (2-3일)

### 목표
자동 테스트, 린트, 보안 스캔

### 작업 항목

#### 13.1 GitHub Actions CI
**신규 파일**: `.github/workflows/ci.yml`

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun test
      - run: bun run lint

  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: bun audit --level moderate

  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: bun run build
```

#### 13.2 Pre-commit Hook
**신규 파일**: `.husky/pre-commit`

```bash
#!/bin/sh
bun run lint
bun test --filter "src/"
```

#### 13.3 Docker 설정
**신규 파일**: `Dockerfile`, `docker-compose.yml`

```dockerfile
FROM oven/bun:1-alpine
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build
EXPOSE 3000
CMD ["bun", "run", "start:prod"]
```

### 검증
- [ ] PR 생성 시 CI 자동 실행
- [ ] 테스트 실패 시 merge 차단
- [ ] Docker 빌드 성공
- [ ] `docker-compose up`으로 로컬 실행 가능

---

## Phase 14 — PlaceReadability 대폭 개선 (5-7일)

### 목표
`PlaceReadability: 0.185 → 0.60`

### 작업 항목

#### 14.1 Street Furniture 실제 데이터 기반
- OSM `amenity=*` 태그 활용 확대 (벤치, 쓰레기통, 우체통, 공중전화)
- Mapillary 이미지에서 furniture 감지 (Phase 5 완료 후)

#### 14.2 Crosswalk 정확도 향상
- OSM `highway=crossing` 태그 활용
- 신호등 유무 (`crossing:signals=yes`) 반영
- 점자 블록 geometry 추가

#### 14.3 Signage/네사인
- 아키하바라 특성상 네사인 중요
- Mapillary에서 signage 감지
- 건물 facade에 signage panel 추가

#### 14.4 Vegetation 정확도
- OSM `natural=tree`, `natural=wood` 활용
- 수종별 다른 geometry (Phase 6 vegetation builder 개선)

#### 14.5 Land Cover
- OSM `landuse=*` 태그 활용 (park, grass, forest)
- Ground material을 landuse에 맞게 변경

### 검증
- [ ] PlaceReadability score > 0.60
- [ ] Street furniture count 2배 증가
- [ ] Crosswalk 정확도 > 90%
- [ ] Vegetation count 실제 OSM과 일치

---

## Phase 15 — 성능 최적화 (3-5일)

### 목표
GLB 43MB → <25MB, 빌드 시간 단축

### 작업 항목

#### 15.1 Window stableUnitNoise 최적화
**파일**: `src/assets/compiler/building/building-mesh.window.builder.ts:456-463`

```typescript
// Before: 문자열 해싱
function stableUnitNoise(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

// After: numeric hash (문자열 변환 제거)
function stableUnitNoiseNumeric(seed: number): number {
  let hash = seed * 2654435761;
  hash = Math.imul(hash ^ (hash >>> 16), 2246822519);
  hash = Math.imul(hash ^ (hash >>> 13), 3266489917);
  return ((hash >>> 0) / 4294967295);
}
```

#### 15.2 Crosswalk Y-offset O(n²) → O(n log n)
**파일**: `src/assets/compiler/road/road-mesh.builder.ts:514-556`

Spatial index로 nearest road 탐색:

```typescript
// Before: 모든 도로 순회
for (const road of roads) {
  const distance = distanceToPathMeters(crossing.center, road.path);
}

// After: quadtree 또는 grid 기반 nearest neighbor
const nearestRoad = spatialIndex.findNearest(crossing.center);
```

#### 15.3 GLB Mesh Simplification 강화
**파일**: `src/assets/internal/glb-build/glb-build-runner.helpers.ts`

- LOD별 simplification ratio 조정
-远景 건물 aggressively simplify

#### 15.4 GPU Instancing
**파일**: `src/assets/internal/glb-build/stages/glb-build-street-context.stage.ts`

동일 furniture를 `EXT_mesh_gpu_instancing`로 인스턴싱:

```typescript
// Before: 각 furniture별 별도 mesh
// After: 동일 타입 furniture를 instancing으로 통합
```

### 검증
- [ ] GLB 파일 크기 < 25MB
- [ ] 빌드 시간 < 60초
- [ ] Triangle count 30% 감소
- [ ] Mesh node count 50% 감소

---

## Phase 16 — TypeScript Strict Mode (2-3일)

### 목표
`noImplicitAny: true`, `strictBindCallApply: true`

### 작업 항목

#### 16.1 tsconfig.json 수정
**파일**: `tsconfig.json`

```json
{
  "compilerOptions": {
    "noImplicitAny": true,
    "strictBindCallApply": true,
    "noFallthroughCasesInSwitch": true,
    "strictNullChecks": true,
    "noUncheckedIndexedAccess": true
  }
}
```

#### 16.2 타입 에러 수정
`bun run build`로 타입 에러 확인 후 수정:
- `any` 타입 명시적 선언
- null 체크 추가
- switch fallthrough 명시적 처리

### 검증
- [ ] `bun run build` 타입 에러 0건
- [ ] LSP diagnostics clean
- [ ] 기존 테스트 통과

---

## 📊 Phase별 누적 지표 예상

| Phase 완료 후 | Overlap | Terrain Anchored | Appearance Ratio | PlaceReadability | Overall Score | GLB Size |
|---------------|---------|------------------|------------------|------------------|---------------|----------|
| 현재 | 3,664 | 0 | 0.01 | 0.185 | 0.555 | 43MB |
| Phase 0-1 | <50 | 0 | 0.01 | 0.185 | 0.580 | 43MB |
| Phase 2 | <50 | 80%+ | 0.01 | 0.220 | 0.610 | 43MB |
| Phase 3 | <50 | 80%+ | 0.01 | 0.280 | 0.640 | 43MB |
| Phase 4 | <50 | 80%+ | 0.20 | 0.320 | 0.660 | 43MB |
| Phase 5 | <50 | 80%+ | 0.40 | 0.380 | 0.690 | 43MB |
| Phase 6-10 | <50 | 80%+ | 0.40 | 0.380 | 0.710 | 40MB |
| Phase 14 | <50 | 80%+ | 0.40 | 0.60 | 0.760 | 35MB |
| Phase 15 | <50 | 80%+ | 0.40 | 0.60 | 0.780 | <25MB |
| Phase 16 | <50 | 80%+ | 0.40 | 0.60 | 0.80 | <25MB |

---

## 🎯 최종 목표

| 지표 | 현재 | Phase 16 완료 후 |
|------|------|-----------------|
| Overall Score | 0.555 | **0.80** |
| Structure | 0.802 | 0.85 |
| Atmosphere | 0.595 | 0.75 |
| PlaceReadability | 0.185 | **0.60** |
| buildingOverlapCount | 3,664 | **<50** |
| terrainAnchoredBuildingCount | 0 | **80%+** |
| observedAppearanceRatio | 0.01 | **0.40+** |
| GLB 파일 크기 | 43MB | **<25MB** |
| Quality Gate | FAIL | **PASS** |
| CRITICAL diagnostics | 3개 | **0개** |
| 타입 안전성 | noImplicitAny: false | **strict: true** |
| CI/CD | 없음 | **GitHub Actions** |
| E2E 테스트 | 0개 | **5개+** |
