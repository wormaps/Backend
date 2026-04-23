# QA Final Tier And Control

## Problem
QA가 지금까지는 사실상 `pass/fail`만 판단했고, final Reality Tier와 detail stripping을 실제로 제어하지 못했다.

## Change
- `QaGateService`가 이제 `finalTier`를 계산한다
- `strip_detail` action이 있으면 structural intent를 massing으로 낮춘다
- `downgrade_tier` action이 있으면 provisional tier를 final tier에서 내린다
- orchestrator는 QA 결과의 `effectiveIntentSet`을 최종 artifact chain에 사용한다

## State Machine
- `MESH_PLANNED -> QA_RUNNING -> GLB_BUILDING` 경로를 허용한다
- critical issue면 `QA_RUNNING -> QUARANTINED`

## Current Limit
- 현재 fixture 경로는 structural detail을 거의 생성하지 않으므로 strip detail은 unit test로 보강했다
- final tier는 아직 manifest contract에 기록하지 않는다
