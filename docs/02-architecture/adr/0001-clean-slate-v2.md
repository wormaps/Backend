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
