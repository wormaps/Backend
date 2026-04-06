# WorMap Hybrid Scene Architecture

## 1. 목적

이 문서는 WorMap의 장소 생성 엔진을 `절차형 도시 생성기`에서 `현실감을 우선하는 하이브리드 장소 엔진`으로 재구성하기 위한 아키텍처를 정의한다.

목표는 다음 2가지를 동시에 만족하는 것이다.

- 모든 장소/지역에 대해 공통 엔진으로 동작할 것
- 현실감이 중요한 핵심 지역은 절차형 박스 모델 수준을 넘을 것

이 문서는 `scene-generation-policy.md`를 상위 정책으로 따른다.

---

## 2. 배경 판단

### 2-1. 확인된 사실

- OpenStreetMap의 `Simple 3D Buildings`는 기본적으로 건물 볼륨과 일부 3D 속성을 설명하는 제한된 스키마다.
- Mapillary map features는 주로 교통 표지, 차선 마킹, 가로등, 벤치 등 도로/거리 객체 탐지에 강하다.
- Photorealistic 3D Tiles 계열은 텍스처가 입혀진 실제 도시 메쉬를 제공하며, 시각 현실감 측면에서 절차형 extrusion보다 훨씬 강하다.

### 2-2. 결론

현재의 `OSM footprint + height + 규칙 기반 extrusion + 일부 Mapillary 힌트` 방식은 다음에는 적합하다.

- 도시 구조 가독성
- 전 세계 범용성
- 경량 GLB 생성
- semantic scene 구축

하지만 다음에는 한계가 크다.

- 실제 파사드 색감과 재질
- 복잡한 건물 형상과 입면
- 시부야 같은 고밀도 상업 지역의 간판/신호등/도로 분위기
- 실사형 장면

따라서 WorMap은 `절차형 단독`이 아니라 `하이브리드` 구조로 가야 한다.

---

## 3. 아키텍처 원칙

### 3-1. 최상위 원칙

1. 장소명 기반 엔진 분기는 금지한다.
2. 구조 보존을 먼저 하고, 현실감은 계층적으로 추가한다.
3. 고정밀 데이터가 있을 때는 절차형 결과보다 우선한다.
4. 고정밀 데이터가 없을 때도 전체 장면이 무너지지 않게 절차형 fallback을 유지한다.
5. 장소 전용 코드는 금지하고, 장소 전용 데이터만 허용한다.

### 3-2. 엔진 목표

- `Base Layer`: 모든 장소에서 안정적으로 생성되는 구조 레이어
- `Reality Layer`: 현실감이 필요한 구역에만 선택적으로 덮는 고정밀 레이어
- `Live Layer`: 시간/날씨/교통/인파 같은 상태 변화 레이어

---

## 4. 제안 구조

```text
Place Query
  -> Place Resolution
  -> Source Acquisition
      -> Google Places
      -> Overpass / OSM
      -> Mapillary
      -> Optional High-Fidelity Source
  -> Scene Interpretation
      -> Structural Graph Builder
      -> Landmark Annotation Builder
      -> Fidelity Planner
  -> Asset Synthesis
      -> Procedural Base Builder
      -> Reality Overlay Builder
      -> Material / Lighting Builder
  -> Scene Packaging
      -> meta.json
      -> detail.json
      -> base.glb
      -> diagnostics.log
```

---

## 5. 레이어 설계

## 5-1. Base Layer

모든 장소에 대해 반드시 생성되는 공통 구조 레이어다.

구성:

- building massing
- road surface
- walkway
- crossing
- lane / road marking
- vegetation
- land cover
- semantic nav graph

데이터 소스:

- Overpass / OSM
- Google Places
- 일부 Mapillary point features

역할:

- 장소의 구조를 읽을 수 있게 하는 최소 장면
- 데이터가 약한 지역에서도 실패하지 않는 fallback

제약:

- 현실감보다 구조 보존을 우선한다
- 파사드와 간판은 약해도 괜찮지만 구조는 무너지면 안 된다

## 5-2. Reality Layer

현실감 향상을 위해 Base Layer 위에 덧씌우는 선택 레이어다.

구성:

- textured facade hints
- landmark-grade mesh
- refined roof equipment
- richer street furniture set
- signage clusters
- signal system refinement
- special intersection treatment

데이터 소스:

