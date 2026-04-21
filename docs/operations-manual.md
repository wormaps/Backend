# Operations Manual

이 문서는 운영 중 자주 확인하는 항목만 정리한다.

## 1. 건강 상태

### 1-1. 엔드포인트

- `GET /api/health` — 필수 의존성 설정 반영. 필수 의존성(Google Places, Overpass)이 설정되지 않으면 **503** 반환.
- `GET /api/health/liveness` — 프로세스 생존 확인. 항상 200.
- `GET /api/health/readiness` — 외부 API 실제 연결 상태 확인. 필수 의존성 실패 시 **503** 반환.

### 1-2. Readiness 판정 정책

| 구분 | 의존성 | 실패 시 영향 |
|---|---|---|
| **필수** | `googlePlaces`, `overpass` | scene 생성 불가 → readiness `degraded` (503) |
| **선택** | `mapillary`, `tomtom` | 외관/교통 정보 누락 가능 → readiness에는 영향 없음 |

- `/api/health`는 설정 존재 여부만 확인 (HTTP 호출 없음).
- `/api/health/readiness`는 실제 HTTP probe로 연결 상태를 확인한다.
- 필수 의존성이 하나라도 실패하면 readiness는 `degraded`이며 `missingRequired`에 누락된 의존성 이름이 포함된다.

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
