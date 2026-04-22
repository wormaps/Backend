# Phase 6 Benchmark Plan

## Problem
Phase 6의 목표는 대형 scene 처리량을 측정할 수 있는 반복 가능한 하네스를 만드는 것이다. 단순히 `createScene()`를 호출하는 것만으로는 벤치 결과를 재현하기 어렵고, 어떤 fixture를 썼는지와 최종 scene 상태가 무엇인지 남지 않으면 운영 증거로 쓰기 어렵다.

## Initial Approach
기존 `scripts/scene-benchmark.ts`는 단일 query와 concurrency를 받아서 실행하는 스크립트였다. 측정은 되지만 plan과 report가 코드에 섞여 있고, 결과를 파일로 남기는 경로가 약했다.

## Issues Found
- benchmark 실행 결과가 `PENDING`으로 남는 문제를 바로 확인하기 어려웠다.
- 결과 파일이 표준 위치에 남지 않아서 운영에서 재실행하기 불편했다.
- load fixture와 single benchmark의 구분이 약해서 Phase 6 profile을 정의하기 어려웠다.
- case-level 결과와 전체 metrics snapshot이 같은 레벨로 정리되지 않았다.

## DDD Redesign
- `BenchmarkPlan`을 pure data로 분리했다.
- 실행기는 `scripts/scene-benchmark.ts`에 남기고, plan/report 계산은 `scripts/scene-benchmark.plan.ts`로 옮겼다.
- `phase6-load` profile을 추가해 대표 load fixture를 재현 가능하게 했다.
- 최종 scene 상태를 `getScene()`으로 다시 읽어서 report에 남기고, `statusCounts`로 READY/FAILED/PENDING을 집계했다.

## Key Learnings
- 하네스는 측정값만이 아니라 입력 fixture, output path, status summary까지 남겨야 한다.
- `createScene()`의 즉시 반환값은 benchmark 종료 상태가 아니다.
- 큰 scene throughput은 숫자만 보는 것이 아니라, 실패를 드러내는 방식까지 포함해야 한다.
- plan/report를 분리하면 벤치 실행과 운영 증거 수집을 같이 다루기 쉬워진다.
