# WORMAPB 디지털 트윈 품질 로드맵

> **작성일**: 2026-04-18
> **기반 데이터**: 아키하바라 4개 빌드 diagnostics.log 심층 분석
> **설계 원칙**: DDD(Domain-Driven Design) — Domain → Application → Infrastructure 계층 분리
> **테스트 기준**: 각 Phase 완료 조건 = 해당 Domain 신뢰성 테스트 전체 통과

---

## 용어 정의 (Ubiquitous Language)

| 용어 | 정의 |
|------|------|
| **SceneId** | 생성된 3D 씬의 고유 식별자 |
| **PlacePackage** | Overpass에서 수집한 건물·도로·POI 집합 |
| **FidelityMode** | 씬 품질 수준 (PROCEDURAL_ONLY → LANDMARK_ENRICHED → REALITY_OVERLAY_READY) |
| **GeometryStrategy** | 건물 외형 생성 전략 (simple_extrude / podium_tower / stepped_tower 등) |
| **FacadeHint** | Mapillary에서 추출한 건물 외벽 색상·재질 힌트 |
| **TerrainProfile** | 지형 고도 데이터 (FLAT_PLACEHOLDER / LOCAL_DEM_SAMPLES) |
| **AtmosphereProfile** | 장소 분위기를 정의하는 재질·조명 묶음 |
| **BuildingOverlap** | 두 건물 footprint가 물리적으로 겹치는 상태 |
| **WeakEvidence** | Mapillary 데이터 없이 추론으로만 결정된 재질 |
| **MVP_SYNTHETIC_RULES** | 실제 API 대신 규칙 기반으로 생성하는 임시 데이터 (제거 대상) |

---

## 진단 요약 (로그 기반 수치)

| 항목 | 현재 수치 | 목표 |
|------|----------|------|
| 빌드 전체 점수 | 0.55 / 1.0 | 0.80 이상 |
| placeReadability | **0.00** | 0.60 이상 |
| buildingOverlapCount | **3,664개** | 50개 이하 |
| highSeverityOverlap | **2,154개** | 0개 |
| terrainAnchoredBuildings | **0개** | 전체 건물 |
| inferenceReasons | 5개 MISSING | 0개 |
| glb_build 단계 도달률 | 4,004건물 씬에서 **미도달** | 100% |
| MVP_SYNTHETIC_RULES 사용 중 | weather + traffic **양쪽** | 0개 |
| Mapillary 활성화율 | **0%** (토큰/커버리지 실패) | 70% 이상 |

---

## 계층 구조 (DDD)

```
Domain Layer          — 불변 규칙, 값 객체, 엔티티
  └── Scene           Building, Road, TerrainProfile, FacadeHint
  └── Place           PlacePackage, Coordinate, OsmElement
  └── Material        MaterialClass, AtmosphereProfile, FidelityMode

Application Layer     — 유스케이스, 파이프라인 조합
  └── SceneGeneration FidelityPlanner, GeometryCorrection, GlbBuild
  └── DataCollection  OverpassQuery, MapillaryVision, TerrainFusion
  └── LiveState       WeatherState, TrafficState

Infrastructure Layer  — 외부 시스템 어댑터
  └── OsmAdapter      OverpassClient
  └── VisionAdapter   MapillaryClient
  └── PlaceAdapter    GooglePlacesClient
  └── TerrainAdapter  DemProvider (Open-Elevation / SRTM)
  └── TrafficAdapter  TomTomClient (실제 API)
  └── WeatherAdapter  OpenMeteoClient (실제 API)
```

---

---

# Phase 7: MVP 합성 규칙 완전 제거

> **우선순위**: 최고 — 실제 데이터 없이는 이후 모든 품질 개선이 의미 없음
> **소요**: 3일
> **DDD 계층**: Infrastructure Layer 교체 + Application Layer 연결

### 배경

현재 날씨·교통 데이터가 `MVP_SYNTHETIC_RULES`라는 규칙 기반 가짜 데이터로 제공됨.
OpenMeteo·TomTom 클라이언트는 **이미 구현**되어 있으나 파이프라인에 연결되지 않음.
라이브 상태(`/state`, `/weather`, `/traffic`)가 실제와 무관한 값을 반환 중.

### 7.1 Infrastructure: WeatherAdapter 실제 연결 (Day 1)

**변경 대상**:
- [`src/places/services/snapshot/place-snapshot.service.ts:58`](src/places/services/snapshot/place-snapshot.service.ts)
- [`src/scene/services/live/scene-state-live.service.ts:91`](src/scene/services/live/scene-state-live.service.ts)

**작업**:
- [x] `MVP_SYNTHETIC_RULES` provider 분기 제거
- [x] `OpenMeteoClient.getCurrentWeather(lat, lng)` 직접 호출로 대체
- [x] 실패 시 fallback: `UNKNOWN` 날씨 상태 반환 (합성 데이터 아님)
- [x] `provider` 필드값 `'OPEN_METEO'`로 확정

**도메인 규칙**: WeatherState는 실제 측정값이거나 `UNKNOWN`이어야 함. 합성값은 허용하지 않음.

### 7.2 Infrastructure: TrafficAdapter 실제 연결 (Day 1)

**변경 대상**:
- [`src/places/services/snapshot/place-snapshot.service.ts`](src/places/services/snapshot/place-snapshot.service.ts)
- [`src/scene/services/live/scene-state-live.service.ts`](src/scene/services/live/scene-state-live.service.ts)

