# Src DDD MVP Skeleton

## Problem

WorMap v2는 `docs/`와 `packages/contracts`를 기준으로 clean-slate MVP를 시작해야 한다. `src/`는 API/GLB 기능을 빨리 붙이는 곳이 아니라 계약을 실행하는 application/domain/infrastructure 경계를 잡는 곳이다.

## Initial Approach

초기 접근은 `shared`, `providers`, `twin`, `render`, `qa`, `glb`, `build` 폴더를 만들고 각 폴더에 최소 service와 module registry를 두는 방식이었다.

## Issues Found

- `SceneBuildOrchestratorService`가 concrete module singleton을 직접 import했다.
- `SceneBuildAggregate`가 모든 상태 전이를 허용했다.
- QA가 타입상 불가능한 MeshPlan 상태를 검사했다.
- evidence graph identity가 scene id와 혼동됐다.
- NestJS module 명명과 실제 external dependency 부재 사이에 migration 지점이 명확하지 않았다.

## DDD Redesign

- `SceneBuildAggregate`는 lifecycle invariant를 지키는 Aggregate Root다.
- `SceneBuildOrchestratorService`는 constructor-injected ports/services만 사용한다.
- `app.module.ts`는 composition root로 wiring만 담당한다.
- `TwinSceneGraph`, `EvidenceGraph`, `RenderIntentSet`, `MeshPlan`은 public contract artifact로 다룬다.
- QA Gate는 현재 타입 계약으로 실제 검증 가능한 invariant만 검사한다.

## Key Learnings

- `shared`는 logger/config/result/clock 같은 전역 인프라만 포함한다.
- build domain은 다른 도메인을 조율할 수 있지만 concrete singleton을 직접 import하면 안 된다.
- 상태 전이 정책은 application service가 아니라 aggregate invariant로 둔다.
- MVP skeleton이라도 docs contract와 다르면 즉시 수정한다.
