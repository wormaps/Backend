# Hybrid Phase Plan

이 문서는 [acctecture.md](/Users/user/wormapb/acctecture.md)를 구현 작업 단위로 분해한 실행 계획이다.

## Phase 1. Base Stabilization

목표:

- 절차형 base layer를 신뢰 가능한 수준으로 만든다
- 구조 누락, 과도한 fallback, 과도한 회색 재질을 먼저 줄인다

작업:

- building opening / facade 허상 정리
- 도로, 횡단보도, 차선, 정지선 레이어의 누락 원인 로그 강화
- material fallback 재조정
- `fidelity_plan` 로그와 지표 추가

완료 기준:

- 중심부 구조 보존율이 안정적일 것
- diagnostics에서 레이어별 누락 원인이 구분될 것
- 기본 장면이 “검은 바닥 + 흰 박스” 상태를 벗어날 것

## Phase 2. Hybrid Foundation

목표:

- 절차형 엔진 위에 reality overlay를 얹을 수 있는 인터페이스를 만든다

작업:

- `SceneFidelityPlan` 타입 도입
- `SceneFidelityPlannerService` 도입
- `Fidelity Source Registry` 도입
- `Reality Overlay Builder` 입력 계약 정의

완료 기준:

- scene meta/detail/bootstrap에서 현재 모드와 목표 모드를 확인할 수 있을 것
- 어떤 소스를 어떤 범위에 적용할지 planner가 결정할 수 있을 것

## Phase 3. Reality Overlay Integration

목표:

- 현실감이 중요한 코어 구역에 고정밀 레이어를 얹는다

작업:

- curated asset pack 또는 고정밀 overlay source 1종 연결
- 랜드마크/핵심 교차로 우선 overlay
- procedural base와 overlay의 masking 규칙 구현

완료 기준:

- 핵심 구역이 절차형 box city 느낌에서 벗어날 것
- place-specific code 없이 place-specific data만으로 동작할 것

## Phase 4. Multi-Place Validation

목표:

- 시부야 외 다른 고밀도 지역에서도 동일 구조가 동작하는지 검증한다

작업:

- 타임스퀘어
- 강남역
- 광화문 또는 유사 밀도 지역

완료 기준:

- 공통 planner와 공통 overlay 계약으로 여러 지역이 생성될 것
- 특정 지역 전용 엔진 분기 없이 품질이 유지될 것
