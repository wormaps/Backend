# Scene Relationship And Graph Validation

## Problem

`TwinEntity`가 생겼지만 `SceneRelationship`와 graph-level invariant가 비어 있으면 scene graph의 의미가 약하다.

## Initial Approach

`TwinGraphBuilderService` 안에서 최소 관계를 생성했다.

- traffic_flow + road -> `matches_traffic_fragment`
- duplicated footprint issue + peer entity -> `duplicates`
- road-building overlap issue + road/building peer -> `conflicts`

또한 graph-level validation으로 관계가 있어야 하는 issue가 관계 없이 남지 않도록 metadata issue를 보강했다.

## Issues Found

- 관계 생성 규칙은 아직 fixture 힌트 중심이다.
- 실제 spatial 연산 없이 관계를 만들기 때문에 geometry truth를 완전히 반영하지 못한다.
- graph validation은 현재 issue 누락 검출 수준이다.

## DDD Redesign

- normalization은 entity seed와 issue를 만든다.
- twin projection은 typed entity를 만든다.
- relationship builder는 graph semantic을 만든다.
- graph validator는 relationship와 entity invariant를 검증한다.

## Key Learnings

- entity만 있는 graph는 충분하지 않다.
- 관계와 graph invariant가 있어야 render/QA 정책이 entity 단위가 아니라 scene 단위로 작동한다.
- 다음 단계에서는 fixture 힌트가 아니라 실제 geometry/spatial validator로 관계 생성 근거를 옮겨야 한다.
