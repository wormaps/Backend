# Phase 2 Fixtures First

## Problem

Phase 2는 provider API나 GLB 디테일보다 fixture를 먼저 고정해야 한다. 목표는 baseline/adversarial 입력이 pipeline contract를 흔들지 않는지 검증하는 것이다.

## Initial Approach

baseline fixture 3개와 partial snapshot adversarial fixture 1개를 만들고, orchestrator가 evidence graph, twin scene graph, render intent, mesh plan, QA result, manifest를 반환하는지 테스트했다.

## Issues Found

- snapshot helper가 scene id를 고정해 fixture identity와 snapshot identity가 어긋날 수 있었다.
- adversarial coverage가 문서의 fixture 목록보다 부족했다.
- provider failure가 QA issue distribution으로 표현되지 않았다.
- fixture expected artifact contract가 명시적이지 않았다.

## DDD Redesign

- fixture는 immutable test artifact bundle로 둔다.
- fixture와 snapshot scene id 일치 invariant를 테스트한다.
- provider failure는 `PROVIDER_SNAPSHOT_FAILED` issue로 기대 분포에 반영한다.
- expected artifact presence를 fixture 계약에 포함한다.

## Key Learnings

- fixture는 예쁜 샘플 데이터가 아니라 계약을 깨뜨리는 입력을 고정하는 장치다.
- Phase 2에서는 GLB 품질보다 replay, identity, expected issue distribution이 우선이다.
- snapshot failure를 상태만으로 처리하면 QA/reporting 계약이 약해진다.