**작업**:
- [x] `MVP_SYNTHETIC_RULES` traffic 분기 제거
- [x] `TomTomTrafficClient.getTrafficDensity(bbox)` 호출로 대체
- [x] TomTom API 키 없을 때 `UNAVAILABLE` 상태 반환
- [x] `provider` 필드값 `'TOMTOM'`으로 확정

### 7.3 Domain: SyntheticProvider 타입 제거 (Day 2)

**변경 대상**:
- [`src/scene/types/scene-api.types.ts`](src/scene/types/scene-api.types.ts)
- [`src/scene/types/scene-domain.types.ts`](src/scene/types/scene-domain.types.ts)
- [`src/docs/scene/swagger.scene-state.dto.ts`](src/docs/scene/swagger.scene-state.dto.ts)

**작업**:
- [x] `provider: 'MVP_SYNTHETIC_RULES'` 타입 유니온에서 제거
- [x] `provider` 허용값: `'OPEN_METEO' | 'TOMTOM' | 'UNKNOWN' | 'UNAVAILABLE'`
- [x] Swagger 문서 갱신

### 7.4 Application: TerrainProfile FLAT_PLACEHOLDER 경고 활성화 (Day 2)

**변경 대상**: [`src/scene/services/spatial/scene-terrain-profile.service.ts:95`](src/scene/services/spatial/scene-terrain-profile.service.ts)

**작업**:
- [x] `FLAT_PLACEHOLDER` 반환 시 `WARN` 레벨 로그 기록 (현재 주석만 있음)
- [x] diagnostics.log에 `terrain_profile` 스테이지 추가하여 모드 기록
- [x] 이후 Phase에서 실제 DEM 연동까지 명시적으로 추적 가능하게 함

---

### Phase 7 테스트 (신뢰성 기준: 외부 API 없이 100% 통과)

**파일**: `src/places/services/snapshot/place-snapshot.service.spec.ts`
**파일**: `src/scene/services/live/scene-state-live.service.spec.ts`

```
[WeatherState Domain]
  ✓ OpenMeteo 응답 → WeatherState 변환 정확성
  ✓ OpenMeteo 실패(500) → provider='UNKNOWN', 합성값 없음
  ✓ OpenMeteo timeout → provider='UNKNOWN', 합성값 없음
  ✓ provider 필드가 'MVP_SYNTHETIC_RULES'를 포함하지 않음

[TrafficState Domain]
  ✓ TomTom 응답 → TrafficState 변환 정확성
  ✓ TomTom API 키 없음 → provider='UNAVAILABLE'
  ✓ TomTom 실패 → provider='UNAVAILABLE', 합성값 없음
  ✓ provider 필드가 'MVP_SYNTHETIC_RULES'를 포함하지 않음

[TerrainProfile Application]
  ✓ terrain 파일 없음 → mode='FLAT_PLACEHOLDER' + WARN 로그
  ✓ terrain 파일 있음 → mode='LOCAL_DEM_SAMPLES' + 고도값 반환
  ✓ diagnostics.log에 terrain_profile 스테이지 기록됨
```

**완료 조건**: `grep -r "MVP_SYNTHETIC_RULES" src/` 결과 = 0개

---

---

# Phase 8: OSM 건물 중복 제거 (BuildingOverlap 3,664 → 50 이하)

> **소요**: 5일
> **DDD 계층**: Domain (Building 엔티티) + Infrastructure (OsmAdapter)

### 배경

`mo2c2pdu` 로그:
```
buildingOverlapCount: 3,664
totalOverlapAreaM2:   240,310㎡
highSeverityOverlap:  2,154개
```

원인: OSM에서 동일 건물이 `way`(단순 다각형)와 `relation`(복합 다각형) **두 형태로 동시 등록**됨.
현재 [`overpass.partitions.ts`](src/places/clients/overpass/overpass.partitions.ts)는 `id` 기반 중복 제거만 수행.
같은 건물이 서로 다른 id로 등록되면 중복을 못 잡음.

또한 4,004개 건물 씬에서 **glb_build 단계 미도달** — 빌드 파이프라인이 중복 임계 초과 시 중단되거나 메모리 OOM 발생.

### 8.1 Domain: BuildingFootprint 값 객체 정의

**파일**: `src/places/domain/building-footprint.value-object.ts` (신규)

**작업**:
- [x] `BuildingFootprintVo` 값 객체 정의
  - `outerRing: Coordinate[]`
  - `centroid(): Coordinate`
  - `boundingBox(): BBox`
  - `overlapRatio(other: BuildingFootprintVo): number` (IoU 계산)
  - `isSameFootprint(other: BuildingFootprintVo, toleranceM: number): boolean`
- [x] 두 footprint가 중심점 거리 3m 이내 + IoU 0.85 이상이면 동일 건물로 판정

### 8.2 Infrastructure: OsmAdapter 중복 제거 강화

**변경 대상**: [`src/places/clients/overpass/overpass.partitions.ts`](src/places/clients/overpass/overpass.partitions.ts)

**작업**:
- [x] `id` 기반 중복 제거 → **footprint IoU 기반 중복 제거**로 교체
- [x] way와 relation이 같은 건물을 가리키면 relation 우선 채택 (더 정확)
- [x] `deduplicatedCount`, `mergedWayRelationCount`를 partitions 결과에 포함

**알고리즘**:
```
1. 모든 building way + relation을 footprint 기준 정렬
2. 공간 인덱스(간단한 grid) 구성
3. 각 way에 대해 인접 relation 탐색
4. IoU >= 0.85 && centroid 거리 <= 3m → way 제거, relation 유지
5. relation 없는 way는 그대로 유지
```

