# WorMap Swagger 문서

## 엔드포인트

- Swagger UI: `GET /docs`
- OpenAPI JSON: `GET /docs-json`
- API Prefix: `/api`

로컬 실행 후 브라우저에서 아래 주소로 확인합니다.

```text
http://localhost:3000/docs
http://localhost:3000/docs-json
```

## 현재 문서화된 범위

- `GET /api/health`
- `GET /api/health/liveness`
- `GET /api/health/readiness`
- `GET /api/places`
- `GET /api/places/search`
- `GET /api/places/{placeId}`
- `GET /api/places/{placeId}/package`
- `GET /api/places/{placeId}/snapshot`
- `GET /api/places/google/{googlePlaceId}`
- `GET /api/places/google/{googlePlaceId}/package`
- `GET /api/places/google/{googlePlaceId}/snapshot`
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
- `GET /api/scenes/debug/queue`
- `GET /api/scenes/debug/failures`
- `GET /api/scenes/{sceneId}/diagnostics`

## 운영 메트릭

- `GET /api/metrics`
- Prometheus 스타일 텍스트 응답을 반환합니다.
- 운영용 경로이므로 일반 JSON envelope 대상이 아닙니다.

## 문서 원칙

- 모든 성공 응답은 공통 envelope를 사용합니다.
- 모든 에러 응답은 `ok`, `status`, `error`, `meta` 필드를 가집니다.
- `meta.requestId`, `meta.timestamp`는 항상 존재해야 합니다.
- enum 문서는 `timeOfDay`, `weather`, `placeType`를 기준으로 노출합니다.
- FE 전달 기준 원본 문서는 [`api.md`](/Users/user/wormapb/api.md) 입니다.

## 구현 위치

- Swagger 설정: [`src/docs/setup/swagger.setup.ts`](/Users/user/wormapb/src/docs/setup/swagger.setup.ts)
- Swagger 공통 DTO: [`src/docs/common/swagger.common.dto.ts`](/Users/user/wormapb/src/docs/common/swagger.common.dto.ts)
- Swagger scene DTO: [`src/docs/scene/swagger.scene.dto.ts`](/Users/user/wormapb/src/docs/scene/swagger.scene.dto.ts)
- Swagger places DTO: [`src/docs/places/swagger.places.dto.ts`](/Users/user/wormapb/src/docs/places/swagger.places.dto.ts)
- Swagger 외부 DTO: [`src/docs/external/swagger.external.dto.ts`](/Users/user/wormapb/src/docs/external/swagger.external.dto.ts)
- 공통 envelope 데코레이터: [`src/docs/decorators/swagger.decorators.ts`](/Users/user/wormapb/src/docs/decorators/swagger.decorators.ts)
- 부트스트랩 연결: [`src/main.ts`](/Users/user/wormapb/src/main.ts)

## 실행

```bash
bun run start:dev
```

이후 `/docs`에서 UI 문서를 확인할 수 있습니다.

## 주의사항

- 현재 Swagger는 응답 스키마와 주요 query/path parameter를 문서화합니다.
- 외부 API 헤더 자체는 서버 내부 구현이므로 Swagger 요청 파라미터로 노출하지 않습니다.
- Scene traffic/weather/places 엔드포인트는 `scene-meta.json` 기반 FE 바인딩용 계약으로 추가되었습니다.
- Scene detail 엔드포인트는 `scene-detail.json` 기반 시각 디테일 계층 계약입니다.
- Scene bootstrap에는 `glbSources`가 포함되며, 현재 weather/traffic는 bake되지 않고 live overlay로만 제공됩니다.