- Landmark annotation manifest
- Mapillary image-derived evidence
- Optional 3D Tiles / photogrammetry / custom captured mesh
- 향후 별도 curated asset pack

역할:

- 핵심 구역의 “박스 도시” 느낌을 줄인다
- 시부야, 타임스퀘어, 강남역 같은 장소의 정체성을 높인다

핵심 정책:

- 고정밀 입력이 있으면 procedural facade보다 우선한다
- Reality Layer는 장소 전용 코드가 아니라 장소 전용 데이터로만 제어한다

## 5-3. Live Layer

시간과 상태를 반영하는 동적 레이어다.

구성:

- traffic state
- weather state
- crowd density
- lighting profile
- wet road / snow overlay

역할:

- 구조와 현실감 위에 시간 변화를 입힌다

---

## 6. Fidelity Planner

하이브리드 구조의 핵심은 `무엇을 procedural로 만들고, 무엇을 high-fidelity로 덮을지`를 결정하는 계획기다.

### 입력

- place type
- source completeness
- mapillary evidence density
- landmark importance
- core intersection importance
- budget / quality tier

### 출력

- `procedural_only`
- `procedural_plus_material_enrichment`
- `procedural_plus_landmark_assets`
- `procedural_plus_reality_overlay`

### 판단 규칙

1. 고정밀 입력이 없는 지역은 procedural base를 유지한다.
2. 중심 반경과 핵심 교차로는 일반 외곽보다 높은 fidelity를 받는다.
3. 랜드마크는 중요도에 따라 별도 mesh 또는 facade overlay를 받는다.
4. 상업 밀도가 높고 이미지 증거가 충분한 구역은 signage/material refinement를 우선한다.
5. 증거가 약하면 과장하지 않고 degrade gracefully 한다.

---

## 7. 데이터 모델

## 7-1. Landmark Annotation Manifest

장소 전용 로직 대신 장소 전용 데이터를 넣는 공통 스키마다.

포함 필드:

- place match rule
- landmark building ids
- landmark intersection ids
- landmark importance
- optional signage hint
- optional furniture row hint
- optional facade emphasis hint
- optional reality overlay source reference

금지:

- 특정 건물에 대한 mesh strategy 직접 지정
- 특정 도시 전용 builder 실행 트리거

## 7-2. Fidelity Source Registry

장소마다 사용할 수 있는 고정밀 입력 소스를 관리하는 레지스트리다.

예시 필드:

- `sourceType`: `photoreal_3d_tiles` | `captured_mesh` | `asset_pack` | `none`
- coverage polygon
- license / terms metadata
- refresh cadence
- quality score
- fallback policy

## 7-3. Structural Diagnostics

현재 로그를 확장해 아래 지표를 지속적으로 기록한다.

- selectedBuildingCoverage
- coreAreaBuildingCoverage
- fallbackMassingRate
- footprintPreservationRate
- landmarkCoverage
- roadContinuityScore
- crossingCompletenessScore
- materialEvidenceCoverage
- realityOverlayCoverage
- layerSkippedReason

---

## 8. 렌더 표현 전략

## 8-1. 건물

현재 문제:

- 단순 extrusion 비율이 높다
- 창과 파사드가 뚫려 보이거나 평면처럼 보인다
- 실제 재질보다 밝은 회색 fallback이 과도하다

개선 방향:

- 건물은 `massing`, `facade`, `roof`를 별도 계층으로 분리한다
- massing은 항상 보존하되, facade는 증거 강도에 따라 3단계로 처리한다

facade 단계:

1. `No Evidence`
   - 중성 재질
   - 창 비율/층 분할만 표현
2. `Weak Evidence`
   - 색/재질 카테고리 반영
   - 상업/업무/주거 타입별 파사드 패턴 적용
3. `Strong Evidence`
   - 실제 palette 반영
   - landmark texture/overlay 또는 curated asset 적용

## 8-2. 도로와 횡단보도

현재 문제:

- road base는 존재해도 시각 정보가 약하면 검은 바닥처럼 보일 수 있다
- 횡단보도와 차선은 입력이 있어도 재질 대비가 부족하면 눈에 잘 안 들어온다

개선 방향:

