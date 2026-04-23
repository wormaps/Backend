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

## 5. Asset validation / Phase 3 메모

- GLB build는 serialization 전에 TEXCOORD preflight를 수행한다.
- 실제 texture가 bound 된 primitive에 `TEXCOORD_0`가 없으면 build는 fail closed 된다.
- glTF validator는 secondary confirmation으로 계속 실행한다.
- triangulation fallback은 `triangulationFallbackCount`로 evidence-only 노출된다.
- geometry correction은 `correctedRatio`로 advisory signal을 남긴다.
- representative smoke의 최신 기준에서는 `qualityGate=PASS`와 `scene.status=READY`를 먼저 확인하고, 그 다음 `QA summary`와 `observed_coverage` 수치를 함께 본다.
- 현재 representative evidence는 Shibuya / Akihabara 모두 `QA summary=WARN`이며 `observed_coverage`가 baseline(0.008) 대비 증가한 상태다.
- Phase 3 Visual Gate close 기준은 representative `observedAppearanceCoverage >= 0.05`, baseline 대비 5배 이상 증가, representative landmark/highrise scene의 `fallbackMassingRate = 0` 여부로 판단한다.
- CI 확인 경로:
  - `.github/workflows/ci.yml`
  - `bun run type-check`
  - `bun run test`
  - `test/phase3-texcoord-preflight.spec.ts`
  - `test/phase3-texcoord-geometry.spec.ts`
- `test/phase3-triangulation-fallback-metric.spec.ts`
- `test/phase3-observed-coverage-mapillary.spec.ts`

## 6. Geospatial correctness / Phase 4 메모

- terrain interpolation은 raw degree delta가 아니라 physical meter distance를 사용해야 한다.
- 현재 terrain IDW는 `scene-terrain-profile.service.ts`의 `haversineDistanceMeters` 기반으로 동작한다.
- terrain mode contract:
  - `DEM_FUSED`: DEM sample이 충분하여 elevation model이 활성화된 상태
  - `FLAT_PLACEHOLDER`: DEM 부재/실패/insufficient sample로 인해 flat fallback이 활성화된 상태
- fallback observability:
  - `GET /api/scenes/{sceneId}/diagnostics`
  - scene diagnostics log의 `terrain_profile`, `terrain_fusion` stage
  - 확인 필드: `mode`, `source`, `hasElevationModel`, `heightReference`, `sampleCount`, `sourcePath`
- high-latitude safety:
  - extreme latitude에서는 longitude scale collapse를 막기 위해 meter-per-degree 계산에 minimum clamp를 적용한다
  - bounds와 local ENU helper는 finite result를 유지해야 한다
- invalid polygon handling:
  - zero-area / collinear footprint는 domain layer에서 reject한다
- CI 확인 경로:
  - `.github/workflows/ci.yml`
  - `bun run test`
  - `test/phase9-terrain-profile.spec.ts`
- `test/phase9-terrain-fusion.spec.ts`
- `test/phase4-high-latitude-spatial.spec.ts`
- `test/phase4-degenerate-geometry.spec.ts`

## 7. Provider resilience / Phase 5 메모

- provider retry는 one-size-fits-all이 아니라 provider policy matrix를 따른다.
- 현재 retry taxonomy:
  - `rateLimit`: 429
  - `timeout`: `TimeoutError`
  - `serverError`: 5xx
  - non-retryable 4xx는 breaker failure로 누적하지 않는다
- provider policy matrix:
  - `open-meteo`: retryOn=`rateLimit,serverError`, maxRetries=3
  - `google-places`: retryOn=`rateLimit`, maxRetries=2
  - `tomtom`: retryOn=`rateLimit,timeout`, maxRetries=2
  - `mapillary`: retryOn=`rateLimit,serverError`, maxRetries=2
  - `overpass`: retryOn=`rateLimit,timeout,serverError`, maxRetries=3
- Open Meteo는 client boundary에서 직렬화 큐(concurrency=1)를 사용한다.
- circuit breaker observability:
  - `GET /api/health/readiness`
  - `providerHealth.providers[*]`
  - `circuit_breaker_state`
  - `circuit_breaker_rejections_total`
