# Operations Manual

이 문서는 운영 중 자주 확인하는 항목만 정리한다.

## 1. 건강 상태

- `GET /api/health`
- `GET /api/health/liveness`
- `GET /api/health/readiness`

## 2. 씬 디버그

- `GET /api/scenes/debug/queue`
- `GET /api/scenes/debug/failures`
- `GET /api/scenes/{sceneId}/diagnostics`

## 3. 장애 조사 순서

1. `readiness` 확인
2. 최근 실패 이력 확인
3. diagnostics 로그 확인
4. 해당 scene의 bootstrap / detail / meta 확인

## 4. 재생성 기준

- 동일 씬이 실패 상태면 원인 제거 후 재생성한다.
- 동일 요청 재사용이 기대와 다르면 queue snapshot과 cache snapshot을 본다.
- 외부 API 장애가 반복되면 bench와 통합 테스트를 분리해서 본다.
