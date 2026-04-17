# WorMap Architecture Overview

이 문서는 현재 백엔드 아키텍처의 핵심만 짧게 정리한다.

## 1. 현재 구성

- `src/places`
  - 외부 장소 소스와 지리 데이터 수집
- `src/scene`
  - 장소를 씬으로 변환하는 도메인
- `src/assets`
  - GLB 합성과 자산 생성
- `src/common`
  - HTTP, 로깅, 메트릭, 에러 공통 계층
- `src/docs`
  - API/Swagger DTO와 문서화 보조

## 2. 핵심 흐름

```text
Scene POST
  -> Place Resolution
  -> Place Package
  -> Visual Rules / Planning
  -> Hero Override / Geometry Correction
  -> GLB Build
  -> Storage
  -> Read / Bootstrap / Live API
```

## 3. 문서 기준

- 세부 하이브리드 아키텍처는 [`docs/acctecture.md`](/Users/user/wormapb/docs/acctecture.md)를 따른다.
- 운영 문서와 검증 기준은 [`docs/scene-validation-and-benchmark.md`](/Users/user/wormapb/docs/scene-validation-and-benchmark.md)를 따른다.
