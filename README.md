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
bun run test:e2e
```

- 유닛 테스트는 `src/**/*.spec.ts` 에 co-located로 둡니다.
- e2e 테스트는 `test/` 폴더에 둡니다.

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
- `GET /api/scenes/{sceneId}/status`
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

## 개발 문서

- 대형 파일 분해(500 LOC 기준) 결과 및 모듈 책임:
  - `docs/oversized-file-modularization-notes.md`

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

`INTERNAL_API_KEY`가 설정되면 `health`를 제외한 API 엔드포인트는 `x-api-key`(또는 `Authorization: Bearer <key>`) 검증을 통과해야 합니다.
