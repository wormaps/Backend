# ADR 0002: Twin Graph First

## Status

Accepted

## Decision

`TwinSceneGraph`를 canonical truth layer로 둔다.

## Rules

- provider raw schema는 graph 밖에 보존한다.
- 모든 entity는 source refs와 derivation을 가진다.
- conflict relationship은 정상 렌더 대상으로 자동 승격하지 않는다.
