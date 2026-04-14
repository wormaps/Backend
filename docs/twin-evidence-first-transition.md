# Evidence-First Digital Twin 전환 계획

## 목적

이 문서는 **추론 중심 GLB 생성**이 아니라 **외부 API 근거(Evidence) 중심 디지털 트윈 엔진**으로 전환하기 위한 실행 기준을 정의한다.

핵심 우선순위는 다음과 같다.

1. Evidence
2. Twin Graph (Canonical)
3. Geometry/GLB (Derived)
4. Delivery/API

---

## 1) 현재 구조의 핵심 문제 (코드 근거)

### A. 추론 경로가 생성 핵심을 지배

- `src/scene/services/vision/scene-facade-vision.service.ts`
  - `weakEvidence`, `infer...`, `contextualUpgrade` 중심의 facade hint 생성
- `src/assets/compiler/building/building-mesh.window.builder.ts`
  - facade hint 부재 시 `__fallback__`, `weakEvidence: true`
- `src/assets/internal/glb-build/glb-build-material-tuning.utils.ts`
  - `weakEvidenceRatio`로 material tuning 가중

의미: 근거 부족 시 추론이 보정이 아니라 사실상 기본 경로로 동작한다.

### B. Twin이 geometry를 강제하지 않음

- `src/scene/pipeline/scene-generation-pipeline.service.ts`
  - 실행 순서: place resolution → place package → visual rules → geometry correction → GLB build
- `src/scene/pipeline/steps/scene-glb-build.step.ts`
- `src/assets/internal/glb-build/glb-build-runner.ts`

의미: GLB build 입력이 Twin Graph가 아니라 `SceneMeta/SceneDetail`이다.

### C. Snapshot/lineage는 저장되지만 재실행 강제는 약함

- `src/scene/services/twin/twin-source-snapshot.builder.ts`
  - source snapshot, upstream envelope, provenance 저장
- `src/scene/services/qa/scene-mid-qa.service.ts`
  - replayability 비율 평가

의미: 저장/평가는 있으나 “동일 입력 재실행 동일 결과”를 강제하는 authoritative replay 경로는 약하다.

---

## 2) 근거(API) 중심으로 확보할 Evidence 계약

아래 API 응답은 **원본 envelope + 정규화 결과 + 매핑 규칙 버전**으로 같이 저장한다.

### 2.1 Google Places (장소 기준)

- 대상: place search + place detail
- 필수 저장:
  - query, request params
  - raw response envelope (status, headers subset, body hash)
  - normalized place (placeId, location, viewport, type)
  - mapper version

### 2.2 Overpass (공간 구조)

- 대상: building/road/walkway/poi/crossing/furniture/vegetation
- 필수 저장:
  - query (bbox/radius/scope)
  - raw elements hash + count
  - normalized PlacePackage + mapper version
  - 실패 시 fallback endpoint 시도 로그

### 2.3 Mapillary (관측 시각 근거)

- 대상: nearby images + map features
- 필수 저장:
  - bbox/anchor 기반 요청 전략
  - raw ids/features hash
  - feature-image linkage
  - confidence 산출 근거

### 2.4 Open-Meteo / TomTom (상태 계층)

- 대상: weather/traffic live data
- 필수 저장:
  - query time/date
  - source timestamp
  - normalized state snapshot

### 2.5 API별 collector → normalizer → snapshot → twin 연결

#### Google Places

- collector: `src/places/clients/google-places.client.ts`
- normalizer: `src/places/clients/google-places.client.ts` (location/viewport 정규화)
- snapshot: `src/scene/services/twin/twin-source-snapshot.builder.ts` (`PLACE_SEARCH_QUERY`, `PLACE_DETAIL`)
- twin linkage: `src/scene/services/twin/twin-entity-core.builders.ts` (`PLACE` entity)

#### Overpass

