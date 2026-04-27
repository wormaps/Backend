# Render Intent Policy And Tier Resolution

## Problem
render 계층이 `TwinSceneGraph`를 거의 소비하지 못하고 있었고, provisional Reality Tier도 항상 고정값이었다.

## Change
- `RenderIntentPolicyService` 추가
- `RealityTierResolverService` 추가
- `RenderIntentResolverService`는 이제 policy와 tier resolver를 조합만 한다
- fixture 테스트에 visual mode 분포와 initial/provisional tier 검증 추가

## Current Limits
- `structural_detail`, `landmark_asset`는 아직 열지 않았다
- core/context area 분리는 아직 계산하지 않는다
- facade evidence가 없으므로 provisional tier 상한은 현재 `PROCEDURAL_MODEL`이다

## Why
문서 기준에서 render는 단순 변환 계층이 아니라 fact model을 visual policy로 내리는 계층이다. 이 단계가 약하면 graph를 잘 만들어도 결과가 다시 임의적이 된다.
