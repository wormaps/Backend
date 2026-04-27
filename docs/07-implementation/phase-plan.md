# Phase Plan

## Phase 0: Foundation Docs

문서/위키/ADR/품질 기준을 고정한다.

**완료 기준:** wiki/Home.md 작성, ADR 0001 승인, PRD v2.3 리뷰, domain-boundaries, QA registry

## Phase 1: Schema Contracts

`packages/core`와 `packages/contracts`에 타입 계약을 만든다.

**완료 기준:** 12개 계약 typed schema, provider raw 타입 격리, QaIssueCode const registry

## Phase 2: Fixtures First

baseline/adversarial fixture와 expected QA distribution을 고정한다.

**완료 기준:** fixture별 QA distribution 고정, deterministic replay 통과

## Phase 3: Provider Snapshot MVP

API 통합이 아니라 snapshot/replay/compliance를 먼저 구현한다.

**완료 기준:** snapshot bundle replay, partial failure SNAPSHOT_PARTIAL, compliance QA critical

## Phase 4: Graph and Intent MVP

GLB 없이 scene 품질을 판단한다.

**완료 기준:** conflict entity 차단, contextArea massing, major→downgrade/strip

## Phase 5: Minimal MeshPlan and GLB

massing, road, walkway, POI marker만 지원하는 최소 GLB를 만든다.

**완료 기준:** empty node=0, pivot missing=0, validator error=0, smoke test, tier 검증
