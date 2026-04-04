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
- `GET /api/scenes/{sceneId}/bootstrap`
- `GET /api/scenes/{sceneId}/traffic`
- `GET /api/scenes/{sceneId}/weather`
- `GET /api/scenes/{sceneId}/places`

## 문서 원칙

- 모든 성공 응답은 공통 envelope를 사용합니다.
- 모든 에러 응답은 `ok`, `status`, `error`, `meta` 필드를 가집니다.
- `meta.requestId`, `meta.timestamp`는 항상 존재해야 합니다.
- enum 문서는 `timeOfDay`, `weather`, `placeType`를 기준으로 노출합니다.
- FE 전달 기준 원본 문서는 [`api.md`](/Users/user/wormapb/api.md) 입니다.

## 구현 위치

- Swagger 설정: [`src/docs/swagger.setup.ts`](/Users/user/wormapb/src/docs/swagger.setup.ts)
- Swagger DTO: [`src/docs/swagger.dto.ts`](/Users/user/wormapb/src/docs/swagger.dto.ts)
- 공통 envelope 데코레이터: [`src/docs/swagger.decorators.ts`](/Users/user/wormapb/src/docs/swagger.decorators.ts)
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