- 도로는 `surface`, `lane markings`, `crosswalk`, `stop line`, `median`, `curb`를 분리한다
- 횡단보도는 중심부 교차로에서 우선적으로 style refinement를 적용한다
- 신호등/가로등은 단일 lowpoly icon이 아니라 타입군별 mesh set으로 확장한다

## 8-3. 신호등 / 거리 가구

현재 문제:

- 애니메이션풍 소품처럼 보인다
- 스케일과 재질 다양성이 부족하다

개선 방향:

- `traffic_light`, `street_light`, `pole`, `bollard`, `bench`, `tree_guard`를 개별 family로 분리한다
- family마다 2~4개의 mesh variant를 둔다
- 지역 데이터가 강한 곳은 교차로/도로 등급에 맞춰 배치한다

---

## 9. 소스 전략

## 9-1. 기본 소스

- Google Places: 장소 의미와 랜드마크 후보
- Overpass / OSM: 구조와 topology
- Mapillary: 거리 객체와 일부 시각 힌트

## 9-2. 고정밀 소스

우선 검토 대상:

- Google Photorealistic 3D Tiles
- 자체 photogrammetry / captured mesh
- curated landmark asset pack

정책:

- 이 소스들은 `전 지역 기본 의존성`이 아니라 `선택적 reality overlay source`로 취급한다
- 라이선스와 사용 조건을 소스 레지스트리에서 분리 관리한다

---

## 10. 품질 티어

## 10-1. Medium

목표:

- 중심부 구조를 충분히 보존
- 핵심 교차로와 횡단보도 완결성 확보
- 재질 다양성을 최소 수준 이상 확보
- 주요 랜드마크에 한해 reality overlay 허용

## 10-2. Large

목표:

- 더 넓은 범위의 구조 보존
- 더 많은 signage / furniture / road detail 반영
- reality overlay coverage 확대

## 10-3. Hero

목표:

- 특정 핵심 지역의 시각 품질을 최우선
- 가능하면 photoreal 또는 curated landmark asset 사용
- 일반 도시 생성기가 아니라 showcase용 고품질 장면으로 동작

---

## 11. 구현 단계

### Phase 1. 구조 안정화

- procedural base 품질 강화
- diagnostics 확장
- material fallback 개선
- building opening / facade 허상 문제 정리

### Phase 2. 하이브리드 계층 도입

- Fidelity Planner 추가
- Fidelity Source Registry 추가
- Landmark Annotation Manifest 확장
- reality overlay 인터페이스 정의

### Phase 3. 고정밀 공급원 연결

- photoreal / captured mesh / curated asset pack 중 1개 이상 연결
- 중심 랜드마크 우선 적용
- procedural layer와 겹치는 영역의 masking 규칙 확정

### Phase 4. 장소 확장

- 시부야 외 타임스퀘어, 강남역 등 다른 고밀도 상업 지역으로 검증
- place-specific code 없이 data-only annotation으로 재현성 검증

---

## 12. 지금 기준의 판단

### 확인된 사실

- 현재 엔진은 범용 절차형 구조를 만드는 데는 성공하고 있다.
- 하지만 현실적인 도시 장면을 만드는 엔진으로 보기는 어렵다.
- 특히 시부야 같은 장소는 procedural-only 방식으로는 결과 한계가 분명하다.

### 의견

WorMap의 목표가 `현실감 있는 Place Scene`이라면, 앞으로의 기준 엔진은 아래처럼 정의하는 것이 맞다.

- 모든 장소는 procedural base로 생성한다.
- 현실감이 중요한 구역은 reality overlay를 덧입힌다.
- 핵심 랜드마크와 핵심 교차로는 curated high-fidelity path를 가진다.
- 엔진은 범용으로 유지하고, 장소 차이는 데이터와 소스 가용성으로만 표현한다.

이 문서의 결론은 명확하다.

`WorMap은 procedural-only 엔진이 아니라 hybrid reality engine으로 전환해야 한다.`

---

## 13. 참고 자료

- OpenStreetMap Simple 3D Buildings
  - https://wiki.openstreetmap.org/wiki/Simple_3D_buildings
- Mapillary Map Features
  - https://help.mapillary.com/hc/en-us/articles/115002332165-Map-features
- Google Photorealistic 3D Tiles Overview
  - https://developers.google.com/maps/documentation/tile/3d-tiles-overview
- Google Photorealistic 3D Tiles
  - https://developers.google.com/maps/documentation/tile/3d-tiles