- provider state 해석:
  - `healthy`: breaker closed + no active failure streak
  - `degraded`: half-open 또는 failure streak 존재
  - `open`: breaker open 상태, fast rejection 중
- 최소 alert 기준:
  - `circuit_breaker_state{provider="open-meteo"} == 2` 지속
  - `circuit_breaker_rejections_total` 급증
  - `external_api_requests_total{outcome="failure"}` 비율 상승
- CI 확인 경로:
  - `.github/workflows/ci.yml`
  - `bun run test`
  - `test/phase5-provider-resilience.spec.ts`
  - `test/health-readiness.spec.ts`

## 8. Phase 7 QA Policy and Regression Suite

### 8-1. QA Fail But Release Pass 금지 정책

- QA summary가 `FAIL`인 scene은 **어떤 경우에도** `READY`로 승격되지 않는다.
- 이는 `SceneGenerationResultService.persist()`에서 강제되며, quality gate 통과 여부와 무관하다.
- 실패한 scene은 `status=FAILED`, `failureCategory=QA_REJECTED`로 기록된다.
- 수동 우회 경로는 존재하지 않는다. 배포는 QA 통과 scene만으로 구성된다.

### 8-2. Representative Regression Suite

대표 8개 scene에 대한 회귀 검증은 다음 테스트 파일에서 수행된다.

| 테스트 파일 | 검증 대상 |
|---|---|
| `test/phase1-qa-fail-blocks-ready.spec.ts` | QA FAIL → READY 차단, QA_REJECTED 분류 |
| `test/phase7-representative-regression.spec.ts` | representative 8-scene QA table contract |
| `test/phase7-qa-table-gate.spec.ts` | core 5-scene gate fail-closed, tail 3-scene non-blocking |
| `test/phase7-failure-paths.spec.ts` | parse failure, stale lock, retry, quality gate blocking |
| `test/phase3-regression-evidence.spec.ts` | UV contract, preflight, triangulation fallback, correctedRatio 회귀 |
| `test/phase7-weather-provider.spec.ts` | weather provider fallback → UNKNOWN |
| `test/phase7-traffic-provider.spec.ts` | traffic provider fallback → UNAVAILABLE |

전체 테스트 실행: `bun test`

### 8-3. QA Table 재생성 절차

`bun run scene:qa-table`은 8개 representative scene의 현재 상태를 집계하여 `data/scene/scene-qa-table.json`에 기록한다.

`bun run scene:generate-test-scenes`는 동일한 8개 representative scene의 live evidence를 먼저 생성한다.

`bun run scene:qa-table`은 `data/scene/scene-qa-table.json`에 기록한다.

**실행 시기:**
- 배포 전 필수 검증 단계
- scene 재생성 후 품질 확인
- CI/CD 파이프라인에서 선택적 실행

**권장 순서:**
1. `bun run scene:generate-test-scenes`
2. `bun run scene:qa-table`

**대표 scene 목록:**
1. Shibuya Scramble Crossing, Tokyo
2. Gangnam Station Intersection, Seoul
3. N Seoul Tower, Seoul
4. Yeoksam-dong Residential Area, Seoul
5. Incheon Industrial Complex, Incheon
6. Han River Banpo Hangang Park, Seoul
7. Haeundae Beach, Busan
8. Bulguksa Temple, Gyeongju

**출력 확인 항목:**
- `readyCount` / `pendingCount` / `failedCount` — failedCount > 0이면 배포 차단
- 각 row의 `readyGate.passed` — false인 scene은 배포 대상 제외
- `score.provisional` — true인 scene은 점수 확정 전이므로 참고용
- `recommendations` — 자동 생성된 개선 제안

**QA Table과 Regression Suite의 관계:**
- QA Table은 **현재 상태의 스냅샷**을 제공한다 (8개 representative scene).
- Regression Suite는 **코드 변경이 기존 품질을 훼손하지 않았는지** 검증한다.
- 배포 전 둘 다 확인해야 한다: QA Table로 현재 품질 상태를 보고, Regression Suite로 회귀 여부를 확인한다.