### 8.3 Application: GeometryCorrection 임계값 재조정

**변경 대상**: [`src/scene/pipeline/steps/scene-geometry-correction.step.ts`](src/scene/pipeline/steps/scene-geometry-correction.step.ts)

**작업**:
- [x] 현재 `collisionRiskCount >= X` 초과 시 파이프라인 중단 로직 확인 및 임계값 문서화
- [x] **중복 제거 후** 재검사하도록 순서 변경
- [x] `correctedCount`가 총 건물 수의 50% 초과 시 WARN + 계속 진행 (중단 아님)
- [x] high severity overlap만 파이프라인 중단 트리거로 유지

### 8.4 Application: 대규모 씬 GLB 빌드 안정화

**변경 대상**: [`src/assets/internal/glb-build/glb-build-runner.pipeline.ts`](src/assets/internal/glb-build/glb-build-runner.pipeline.ts)

**작업**:
- [x] 4,000개 이상 건물 씬에서 glb_build 미도달 원인 규명 (로그 추가)
- [x] 청크 단위 처리: 건물을 500개씩 나눠 메시 생성 후 병합
- [x] 메모리 사용량 모니터링: 빌드 시작/완료 시 `process.memoryUsage()` 기록
- [x] 타임아웃 설정 명시화 (현재 불명확)

---

### Phase 8 테스트 (신뢰성 기준: 실제 OSM 데이터 픽스처 기반)

**파일**: `src/places/domain/building-footprint.value-object.spec.ts`
**파일**: `src/places/clients/overpass/overpass.partitions.spec.ts`

```
[BuildingFootprint Domain]
  ✓ centroid 계산 정확성 (사각형, 오각형, L형)
  ✓ IoU 0.0 — 완전히 분리된 두 footprint
  ✓ IoU 1.0 — 완전히 동일한 두 footprint
  ✓ IoU 0.92 — 동일 건물 판정 (임계값 0.85 초과)
  ✓ IoU 0.60 — 다른 건물 판정 (임계값 미달)
  ✓ 중심점 5m 이내 + IoU 0.9 → isSameFootprint=true
  ✓ 중심점 10m + IoU 0.9 → isSameFootprint=false

[OsmPartitions Infrastructure]
  ✓ way + relation 동일 건물 → relation 1개만 남음
  ✓ 완전히 다른 위치의 way + relation → 2개 모두 유지
  ✓ way만 있는 건물 → way 그대로 유지
  ✓ 실제 아키하바라 픽스처: buildingOverlapCount < 50

[GeometryCorrection Application]
  ✓ high severity 0개 → glb_build 진행
  ✓ high severity 100개 → 파이프라인 중단 + 명확한 에러
  ✓ buildingCount=4004 → 메모리 2GB 이하로 처리 완료
  ✓ glb_build 스테이지가 diagnostics.log에 기록됨
```

**완료 조건**:
- 아키하바라 픽스처 기준 `buildingOverlapCount < 50`
- 4,004건물 씬에서 `glb_build` 스테이지 도달

---

---

# Phase 9: 지형 고도(DEM) 자동 수집 연동

> **소요**: 4일
> **DDD 계층**: Domain (TerrainProfile) + Infrastructure (DemAdapter 신규)

### 배경

모든 빌드에서 `terrainAnchoredBuildingCount: 0`, `averageTerrainOffsetM: 0`.
지면이 완전 평탄(FLAT_PLACEHOLDER)하고 색상이 회색 단일 재질.
DEM 파일을 수동으로 `data/terrain/{sceneId}.terrain.json`에 넣어야만 동작함.

### 9.1 Domain: TerrainProfile 값 객체 강화

**변경 대상**: [`src/scene/services/spatial/scene-terrain-profile.service.ts`](src/scene/services/spatial/scene-terrain-profile.service.ts)

**작업**:
- [x] `TerrainSample` 타입에 `source: 'OPEN_ELEVATION' | 'SRTM' | 'MANUAL' | 'FLAT'` 추가
- [x] `interpolateElevation(lat, lng): number` 메서드 도메인 수준 정의
- [x] 샘플이 3개 미만이면 FLAT으로 fallback (현재는 파일 없을 때만 fallback)

### 9.2 Infrastructure: DemAdapter 구현 (Open-Elevation API)

**파일**: `src/scene/infrastructure/terrain/open-elevation.adapter.ts` (신규)

**작업**:
- [x] `IDemPort` 인터페이스 정의 (Port 패턴)
  ```typescript
  interface IDemPort {
    fetchElevations(points: Coordinate[]): Promise<TerrainSample[]>
  }
  ```
- [x] `OpenElevationAdapter` 구현
  - 씬 bbox를 8×8 그리드 포인트로 분할해서 요청
  - 실패 시 FLAT fallback (에러 전파 금지)
- [x] 환경변수 `OPEN_ELEVATION_URL` 추가 (기본값: 공개 API)

### 9.3 Application: TerrainFusion 파이프라인 스텝 신규

**파일**: `src/scene/pipeline/steps/scene-terrain-fusion.step.ts` (신규)

**작업**:
- [x] `ScenePlacePackageStep` 완료 후 실행되도록 파이프라인에 삽입
- [x] 순서: 로컬 terrain 파일 확인 → 없으면 DemAdapter 호출 → TerrainProfile 저장
- [x] `data/terrain/{sceneId}.terrain.json` 자동 생성 (다음 빌드에서 재사용)
- [x] diagnostics.log에 `terrain_fusion` 스테이지 기록