- collector: `src/places/clients/overpass.client.ts`, `src/places/clients/overpass/overpass.transport.ts`
- normalizer: `src/places/clients/overpass/overpass.mapper.ts`, `overpass.partitions.ts`
- snapshot: `src/scene/services/twin/twin-source-snapshot.builder.ts` (`PLACE_PACKAGE`)
- twin linkage: `src/scene/services/twin/twin-entity-infrastructure.builders.ts`, `twin-entity-detail.builders.ts`

#### Mapillary

- collector: `src/places/clients/mapillary.client.ts`
- normalizer: `src/scene/services/vision/scene-vision.service.ts` (providerTrace/provenance + facade/signage 입력)
- snapshot: `src/scene/services/twin/twin-source-snapshot.builder.ts` (`PROVIDER_TRACE`)
- twin linkage: `src/scene/services/twin/twin-entity-core.builders.ts` (appearance provenance)

#### Open-Meteo / TomTom

- collector: `src/places/clients/open-meteo.client.ts`, `src/places/clients/tomtom-traffic.client.ts`
- normalizer: `src/scene/services/live/scene-weather-live.service.ts`, `scene-state-live.service.ts`, `scene-traffic-live.service.ts`
- snapshot: 현재 live 응답 중심(정적 twin snapshot 미흡)
- twin linkage: 현재 약함(보강 필요)

---

## 3) Twin Canonical 계약 (추론 금지 규칙 포함)

Twin Graph는 아래 규칙을 강제한다.

1. 모든 entity/property는 `observed | inferred | defaulted` provenance 필수
2. `inferred/defaulted`는 반드시:
   - 원인 코드(reason code)
   - 근거 부족 항목(missing evidence keys)
   - confidence
     를 함께 기록
3. `inferred/defaulted`가 임계치 초과 시 geometry 생성 금지

### 금지 규칙

- Evidence가 없는 속성에 대해 silent fallback 금지
- style/material/roof/lighting의 추론값을 observed처럼 승격 금지

---

## 4) Geometry를 Twin 파생물로 강제

### 현재

- GLB builder가 `SceneMeta/SceneDetail` 직접 입력

### 목표

- GLB builder 입력을 `TwinGraph + TwinDerivedGeometrySpec`로 제한
- `SceneMeta/SceneDetail`은 ingest 단계 산출물로만 사용

### 강제 조건

1. geometry 생성 시 entityId/sourceSnapshotIds/evidenceIds 역추적 가능
2. twin 미통과(semantic/state/lineage fail) 시 GLB build 실행 불가
3. geometry 단계에서 twin 수정 금지 (read-only)

---

## 5) Deterministic Replay 요구사항

동일 조건에서 동일 출력을 보장해야 한다.

- 입력 동일: evidence bundle hash 동일
- 버전 동일: mapper/twin schema/geometry builder version 동일
- seed 동일: 난수 사용 경로 seed 고정

### 판정 기준

- authoritative fields exact match
  - entity count
  - relationship count
  - property hashes
  - GLB semantic extras hash
- 불일치 시 fail

---

## 6) Phase 계획 (CI/CD phase 없음)

### Phase A. Evidence Freeze

- 목표: API 근거를 immutable bundle로 고정
- Exit:
  - provider별 snapshot schema/version 고정
  - upstream envelope 누락 0

### Phase B. Twin Canonicalization

- 목표: Twin을 단일 canonical source로 승격
- Exit:
  - provenance/reason/confidence 규칙 강제
  - inferred/defaulted 초과 시 gate fail

### Phase C. Geometry Derivation

- 목표: Twin 기반 geometry만 허용
- Exit:
  - GLB input 경로가 Twin 기반으로 전환
  - topology/material semantic consistency 통과

### Phase D. Deterministic Replay

- 목표: 동일 입력 동일 출력 보장
- Exit:
  - replay diff 0 또는 허용 범위 문서화

### Phase E. Shadow Cutover

