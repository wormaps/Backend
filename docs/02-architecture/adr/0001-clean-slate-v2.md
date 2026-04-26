# ADR 0001: Clean Slate v2

## Status

Accepted

## Context

v1은 raw/inferred/rendering state가 섞인 구조로 인해 GLB 품질 문제가 반복됐다.

## Decision

v1 복구 없이 v2 clean slate로 진행한다. `docs/`를 단일 진실 소스로 두고 Phase 0-1 계약부터 구현한다.

## Consequences

- 초기에는 사용자 가시 기능보다 계약/fixture가 먼저 나온다.
- v1 코드는 참고 대상일 수 있지만 복구 대상은 아니다.

## Alternatives Considered

### A: v1 incremental fix
- 상태 계층 분리가 근본적으로 불가능 (SceneMeta/SceneDetail 구조적 문제)
- GLB compiler 입력 계약 변경이 v1 구조와 호환되지 않음
- 결론: 리팩터링 비용이 재구축보다 높음

### B: v1 유지 + v2 병행 개발
- 리소스 분산으로 양쪽 품질 기준 유지 불가
- 팀 혼란 및 PRD v2 정책과 충돌
- 결론: 병행 개발은 유지보수 비용만 2배

## Consequences

### Positive
- 모든 데이터 계약을 docs-first로 설계 가능
- Provider raw type이 절대 Contracts 밖으로 노출되지 않음
- QA, RenderIntent, Reality Tier가 독립적으로 진화 가능
- 결정론적 재현성 보장 가능

### Negative
- 기존 v1 픽스처/테스트/데이터를 재작성해야 함
- 초기 개발 시간 증가 (기존 코드 활용 불가)
- v1 사용자의 업그레이드 경로 미정의

### Mitigation
- 계약 중심 개발로 재작성 리스크 최소화
- Fixture-first 전략으로 초기 품질 확보
- Phase 0-5 단계적 구현 계획 수립 완료