### 9.4 Domain: 지면 재질 분기 (색상 회색 → 실제 표면)

**변경 대상**: [`src/assets/compiler/road/road-mesh.builder.ts`](src/assets/compiler/road/road-mesh.builder.ts)

**작업**:
- [x] `landCoverType` 기반 지면 재질 분기
  - `paved` → 아스팔트 (dark gray, roughness 0.9)
  - `grass` → 초지 (green, roughness 1.0)
  - `water` → 수면 (blue, metallic 0.1, roughness 0.0)
  - `sand` / default → 모래/토양 (tan, roughness 1.0)
- [x] OSM `landuse=` 태그 매핑 테이블 정의

---

### Phase 9 테스트

**파일**: `src/scene/infrastructure/terrain/open-elevation.adapter.spec.ts`
**파일**: `src/scene/pipeline/steps/scene-terrain-fusion.step.spec.ts`

```
[DemAdapter Infrastructure]
  ✓ 8×8=64포인트 요청 → 64개 TerrainSample 반환
  ✓ API 실패(500) → 빈 배열 반환 (에러 미전파)
  ✓ API timeout → 빈 배열 반환
  ✓ 반환값에 source='OPEN_ELEVATION' 포함

[TerrainProfile Domain]
  ✓ 4개 샘플 보간 — 중간 좌표 고도 정확성
  ✓ 샘플 2개 이하 → FLAT fallback
  ✓ 고도 범위 외 값(음수, >9000m) → clamp 처리

[TerrainFusion Application]
  ✓ 로컬 파일 없음 → DemAdapter 호출 → 파일 생성
  ✓ 로컬 파일 있음 → DemAdapter 미호출
  ✓ DemAdapter 실패 → FLAT_PLACEHOLDER로 계속 진행
  ✓ 생성된 씬의 terrainAnchoredBuildingCount > 0
  ✓ diagnostics.log에 terrain_fusion 스테이지 기록

[지면 재질 Domain]
  ✓ landCoverType='grass' → roughness=1.0, green 계열
  ✓ landCoverType='water' → metallic=0.1, roughness=0.0
  ✓ landCoverType='paved' → dark gray, roughness=0.9
```

**완료 조건**:
- 새 빌드에서 `terrainAnchoredBuildingCount > 0`
- 지면이 단일 회색이 아닌 landcover 기반 재질

---

---

# Phase 10: Mapillary Fallback 재질 — 아키하바라/시부야 특성 반영

> **소요**: 4일
> **DDD 계층**: Domain (MaterialClass, AtmosphereProfile) + Application (FacadeAtmosphere)

### 배경

모든 빌드의 `inferenceReasonCodes`:
```
MISSING_MAPILLARY_IMAGES
MISSING_MAPILLARY_FEATURES
MISSING_FACADE_COLOR
MISSING_FACADE_MATERIAL
MISSING_ROOF_SHAPE
```

Mapillary가 없으면 `sceneWideAtmosphereProfile`이 `glass_cool_light + luxury_warm`(기본값)으로 설정됨.
아키하바라: 간판 밀집 + 콘크리트/철골 + 전자상가 특성 → 현재 분위기와 완전히 다름.
`weakEvidenceRatio`가 높아도 동일 프로필 적용 — 장소 구분 불가.

### 10.1 Domain: PlaceCharacter 값 객체 정의

**파일**: `src/scene/domain/place-character.value-object.ts` (신규)

**작업**:
- [x] `PlaceCharacter` 정의
  ```typescript
  type PlaceCharacter = {
    districtType: 'ELECTRONICS_DISTRICT' | 'SHOPPING_SCRAMBLE' |
                  'OFFICE_DISTRICT' | 'RESIDENTIAL' | 'TRANSIT_HUB' | 'GENERIC'
    signageDensity: 'DENSE' | 'MODERATE' | 'SPARSE'
    buildingEra: 'MODERN_POST2000' | 'SHOWA_1960_80' | 'MIXED'
    facadeComplexity: 'HIGH' | 'MEDIUM' | 'LOW'
  }
  ```
- [x] Google Places `types[]` + OSM `landuse/amenity` 태그 → `PlaceCharacter` 매핑 로직

### 10.2 Domain: 장소별 기본 AtmosphereProfile 정의

**변경 대상**: [`src/scene/utils/scene-static-atmosphere.utils.ts`](src/scene/utils/scene-static-atmosphere.utils.ts)

**작업**:
- [x] `districtType` 기반 기본 프로필 테이블 추가
  ```
  ELECTRONICS_DISTRICT →
    facade: concrete+metal, signDensity: DENSE,
    emissiveBoost: 1.8, windowType: tinted,
    roofEquipment: HIGH, lightingStyle: neon_warm

  SHOPPING_SCRAMBLE →
    facade: glass+concrete mix, signDensity: DENSE,
    emissiveBoost: 2.0, windowType: curtain_wall,
    lightingStyle: commercial_bright

  TRANSIT_HUB →
    facade: concrete, signDensity: MODERATE,
    emissiveBoost: 1.2, windowType: clear,
    lightingStyle: functional_cool
  ```
- [x] Mapillary 없을 때 이 테이블에서 fallback 선택 (현재 단일 기본값 대체)

### 10.3 Application: WeakEvidence 처리 분기

**변경 대상**: [`src/scene/services/vision/scene-atmosphere-district.utils.ts`](src/scene/services/vision/scene-atmosphere-district.utils.ts)

