# Normalized To Twin Projection

## Problem

`NormalizedEntityBundle`이 중간 산출물로 들어왔지만, 실제로는 `TwinSceneGraph`의 빈 metadata만 채우고 있어 도메인 가치가 약했다.

## Initial Approach

`TwinGraphBuilderService`가 normalized entity seed를 최소 `TwinEntity`로 투영하도록 구현하고, fixture 테스트에서 normalized entity 수와 twin entity 수가 일치하는지 검증했다.

## Issues Found

- geometry는 아직 placeholder 좌표다.
- provider별 실제 entity projection 규칙은 매우 얇다.
- `TwinEntity`가 늘어도 relationship와 confidence 계산은 아직 단순하다.
- QA issue는 normalized 단계에서 생성되고 twin 단계에서는 보존만 된다.

## DDD Redesign

- normalization은 issue와 source reference를 포함한 entity seed를 만든다.
- twin projection은 seed를 실제 `TwinEntity`로 승격한다.
- relationship, confidence, reality tier 계산은 이후 twin domain service로 분리한다.

## Key Learnings

- `NormalizedEntityBundle`은 단순 중간 파일이 아니라 twin projection의 입력 계약이다.
- graph metadata만 채우는 상태로는 Scene Graph First 원칙을 충족했다고 보기 어렵다.
- 실제 entity projection을 넣어야 다음 단계의 render/QA/GLB가 의미를 가진다.
