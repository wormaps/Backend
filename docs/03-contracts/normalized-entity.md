# Normalized Entity Contract

`NormalizedEntityBundle`은 provider snapshot과 Evidence Graph 사이의 중간 산출물이다.

## 역할

- raw provider schema를 제거한다.
- source reference를 보존한다.
- entity seed와 QA issue를 evidence graph 이전에 고정한다.

## MVP 범위

MVP에서는 실제 geometry parser를 구현하지 않는다. fixture가 선언한 provider/geometry/spatial/compliance issue를 normalized bundle에 보존한다.

## 규칙

- raw payload는 포함하지 않는다.
- 모든 normalized entity는 source ref를 가진다.
- normalized bundle 없이 Evidence Graph를 생성하지 않는다.