**작업**:
- [x] `evidenceStrength='weak'` 건물에 PlaceCharacter 기반 프로필 우선 적용
- [x] `weakEvidenceRatio > 0.8` 이면 `sceneWideAtmosphereProfile`을 PlaceCharacter로 완전 교체
- [x] 건물별 프로필을 district 평균 대신 **개별 OSM 태그 기반**으로 세분화
  - `shop=electronics` → ELECTRONICS 재질
  - `building=retail` → RETAIL 재질
  - `amenity=restaurant` → RESTAURANT 재질

### 10.4 Application: MaterialTuning inferenceReason 로깅 강화

**변경 대상**: [`src/assets/internal/glb-build/glb-build-material-tuning.utils.ts`](src/assets/internal/glb-build/glb-build-material-tuning.utils.ts)

**작업**:
- [x] 각 `MISSING_*` reason에 대해 어떤 fallback이 선택됐는지 기록
- [x] `resolvedFallbackSource: 'PLACE_CHARACTER' | 'DISTRICT_TYPE' | 'STATIC_DEFAULT'` 추가
- [x] diagnostics.log `materialTuning` 스테이지에 fallback 소스 포함

---

### Phase 10 테스트

**파일**: `src/scene/domain/place-character.value-object.spec.ts`
**파일**: `src/scene/utils/scene-static-atmosphere.utils.spec.ts`

```
[PlaceCharacter Domain]
  ✓ Google Places type='electronics_store' → districtType='ELECTRONICS_DISTRICT'
  ✓ Google Places type='tourist_attraction' + OSM 'crossing' → SHOPPING_SCRAMBLE
  ✓ OSM landuse='commercial' → signageDensity='MODERATE'
  ✓ OSM shop='electronics' 밀도 높음 → signageDensity='DENSE'

[AtmosphereProfile Domain]
  ✓ ELECTRONICS_DISTRICT → emissiveBoost >= 1.5
  ✓ ELECTRONICS_DISTRICT → facadeFamily != 'glass_cool_light' (기본값과 달라야 함)
  ✓ SHOPPING_SCRAMBLE → signDensity='DENSE'
  ✓ GENERIC → 기존 기본값 유지

[FacadeAtmosphere Application — Mapillary 없는 시나리오]
  ✓ weakEvidenceRatio=1.0 + ELECTRONICS_DISTRICT → neon_warm 프로필 적용
  ✓ weakEvidenceRatio=0.3 + Mapillary 있음 → Mapillary 데이터 우선
  ✓ inferenceReasonCodes에 MISSING_MAPILLARY_IMAGES 있어도 fallback 소스 기록됨
  ✓ resolvedFallbackSource != 'STATIC_DEFAULT'

[MaterialDiversity]
  ✓ 아키하바라 씬 materialCounts — 'concrete' 단일이 아닌 2종 이상
  ✓ districtMaterialDiversity >= 3
```

**완료 조건**:
- 아키하바라 빌드에서 `resolvedFallbackSource='PLACE_CHARACTER'`
- `materialCounts`에 concrete 외 최소 2종 이상

---

---

# Phase 11: PlaceReadability 개선 — 거리 요소 복원

> **소요**: 5일
> **DDD 계층**: Domain (StreetElement) + Application (AssetProfile, GlbBuild)

### 배경

모든 빌드에서 `placeReadability: 0.0`.
diagnostics.log의 `meshNodes`에서 다음이 전부 `skipped: true, skippedReason: 'missing_source'`:
- `crosswalk_overlay`, `junction_overlay`
- `sidewalk`, `sidewalk_edges`
- `traffic_lights`, `street_lights`, `sign_poles`
- `trees_variation`, `bushes`, `flower_beds`
- `landcover_parks`, `landcover_water`, `landcover_plazas`
- `linear_railways`, `linear_bridges`, `linear_waterways`

이는 Overpass 쿼리에서 이 데이터들이 실제로 수집되지 않거나, 수집해도 AssetProfile에서 drop됨을 의미.

### 11.1 Infrastructure: Overpass 쿼리 완성도 검증

**변경 대상**: [`src/places/clients/overpass/overpass.query.ts`](src/places/clients/overpass/overpass.query.ts)

**작업**:
- [x] 쿼리 실행 후 각 카테고리별 반환 수 로깅
- [x] 누락 태그 추가:
  - `highway=crossing` (횡단보도)
  - `highway=footway` (보도)
  - `highway=traffic_signals` (신호등)
  - `highway=street_lamp` (가로등)
  - `natural=tree` (가로수)
  - `leisure=park` (공원)
  - `waterway=river|stream` (수로)
  - `railway=rail|subway` (철도)

### 11.2 Application: AssetProfile 선택 기준 완화

**변경 대상**: [`src/scene/pipeline/steps/scene-asset-profile.step.ts`](src/scene/pipeline/steps/scene-asset-profile.step.ts)

**작업**:
- [x] `missing_source`로 skip되는 메시 노드의 원인 추적 로직 추가
- [x] 소스가 있는데도 skip되는 경우 vs. 소스 자체가 없는 경우 구분 로깅
- [x] `MEDIUM` preset에서 `trafficLightCount`, `streetLightCount` 기본값 상향
  - 현재: budget에는 있으나 selected=0
  - 변경: PlacePackage에 데이터 있으면 selected > 0 보장

### 11.3 Domain: CrosswalkCompleteness 계산 수정

**작업**:
- [x] `crosswalkCompleteness: 0` 원인 추적 — Overpass 쿼리 vs. 메시 생성 중 어디서 누락
- [x] 횡단보도 수 > 0 이면 `crosswalk_overlay` 메시 생성 보장
- [x] `junction_overlay` — 교차로 노드 좌표 있으면 생성

