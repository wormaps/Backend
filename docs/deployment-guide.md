# Deployment Guide

이 문서는 현재 WorMap 백엔드의 배포 전 체크리스트를 정리한다.

## 1. 배포 전 확인

- `bun run type-check`
- `bun test`
- `bun run bench:scene`는 필요 시 별도 실행
- 환경 변수 확인
  - `GOOGLE_API_KEY`
  - `TOMTOM_API_KEY`
  - `MAPILLARY_ACCESS_TOKEN`
  - `OVERPASS_API_URLS`
  - `INTERNAL_API_KEY`

## 2. 런타임 명령

- 개발: `bun run start:dev`
- 프로덕션: `bun run start:prod`

## 3. 배포 고려사항

- `Scene` 데이터는 로컬 파일 저장소를 사용하므로 배포 환경의 writable storage가 필요하다.
- health readiness는 외부 API 연결 상태에 의존한다.
- bench 실행은 실제 외부 API 설정 상태에 따라 수치가 달라진다.
- **필수 환경 변수**: `GOOGLE_API_KEY`, `OVERPASS_API_URLS`가 설정되지 않으면 `/api/health`가 503을 반환한다. Kubernetes readiness probe가 이를 사용하므로 배포 전 반드시 확인한다.
- Phase 3 이후에는 representative smoke에서 TEXCOORD preflight / glTF validator / QA reject 여부를 함께 확인해야 한다.
- representative scene이 `QA_REJECTED` 이면 asset build가 성공했더라도 Visual Gate는 통과한 것으로 보지 않는다.
- representative scene이 `READY`이고 `qualityGate=PASS`, `QA summary=WARN`인 경우에도 Phase 3 close는 가능하다. 이때 Visual Gate는 representative `observedAppearanceCoverage >= 0.05`, baseline 대비 5배 이상 증가, representative landmark/highrise scene의 `fallbackMassingRate = 0` 기준으로 판단한다.
- CI baseline evidence는 `.github/workflows/ci.yml`의 `bun run type-check`, `bun run test`, `bun run build`와 Phase 3 회귀 테스트들로 확인한다.
- Phase 4 이후에는 Geography Gate 기준으로 다음을 함께 확인해야 한다:
  - meter-based interpolation 유지
  - terrain mode가 diagnostics와 contract에 명시됨
  - high latitude / invalid polygon / no DEM fixture 테스트 통과
- terrain fallback이 발생하면 `GET /api/scenes/{sceneId}/diagnostics`와 diagnostics log에서 `FLAT_PLACEHOLDER` 여부를 먼저 확인한다.
- Phase 5 이후에는 Resilience Gate 기준으로 다음을 함께 확인해야 한다:
  - provider-specific retry policy가 적용됨
  - Open Meteo serialization queue가 동작함
  - circuit breaker state와 providerHealth snapshot이 관측됨
  - 429 / timeout / 5xx fault injection 테스트가 통과함
- provider 장애 시 우선 확인:
  - `GET /api/health/readiness`의 `providerHealth`
  - `circuit_breaker_state`
  - `circuit_breaker_rejections_total`
  - `external_api_requests_total`의 provider/outcome/statusClass labels

## 4. Phase 7 Release-Blocking Rules

Phase 7은 QA 실패가 배포 경로로 우회되는 것을 원천 차단한다. 아래 규칙은 advisory가 아니라 binary gate다.

### 4-1. QA Fail But Release Pass 금지

- **규칙**: `QA summary=FAIL`인 scene은 어떤 경우에도 `READY` 상태가 될 수 없으며, 배포 대상에서 제외된다.
- **근거**: `test/phase1-qa-fail-blocks-ready.spec.ts` — QA FAIL 시 `status=FAILED`, `failureCategory=QA_REJECTED`로 고정됨.
- **차단 경로**: `SceneGenerationResultService.persist()`에서 QA summary가 FAIL이면 quality gate 통과 여부와 무관하게 scene을 FAILED로 처리한다.
- **예외 없음**: 수동 override, admin bypass, force-ready 같은 경로는 존재하지 않는다.

### 4-2. 배포 전 필수 검증 명령

배포 전 아래 명령을 순서대로 실행하고 전부를 통과해야 한다.

| 순서 | 명령 | 목적 |
|---|---|---|
| 1 | `bun run type-check` | 정적 타입 검증 |
| 2 | `bun test` | 전체 테스트 스위트 (QA fail blocking 포함) |
| 3 | `bun run bench:scene` | 성능 벤치마크 (필요 시) |
| 4 | `bun run scene:generate-test-scenes` | representative 8개 scene live evidence 생성 |
| 5 | `bun run scene:qa-table` | representative 8개 scene QA table 재생성 및 core gate |

### 4-3. QA Table 판정 기준

`bun run scene:qa-table`이 생성하는 `data/scene/scene-qa-table.json`에서 다음을 확인한다.

- `readyCount`: READY 상태인 scene 수
- `failedCount`: FAILED 상태인 scene 수 — **0이 아니면 배포 차단**
- 각 row의 `readyGate.passed`: false인 scene이 있으면 해당 scene은 배포 대상에서 제외
- `score.provisional`: true인 scene은 점수가 확정되지 않은 것이므로 참고용으로만 사용

### 4-4. Regression Gate 

- representative scene regression suite는 `test/phase3-regression-evidence.spec.ts`에서 검증한다.
- representative 8-scene QA table contract는 `test/phase7-representative-regression.spec.ts`에서 검증한다.
- representative live gate는 `test/phase7-qa-table-gate.spec.ts`와 `scripts/build-scene-qa-table.ts`에서 core 5-scene 기준 fail-closed로 동작한다.
- failure-path regression은 `test/phase7-failure-paths.spec.ts`에서 검증한다.
- weather/traffic provider fallback은 `test/phase7-weather-provider.spec.ts`, `test/phase7-traffic-provider.spec.ts`에서 검증한다.
- CI(`.github/workflows/ci.yml`)에서 `bun test`가 regression suite를 포함하여 실행된다.

## 5. 실패 시 우선 확인

- 외부 API 키 누락
- `SCENE_DATA_DIR` writable 여부
- `readiness` 상태
- 최근 실패 이력: `/api/scenes/debug/failures`
