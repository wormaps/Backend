# ADR 0003: Render Intent Layer

## Status

Accepted

## Decision

`TwinSceneGraph`와 `MeshPlan` 사이에 `RenderIntentSet`을 둔다.

## Reason

사실 계층과 시각화 정책 계층을 분리해야 confidence, fallback, LOD, detail stripping을 제어할 수 있다.

## Consequences

- GLB 품질 개선은 먼저 render policy 변경으로 표현한다.
- 낮은 confidence entity는 massing, placeholder, excluded 중 하나로 내려간다.