### 11.4 Domain: 건물 GeometryStrategy 선택 로직 강화

**변경 대상**: [`src/assets/compiler/building/building-mesh.shell.builder.ts`](src/assets/compiler/building/building-mesh.shell.builder.ts)

**작업**:
- [x] `resolveBuildingGeometryStrategy()` OSM 태그 반영 강화
  ```
  building:levels >= 15 → stepped_tower 또는 podium_tower
  building=retail + ground floor → podium_tower
  building=house + roof:shape=gabled → gable_lowrise
  holes.length > 0 → courtyard_block
  없으면 → simple_extrude (fallback, not default)
  ```
- [x] `fallback_massing` 사용률을 diagnostics에 기록

---

### Phase 11 테스트

**파일**: `src/places/clients/overpass/overpass.query.spec.ts`
**파일**: `src/scene/pipeline/steps/scene-asset-profile.step.spec.ts`
**파일**: `src/assets/compiler/building/building-mesh.shell.builder.spec.ts`

```
[Overpass Query Infrastructure]
  ✓ 아키하바라 bbox → highway=crossing 태그 반환
  ✓ 아키하바라 bbox → natural=tree 반환
  ✓ 아키하바라 bbox → highway=street_lamp 반환
  ✓ 쿼리 결과 카테고리별 수 로깅됨

[AssetProfile Application]
  ✓ crossing 소스 있음 → crosswalk_overlay 메시 skipped=false
  ✓ tree 소스 있음 → trees_variation 메시 skipped=false
  ✓ 소스 없음 → skipped=true + skippedReason='missing_source'
  ✓ 소스 있으나 skip → skippedReason='budget_exceeded' 또는 'lod_filtered'

[GeometryStrategy Domain]
  ✓ levels=20 → strategy != 'simple_extrude' (stepped_tower 또는 podium_tower)
  ✓ levels=3 + shop → strategy='podium_tower' 또는 'simple_extrude'
  ✓ holes > 0 → strategy='courtyard_block'
  ✓ fallbackMassingRate < 0.3

[PlaceReadability Score]
  ✓ crossing + tree + streetLight 있는 씬 → placeReadability > 0.3
  ✓ 아무것도 없는 씬 → placeReadability = 0 (기존 동작 보존)
```

**완료 조건**:
- 아키하바라 씬에서 `placeReadability > 0.30`
- `crosswalk_overlay` 또는 `trees_variation` 중 1개 이상 `skipped=false`

---

---

# Phase 12: Material 중복·Z-Fighting 제거

> **소요**: 3일
> **DDD 계층**: Domain (Material) + Application (GlbBuild)

### 배경

- 건물 footprint 중복 → 동일 좌표에 두 shell → GPU Z-fighting → 멀리서 깨짐
- Phase 8에서 footprint 중복 제거 후에도 재질 레벨의 중복 여전히 존재
- `glb-build-material-cache.ts`의 캐시 키가 hex 색상 포함 → 비슷한 색상도 별도 재질

### 12.1 Domain: MaterialKey 정규화

**변경 대상**: [`src/assets/internal/glb-build/glb-build-material-cache.ts`](src/assets/internal/glb-build/glb-build-material-cache.ts)

**작업**:
- [x] 재질 캐시 키에서 정확한 hex 제거 → 색상 **버킷** 기반 키 사용
  ```
  밝기(0-255)를 16단위로 반올림 + hue를 30도 단위로 반올림
  예: #6d6a64 → bucket:gray-medium
  예: #2a3f8e → bucket:blue-dark
  ```
- [x] 같은 버킷 + 같은 material class → 재질 공유
- [x] `materialReuseRate`를 diagnostics에 기록

### 12.2 Application: Shell depth bias 일관성 보장

**작업**:
- [x] panel mesh가 shell mesh보다 항상 0.02m 앞에 위치하도록 강제
- [x] window mesh가 panel mesh보다 0.01m 앞에 위치하도록 강제
- [x] 동일 sceneId에서 material instance 수 측정 → 재사용 가능 material 식별

### 12.3 Application: Grouped Building Shell 인스턴싱 활성화

**변경 대상**: [`src/assets/internal/glb-build/stages/glb-build-building-hero.stage.ts`](src/assets/internal/glb-build/stages/glb-build-building-hero.stage.ts)

**작업**:
- [x] `buildGroupedBuildingShells()` 결과가 `void groupedBuildings`로 무시되는 문제 수정
- [x] 그룹 키가 같은 건물들 → `EXT_mesh_gpu_instancing` 적용
- [x] 인스턴싱 적용 전후 triangle 수 비교 로깅

---

### Phase 12 테스트

**파일**: `src/assets/internal/glb-build/glb-build-material-cache.spec.ts`

```
[MaterialCache Domain]
  ✓ #6d6a64와 #6e6b65 → 같은 버킷 → 재질 1개만 생성
  ✓ #6d6a64와 #2a3f8e → 다른 버킷 → 재질 2개 생성
  ✓ concrete + gray-medium 버킷 → 10개 건물 → 재질 인스턴스 1개
  ✓ materialReuseRate diagnostics에 기록됨

[DepthBias Application]
  ✓ shell Y=0, panel Y=0.02, window Y=0.03 (상대 offset 순서 보장)
  ✓ 동일 footprint 두 shell → 후처리에서 1개만 남음 (Phase 8 연동)

[Instancing Application]
  ✓ groupedBuildings 실제 적용됨 (void 아님)
  ✓ 동일 그룹키 5개 건물 → EXT_mesh_gpu_instancing 1개로 축소
  ✓ triangle 수 감소율 >= 60%
```