- 목표: Twin-first 기본 경로 전환
- Exit:
  - 기존 추론 중심 경로는 fallback-only
  - 추론 사용 시 telemetry + reason 필수

---

## 7) 즉시 실행 항목 (코드 기준)

### 7.1 ingest/evidence 강화

- 대상 파일:
  - `src/scene/services/twin/twin-source-snapshot.builder.ts`
  - `src/scene/services/vision/scene-vision.service.ts`
  - `src/places/clients/*.ts`
- 작업:
  - snapshot에 mapperVersion, normalizationRulesetId, missingEvidenceKeys 추가

### 7.2 inference 경로의 명시화

- 대상 파일:
  - `src/scene/services/vision/scene-facade-vision.service.ts`
  - `src/assets/compiler/building/building-mesh.window.builder.ts`
  - `src/assets/internal/glb-build/glb-build-material-tuning.utils.ts`
- 작업:
  - 추론 사용 시 reason code 강제
  - weakEvidence 임계치 초과면 geometry 단계 진입 차단

### 7.3 GLB 입력 경로 전환 준비

- 대상 파일:
  - `src/scene/pipeline/steps/scene-glb-build.step.ts`
  - `src/assets/internal/glb-build/glb-build-runner.ts`
- 작업:
  - TwinDerivedGeometrySpec 도입
  - 직접 meta/detail 의존 축소

### 7.4 replay harness 도입

- 대상:
  - `scripts/` 하위 replay 비교 스크립트 신규
- 작업:
  - evidence bundle 기준 재생성 diff 리포트 생성

### 7.5 근거 부족 시 추론 동작 매트릭스 운영

- 정책: `weakEvidence / inferred / defaulted / synthetic` 발생 시 반드시 reason을 남긴다.
- 우선 적용 대상:
  - `src/scene/services/vision/scene-facade-vision.service.ts`
  - `src/scene/services/vision/building-style-resolver.service.ts`
  - `src/scene/services/vision/scene-atmosphere-district.utils.ts`
  - `src/assets/internal/glb-build/glb-build-facade-material-profile.utils.ts`
  - `src/assets/internal/glb-build/glb-build-material-tuning.utils.ts`
  - `src/scene/pipeline/steps/scene-geometry-correction.step.ts`

---

## 9) 추론 대체를 위한 API 근거 우선순위

1. **Mapillary 보강**: facade/material/signage 추론 축소에 직접적
2. **Overpass 태그 보강**: building material/color/roof shape 누락 축소
3. **terrain/elevation 근거 보강**: floating/grounding 문제 축소
4. **Open-Meteo/TomTom snapshot 연계**: 상태 계층을 synthetic 중심에서 observed 중심으로 이동

---

## 8) 완료 판정 (디지털 트윈 엔진 최소 기준)

아래 4개를 모두 만족해야 “Twin 엔진”으로 본다.

1. Evidence completeness pass
2. Twin canonical invariants pass
3. Geometry is derived-only pass
4. Deterministic replay pass

하나라도 실패하면 “추론 중심 scene generator” 상태로 판정한다.

---

## 10) 즉시 실행 슬라이스 (P0 / P1)

아래는 **이번 구현 사이클에서 바로 적용할 파일 단위 작업**이다.

### P0. Evidence Contract 고정 + 회귀 테스트

#### P0-1. Source Snapshot 계약 고정

- 대상 파일
  - `src/scene/services/twin/twin-source-snapshot.builder.ts`
  - `src/scene/scene.service.spec.ts`
- 작업
  - `sourceSnapshots.snapshots` 필수 kind 집합을 계약으로 고정
    - `PLACE_SEARCH_QUERY`, `PLACE_DETAIL`, `PLACE_PACKAGE`, `TERRAIN_PROFILE`, `SCENE_META`, `SCENE_DETAIL`, `QUALITY_GATE`
    - 조건부 kind: `PROVIDER_TRACE`(Mapillary), `WEATHER_OBSERVATION`, `TRAFFIC_FLOW`
  - 모든 snapshot에 `evidenceMeta.mapperVersion`, `evidenceMeta.normalizationRulesetId` 존재를 검증
  - weather/traffic snapshot의 `upstreamEnvelopes` 보존 여부를 검증
