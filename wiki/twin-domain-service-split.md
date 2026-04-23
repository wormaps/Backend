# Twin Domain Service Split

## Problem

`TwinGraphBuilderService` 하나에 projection, relationship 생성, graph validation이 모두 들어가 있으면 twin 도메인이 빠르게 비대해진다.

## Initial Approach

기존 `TwinGraphBuilderService` 내부 로직을 세 서비스로 분리했다.

- `TwinEntityProjectionService`
- `SceneRelationshipBuilderService`
- `TwinGraphValidationService`

`TwinGraphBuilderService`는 이제 이들을 조합해 최종 `TwinSceneGraph`를 만든다.

## Issues Found

- 관계 생성 규칙은 여전히 fixture hint 중심이다.
- graph validation은 최소 invariant만 본다.
- projection geometry는 아직 placeholder 수준이다.

## DDD Redesign

- projection은 normalized entity를 typed entity로 승격한다.
- relationship builder는 scene semantic만 담당한다.
- graph validator는 graph invariant만 담당한다.
- 향후 spatial engine이 들어오면 relationship builder와 validator 내부만 교체한다.

## Key Learnings

- 기능을 늘리기 전에 service 경계를 나누는 편이 훨씬 덜 위험하다.
- 지금 단계에서 중요한 것은 “더 많은 기능”보다 “어느 서비스가 어떤 책임을 가지는가”다.