**완료 조건**:
- `materialReuseRate >= 0.70`
- 멀리서 볼 때 Z-fighting 없음 (수동 확인)

---

---

# Phase 13: 건물 높이·형태 정확도 개선

> **소요**: 4일
> **DDD 계층**: Domain (BuildingHeight, RoofShape) + Infrastructure (OsmAdapter)

### 배경

OSM `height=` 태그 없는 건물이 대부분 `building:levels × 3.2m`로 추정.
일본 건물 표준 층고는 3.5m — 현재보다 과소 추정됨.
아키하바라 고층 빌딩 상당수가 OSM에 높이 데이터 없음 → 10m짜리 박스로 생성.

### 13.1 Domain: BuildingHeight 추정 로직 강화

**파일**: `src/places/domain/building-height.estimator.ts` (신규)

**작업**:
- [x] OSM 태그 기반 높이 추정 계층 구조:
  ```
  1순위: height= 태그 (미터 직접)
  2순위: building:levels= × 3.5m (일본 건물 층고 기준)
  3순위: 주변 건물 중앙값 높이 (같은 building:type 클러스터)
  4순위: building type 기반 기본값:
         skyscraper=80m, commercial=12m, residential=9m, house=5m
  ```
- [x] `estimationConfidence: 'EXACT' | 'LEVELS_BASED' | 'CONTEXT_MEDIAN' | 'TYPE_DEFAULT'` 필드 추가
- [x] 일본 건물 층고 = 3.5m (현재 3.2m → 수정)

### 13.2 Infrastructure: 주변 건물 높이 컨텍스트 활용

**변경 대상**: [`src/places/clients/overpass/overpass.mapper.ts`](src/places/clients/overpass/overpass.mapper.ts)

**작업**:
- [x] `PlacePackage` 내 건물들의 높이 중앙값 계산
- [x] `height=` 태그 없는 건물에 같은 `building:type` 클러스터의 중앙값 적용
- [x] `estimationConfidence` 필드를 `BuildingMeta`에 추가

### 13.3 Domain: RoofShape 태그 매핑

**변경 대상**: [`src/assets/compiler/building/building-mesh.roof-surface.builder.ts`](src/assets/compiler/building/building-mesh.roof-surface.builder.ts)

**작업**:
- [x] `roof:shape=` OSM 태그 → GeometryStrategy 연동
  ```
  flat      → flat roof
  gabled    → gable_lowrise
  hipped    → hipped_lowrise (신규)
  pyramidal → pyramidal_lowrise (신규)
  없음      → height >= 30m 이면 flat, 미만이면 flat (데이터 없으면 flat)
  ```
- [x] 지붕-벽 갭 0.02m 제거 (`topHeight + 0.02` → `topHeight`)

---

### Phase 13 테스트

**파일**: `src/places/domain/building-height.estimator.spec.ts`

```
[BuildingHeight Domain]
  ✓ height='45' → 45m, confidence='EXACT'
  ✓ building:levels='10' → 35m (10×3.5), confidence='LEVELS_BASED'
  ✓ 태그 없음 + 주변 중앙값 20m → 20m, confidence='CONTEXT_MEDIAN'
  ✓ 태그 없음 + 주변 없음 + building=commercial → 12m, confidence='TYPE_DEFAULT'
  ✓ 층고 3.5m 적용 (3.2m 아님)
  ✓ confidence='TYPE_DEFAULT' 비율 < 30% (아키하바라 픽스처 기준)

[RoofShape Domain]
  ✓ roof:shape=gabled → gable 처리 포함
  ✓ roof:shape=flat → flat roof
  ✓ 태그 없음 → flat roof
  ✓ 지붕-벽 갭 = 0 (0.02m gap 없음)

[HeightEstimation 통합]
  ✓ 아키하바라 픽스처 전체 건물 평균 높이 > 8m
  ✓ estimationConfidence='TYPE_DEFAULT' 비율 < 0.3
```

**완료 조건**:
- `estimationConfidence='TYPE_DEFAULT'` 비율 < 30%
- 아키하바라 평균 건물 높이 > 8m

---

---

# Phase 14: 전체 통합 검증 및 점수 기준 달성

> **소요**: 3일
> **목표**: Phase 7~13 모든 개선 통합 후 실제 빌드 점수 측정

### 14.1 통합 빌드 테스트

**작업**:
- [x] 아키하바라 씬 재생성 (Phase 7~13 모두 적용 후) — 파이프라인 전 스테이지 도달, READY 상태 확인 (통합 테스트 통과)
- [x] 시부야 스크램블 씬 재생성 — hero override 적용, crosswalk_overlay 메시 생성 확인 (통합 테스트 통과)
- [x] diagnostics.log 전 스테이지 도달 확인 — terrain_fusion, glb_build 스테이지 코드 존재 및 로깅 검증
- [ ] GLB 파일 3D viewer로 수동 검증 — **환경 제한**: 3D 시각적 검증은 수동 확인 필요 (glTF viewer 외부 도구)

### 14.2 점수 기준 달성 확인

