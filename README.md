# WorMap Backend

NestJS 기반의 scene generation backend입니다. 현재 목표는 범용 도시 생성기가 아니라, 특정 장소를 `scene-meta.json + scene-detail.json + base.glb` 조합으로 생성하고 FE가 바로 붙을 수 있는 계약을 제공하는 것입니다.

## 현재 범위

- Google Places 기반 장소 검색 및 상세 조회
- Overpass 기반 구조 수집
  - building
  - road
  - walkway
  - crossing
  - street furniture
  - vegetation
  - land cover / linear feature
- Mapillary 기반 거리 디테일 추론
  - facade palette
  - signage density
  - crosswalk style
  - street furniture density
- 장소별 hero override
  - 현재는 Shibuya Scramble Crossing 전용 manifest 포함
- semantic lowpoly `.glb` 생성
- scene status / bootstrap / live API

## 실행

```bash
bun install
bun run start:dev
```

Swagger:

```text
http://localhost:3000/docs
```

## 검증

```bash
bun run type-check
bun test
bun run bench:scene
bun run scene:qa-table
```

- 테스트 코드는 `test/` 폴더에 둡니다.
- `src/` 내부에는 테스트를 두지 않습니다.
- 벤치마크는 `bun run bench:scene` 으로 실행합니다.
- phase 6 load fixture는 `SCENE_BENCH_PROFILE=phase6-load bun run bench:scene` 로 실행합니다.
- 벤치마크 결과 JSON은 기본적으로 `data/benchmark/scene-benchmark-report.json`에 기록됩니다.
- representative QA table은 `bun run scene:qa-table`로 재생성하며, 결과는 `data/scene/scene-qa-8-table.json`에 기록됩니다.
- **Phase 7 규칙**: QA summary=FAIL인 scene은 READY가 될 수 없으며, 배포 대상에서 제외됩니다. (`test/phase1-qa-fail-blocks-ready.spec.ts`)
- representative 8-scene QA table contract regression은 `test/phase7-representative-regression.spec.ts`에서 확인합니다.

시부야 smoke:

```bash
bun run scene:shibuya
```

- smoke는 기본적으로 `data/scene` 디렉터리를 사용합니다.
- `SCENE_FORCE_REGENERATE`가 `false`가 아니면 재생성을 시도합니다.

## 주요 산출물

- `data/scene/{sceneId}.json`
- `data/scene/{sceneId}.meta.json`
- `data/scene/{sceneId}.detail.json`
- `data/scene/{sceneId}.glb`

## 주요 API

- `POST /api/scenes`
- `GET /api/scenes/{sceneId}`
- `GET /api/scenes/{sceneId}/meta`
- `GET /api/scenes/{sceneId}/detail`
- `GET /api/scenes/{sceneId}/bootstrap`
- `GET /api/scenes/{sceneId}/assets/base.glb`
- `GET /api/scenes/{sceneId}/traffic`
- `GET /api/scenes/{sceneId}/weather`
- `GET /api/scenes/{sceneId}/places`

## Scene 계약 메모

- `base.glb`는 정적 구조 + 시각 힌트 자산입니다.
  - Google Places
  - Overpass
  - Mapillary-derived hint
  - hero override
- `weather`, `traffic`는 현재 `.glb`에 bake되지 않습니다.
- `GET /api/scenes/{sceneId}/bootstrap`의 `glbSources`로 어떤 데이터가 GLB에 반영됐는지 확인할 수 있습니다.

## Geospatial correctness 메모

- terrain interpolation은 degree delta가 아니라 meter distance 기준으로 계산합니다.
- terrain mode는 명시적 contract를 사용합니다:
  - `DEM_FUSED`: DEM sample 기반 elevation model 사용
  - `FLAT_PLACEHOLDER`: DEM 부재/실패/insufficient sample fallback
- high latitude에서는 longitude scale collapse를 막기 위해 meter-per-degree 계산에 minimum clamp를 둡니다.
- invalid polygon / degenerate footprint는 domain validation에서 reject합니다.
- 관련 검증 테스트:
  - `test/phase9-terrain-profile.spec.ts`
  - `test/phase9-terrain-fusion.spec.ts`
  - `test/phase4-high-latitude-spatial.spec.ts`
  - `test/phase4-degenerate-geometry.spec.ts`

## Provider resilience 메모

- provider retry는 provider-specific policy matrix를 사용합니다.
- retry taxonomy:
  - `rateLimit`: 429
  - `timeout`: `TimeoutError`
  - `serverError`: 5xx
  - non-retryable 4xx는 breaker failure로 누적하지 않습니다.
- Open Meteo는 in-memory 직렬화 큐(concurrency=1)를 사용합니다.
- provider-scoped circuit breaker가 있고, Open Meteo current/historical는 같은 `open-meteo` scope를 공유합니다.
- health readiness는 `providerHealth` snapshot으로 degraded/open provider를 노출합니다.
- 관련 검증 테스트:
  - `test/phase5-provider-resilience.spec.ts`
  - `test/health-readiness.spec.ts`

## 개발 문서

- 대형 파일 분해(500 LOC 기준) 결과 및 모듈 책임:
  - `docs/oversized-file-modularization-notes.md`
- 아키텍처 개요:
  - `docs/architecture.md`
- 배포 가이드:
  - `docs/deployment-guide.md`
- 운영 매뉴얼:
  - `docs/operations-manual.md`
- 검증 및 벤치마크 운영 기준:
  - `docs/scene-validation-and-benchmark.md`
- Phase remediation 명세 및 체크리스트:
  - `docs/phase.md`

## 폴더 구조 원칙 (Domain Root Minimal)

- 도메인 root에는 가능한 파일을 두지 않고, 기능 폴더로 구성합니다.
- 현재 정리된 대표 구조:

```text
src/assets/compiler/
  building/
  materials/
  road/
  street-furniture/
  vegetation/

src/assets/internal/
  glb-build/

src/docs/
  common/
  decorators/
  external/
  health/
  places/
  scene/
  setup/
```

- import는 가능하면 feature 폴더 barrel(`index.ts`)을 우선 사용하고,
  feature 내부 helper는 해당 폴더 내부 상대경로를 사용합니다.

## 환경 변수 메모

- `GOOGLE_API_KEY`
- `TOMTOM_API_KEY`
- `MAPILLARY_ACCESS_TOKEN`
- `MAPILLARY_AUTHORIZATION_URL`
- `MAPILLARY_IMAGE_ALLOWED_HOSTS`
- `OVERPASS_API_URLS`
- `CORS_ALLOWED_ORIGINS`
- `INTERNAL_API_KEY`

`INTERNAL_API_KEY`는 **필수** 환경 변수입니다. 설정되지 않거나 비어 있으면 `health`, `metrics`를 제외한 모든 API 엔드포인트가 `401 UNAUTHORIZED`로 차단됩니다(fail closed). 유효한 키가 설정된 경우 `x-api-key` 헤더 또는 `Authorization: Bearer <key>`로 인증해야 합니다.