- Exit
  - 계약 테스트가 snapshot 순서/누락/키 누락 회귀를 차단

#### P0-2. Live Evidence 샘플링 경로 안정화

- 대상 파일
  - `src/scene/services/generation/scene-generation.service.ts`
  - `src/scene/services/live/scene-weather-live.service.ts`
  - `src/scene/services/live/scene-traffic-live.service.ts`
  - `src/scene/scene.service.spec.fixture.ts`
  - `src/scene/scene.service.spec.ts`
  - `src/scene/scene.live-data.service.spec.ts`
- 작업
  - generation 단계에서 `READY` 의존 API 호출 금지
  - place/road 기반 샘플링으로 weather/traffic evidence 확보
  - 저장 snapshot(`latestWeatherSnapshot`, `latestTrafficSnapshot`)과 twin source snapshot 연결 일관화
- Exit
  - `scene.service.spec.ts`, `scene.live-data.service.spec.ts` 통과

### P1. Inference 사용 경로의 계약화

#### P1-1. Inference Reason 전파 검증

- 대상 파일
  - `src/scene/services/vision/scene-facade-vision.service.ts`
  - `src/assets/internal/glb-build/glb-build-material-tuning.utils.ts`
  - `src/assets/compiler/materials/glb-material-factory.scene.ts`
  - `src/scene/services/vision/scene-facade-vision.service.spec.ts`
  - (필요 시) material 관련 spec 파일
- 작업
  - `weakEvidence` 또는 fallback 발생 시 `inferenceReasonCodes`가 누락되지 않도록 강제
  - material tuning/factory까지 reason 전달 경로를 테스트로 고정
- Exit
  - inference reason 누락 시 테스트 fail

#### P1-2. Twin/Validation에서 inference 비율 경계 검증

- 대상 파일
  - `src/scene/services/twin/scene-twin-builder.service.ts`
  - `src/scene/services/twin/twin-validation.builder.ts`
  - twin/validation 관련 spec(신규 또는 기존 확장)
- 작업
  - inferred/defaulted 비율이 임계 초과 시 경고/실패 신호가 validation에 남는지 검증
  - reason code 집계가 gate reason과 정합되는지 검증
- Exit
  - inference 중심 경로가 silent pass되지 않음

### P0/P1 공통 검증 커맨드

- `npm run test -- scene.service.spec.ts`
- `npm run test -- scene.live-data.service.spec.ts`
- `npm run test -- scene-facade-vision.service.spec.ts`
- `npm run type-check`
- `npm run build`

---

## 11) 다음 phase 진입점

다음 phase는 **Twin 기반 GLB 입력 축소**다.

### 진입 파일

- `src/scene/pipeline/steps/scene-glb-build.step.ts`
- `src/assets/internal/glb-build/glb-build-runner.ts`
- `src/assets/internal/glb-build/glb-build-material-tuning.utils.ts`
- `src/assets/compiler/materials/glb-material-factory.scene.ts`

### 목표

1. GLB build 입력을 `SceneMeta/SceneDetail` 직접 의존에서 더 축소
2. Twin-derived geometry spec 또는 동등한 중간 계약 도입
3. material tuning / facade factory가 twin provenance를 더 직접적으로 소비
4. meta/detail 기반 fallback이 있더라도 명시적 reason code와 gate를 남김

### 최소 exit

- GLB build 경로에서 Twin-derived 입력이 1차 계약이 됨
- meta/detail 직접 의존이 ingest 보조로 내려감
- 관련 회귀 테스트가 추가됨