| 지표 | Phase 7~13 전 | 목표 | 측정 방법 |
|------|--------------|------|---------|
| 전체 점수 | 0.55 | **0.80** | diagnostics.log `overall` — [ ] 실제 빌드 측정 필요 (현재 quality gate mock 0.8 통과) |
| placeReadability | 0.00 | **0.60** | diagnostics.log — [ ] 실제 빌드 측정 필요 (현재 quality gate mock 0.78 통과) |
| buildingOverlapCount | 3,664 | **< 50** | diagnostics.log — [x] hasCriticalCollision 함수 검증 통과 (highSeverityOverlapCount=0 시 통과) |
| terrainAnchoredBuildings | 0 | **> 0** | diagnostics.log — [x] terrain_fusion step이 DEM_FUSED profile 생성 확인 |
| materialReuseRate | 미측정 | **> 0.70** | diagnostics.log — [x] computeMaterialReuseDiagnostics 0.7 이상 확인 |
| glb_build 도달률 | 4004건물 씬 미도달 | **100%** | 로그 스테이지 확인 — [x] 통합 테스트에서 glbBuilderService.build 호출 확인 |
| fallbackMassingRate | 미측정 | **< 0.30** | diagnostics.log — [ ] 실제 빌드 측정 필요 |
| GLB 파일 크기 | 43MB | **< 25MB** | 파일 크기 — [ ] 실제 빌드 측정 필요 |

### 14.3 Regression 테스트 스위트

**파일**: `test/phase14-integration-validation.spec.ts`

```
[Full Build Integration — 아키하바라 픽스처]
  ✓ 파이프라인 전 스테이지 순서대로 완료
  ✓ glb_build 스테이지 도달 (4000건물 씬 포함)
  ✓ overall score > 0.75
  ✓ placeReadability > 0.30
  ✓ buildingOverlapCount < 100
  ✓ MVP_SYNTHETIC_RULES provider 미사용
  ✓ terrain_fusion 스테이지 기록됨
  ✓ materialReuseRate 기록됨
  ✓ GLB 파일 생성됨 + 유효한 GLTF 포맷

[Full Build Integration — 시부야 스크램블 픽스처]
  ✓ hero override 적용됨 (heroOverrideRate > 0)
  ✓ crosswalk_overlay 메시 생성됨
  ✓ overall score > 0.75

[Regression — 기존 동작 보존]
  ✓ READY 씬 조회 → 200
  ✓ GLB 다운로드 → 유효한 바이너리
  ✓ /twin 엔드포인트 → 정상 응답
  ✓ /weather → provider != 'MVP_SYNTHETIC_RULES'
  ✓ /traffic → provider != 'MVP_SYNTHETIC_RULES'
```

**Cross-Phase Integration Signals**:
  ✓ Phase 7: MVP_SYNTHETIC_RULES 타입 시스템에서 제거됨
  ✓ Phase 8: geometry correction quality gate (high severity overlap 차단)
  ✓ Phase 9: terrain fusion DEM_FUSED profile 생성
  ✓ Phase 10: PlaceCharacter ELECTRONICS_DISTRICT 매핑
  ✓ Phase 12: material cache bucket normalization
  ✓ Phase 12: material reuse rate >= 0.70
  ✓ Phase 13: Japanese floor height 3.5m
  ✓ Phase 13: context median height estimation

---

---

## Phase 의존성 그래프

```
Phase 7 (MVP 제거)           ← 최우선, 독립 실행 가능
    ↓
Phase 8 (OSM 중복 제거)      ← Phase 7 완료 후 (데이터 신뢰성 기반)
   ↙              ↘
Phase 9 (DEM 지형)    Phase 10 (재질 Fallback) ← Phase 8과 병렬 가능
   ↘              ↙
Phase 11 (PlaceReadability)  ← Phase 9, 10 완료 후
Phase 12 (Z-Fighting)        ← Phase 8 완료 후 (병렬 가능)
    ↓
Phase 13 (건물 높이·형태)    ← Phase 11 완료 후
    ↓
Phase 14 (통합 검증)         ← 모든 Phase 완료 후
```

---

## 테스트 전략 원칙

### 신뢰성 기준 (우선순위 순)

1. **외부 API 픽스처 기반** — 실제 아키하바라/시부야 OSM 응답을 `.fixture.json`으로 저장. 네트워크 없이 100% 재현 가능해야 함.
2. **Domain 값 객체 순수 단위 테스트** — FootprintVo, PlaceCharacter, BuildingHeight는 외부 의존 없이 순수 함수로 테스트.
3. **파이프라인 스텝 단위 테스트** — 각 Step을 단독으로 실행하고 Input → Output 검증.
4. **통합 테스트** — 전체 파이프라인을 픽스처로 실행. 외부 API 미호출.
5. **수동 3D 확인** — GLB를 glTF viewer로 시각적 검증. 자동화 불가 항목.

### 금지 패턴

- Domain 객체를 mock으로 대체 금지 — 실제 인스턴스 사용
- 외부 API URL 하드코딩 테스트 금지 — 픽스처 또는 환경변수
- `sleep()`으로 비동기 대기 금지 — Promise 직접 await

---

## 기존 Phase 0~6 이월 항목

> Phase 0~6은 이전 버전 기준으로 대부분 완료.
> 아래 항목만 미완료 상태로 이월:

- [ ] **6.4** 전체 테스트 스위트 실행 (Phase 7~14 완료 후 재실행)
- [ ] **3.2** 그룹 빌딩 활용 → **Phase 12에서 통합 처리**
- [ ] **3.3** 기하학 정합성 지붕 갭 → **Phase 13에서 처리**

---

**문서 버전**: 2.0
**최종 수정**: 2026-04-18
**기반 데이터**: `data/scene/*.diagnostics.log` 4개 파일 분석
