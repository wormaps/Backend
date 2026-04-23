# Scene Build Run Result

## Problem

orchestrator가 산출물을 익명 객체로 반환하면 단계가 늘어날수록 계약이 흐려진다.

## Initial Approach

`SceneBuildRunResult`를 추가해 세 가지 결과를 명시적으로 고정했다.

- `snapshot_failure`
- `quarantined`
- `completed`

## Issues Found

- 반환 타입은 명확해졌지만 orchestrator가 여전히 많은 artifact를 한 번에 들고 있다.
- result type은 생겼지만 build application 계층 전반에 아직 공유되지 않는다.

## DDD Redesign

- build orchestrator는 명시적 result contract를 반환한다.
- 이후에는 build read model이나 API response mapper가 이 result를 소비하도록 분리하는 것이 맞다.

## Key Learnings

- artifact chain이 커질수록 명시적 result type이 필요하다.
- 구조를 단단하게 만드는 데는 기능 추가보다 반환 계약 고정이 더 중요할 때가 많다.
