# Twin Scene Graph Metadata Factory

## Problem

`TwinGraphBuilderService`가 metadata 계산까지 직접 가지고 있으면 projection, relationship, validation을 분리해도 builder가 다시 비대해질 수 있다.

## Initial Approach

`TwinSceneGraphMetadataFactory`를 추가해 observed/defaulted ratio, entity count, initial tier candidate, quality issue 집계를 별도 서비스로 분리했다.

## Issues Found

- metadata 계산은 분리됐지만 여전히 계산식 자체는 단순하다.
- core/context 분리는 아직 실제 계산이 아니라 전체 entity count 기준이다.
- initial reality tier는 이제 `RealityTierResolver`를 통해 계산되지만, 아직 observed ratio 중심의 단순 정책이다.

## DDD Redesign

- builder는 artifact 조합만 담당한다.
- metadata factory는 graph metric/value 계산을 담당한다.
- `RealityTierResolver`는 별도 `reality` 도메인으로 분리해 twin/render가 공통으로 사용한다.

## Key Learnings

- metadata도 도메인 계산이면 별도 서비스로 분리하는 편이 낫다.
- 아키텍처를 안정화하는 과정은 큰 기능 추가보다 작은 책임 이동의 연속이다.
