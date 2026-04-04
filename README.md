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

시부야 smoke:

```bash
bun run scene:shibuya
```

## 주요 산출물

- `data/scenes/{sceneId}.json`
- `data/scenes/{sceneId}.meta.json`
- `data/scenes/{sceneId}.detail.json`
- `data/scenes/{sceneId}.glb`

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

## 환경 변수 메모

- `GOOGLE_API_KEY`
- `TOMTOM_API_KEY`
- `MAPILLARY_ACCESS_TOKEN`
- `MAPILLARY_AUTHORIZATION_URL`
- `MAPILLARY_AUYHORIZATION_URL`
- `OVERPASS_API_URLS`

`MAPILLARY_AUTHORIZATION_URL`과 `MAPILLARY_AUYHORIZATION_URL`은 둘 다 지원하지만, 올바른 이름은 `MAPILLARY_AUTHORIZATION_URL`입니다.
