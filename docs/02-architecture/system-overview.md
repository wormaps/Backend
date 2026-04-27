# System Overview

WorMap v2는 provider API를 바로 GLB로 변환하지 않는다.

```text
Provider Snapshot
-> Normalized Entity
-> Evidence Graph
-> Twin Scene Graph
-> RenderIntentSet
-> MeshPlan
-> GLB
-> QA Report
```

## 핵심 경계

- provider adapter는 raw API 응답을 `SourceSnapshot`으로 고정한다.
- graph layer는 reality/evidence를 표현한다.
- render layer는 시각화 정책을 표현한다.
- GLB compiler는 geometry correction과 provenance 생성을 하지 않는다.

## Backend / Frontend

- Backend: NestJS
- Frontend: Next.js viewer, QA dashboard
- Packages: `packages/core`, `packages/contracts`부터 시작한다.
