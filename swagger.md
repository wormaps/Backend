# WorMap Swagger 운영 문서

## 목적

이 문서는 WorMap 백엔드의 Swagger/OpenAPI 운영 기준을 정리합니다.
현재 코드베이스에는 Swagger 라이브러리를 아직 붙이지 않았고, 우선 `api.md`를 기준 명세로 사용합니다.

이렇게 둔 이유는 다음과 같습니다.

- 먼저 응답 규약과 도메인 스키마를 안정화해야 합니다.
- 현재 MVP는 외부 API 키 없이도 테스트 가능한 구조가 우선입니다.
- Swagger는 다음 단계에서 DTO와 데코레이터를 붙이며 자동화하는 편이 안전합니다.

## 현재 반영된 API 범위

- `GET /api/health`
- `GET /api/places`
- `GET /api/places/search`
- `GET /api/places/{placeId}`
- `GET /api/places/{placeId}/package`
- `GET /api/places/{placeId}/snapshot`
- `GET /api/places/google/{googlePlaceId}`
- `GET /api/places/google/{googlePlaceId}/package`
- `GET /api/places/google/{googlePlaceId}/snapshot`

## Swagger 반영 예정 규칙

Swagger를 붙일 때 아래 기준을 그대로 유지해야 합니다.

### 1. Base Path

- 모든 엔드포인트 prefix는 `/api`

### 2. 공통 응답 포맷

모든 API는 아래 envelope를 기준으로 문서화합니다.

#### Success

```json
{
  "ok": true,
  "status": 200,
  "message": "요청 성공 메시지",
  "data": {},
  "meta": {
    "requestId": "req_xxx",
    "timestamp": "2026-03-05T08:40:21Z"
  }
}
```

#### Error

```json
{
  "ok": false,
  "status": 400,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "요청 데이터 검증 실패",
    "detail": null
  },
  "meta": {
    "requestId": "req_xxx",
    "timestamp": "2026-03-05T08:40:21Z"
  }
}
```

### 3. Enum 문서화 규칙

- `timeOfDay`
  - `DAY`
  - `EVENING`
  - `NIGHT`
- `weather`
  - `CLEAR`
  - `CLOUDY`
  - `RAIN`
  - `SNOW`
- `placeType`
  - `CROSSING`
  - `SQUARE`
  - `STATION`
  - `PLAZA`

### 4. 에러 코드 문서화 규칙

최소 아래 에러 코드는 Swagger 예시에 반드시 들어가야 합니다.

- `PLACE_NOT_FOUND`
- `INVALID_PLACE_ID`
- `INVALID_TIME_OF_DAY`
- `INVALID_WEATHER`
- `INVALID_QUERY`
- `INVALID_LIMIT`
- `INVALID_DATE`
- `EXTERNAL_API_NOT_CONFIGURED`
- `EXTERNAL_API_REQUEST_FAILED`
- `GOOGLE_PLACE_NOT_FOUND`
- `INTERNAL_SERVER_ERROR`

## Swagger 적용 작업 순서

1. `@nestjs/swagger` 도입
2. 공통 response DTO 추가
3. places/health DTO 분리
4. Controller에 `@ApiOperation`, `@ApiResponse`, `@ApiQuery`, `@ApiParam` 반영
5. `/docs` 또는 `/swagger` 경로 오픈
6. `api.md`와 Swagger 스키마 차이 검증

## 구현 시 주의사항

- Swagger 예시와 실제 응답 JSON이 달라지면 안 됩니다.
- `meta.requestId`, `meta.timestamp`는 문서에서 optional로 두면 안 됩니다.
- 에러 응답의 `error.detail` 구조는 상황별로 달라도 되지만, 필드 자체는 항상 존재해야 합니다.
- 프론트 전달 기준 문서는 `api.md`를 원본으로 보고, Swagger는 이를 자동화한 결과물이어야 합니다.
- Google Places New는 `X-Goog-Api-Key`, `X-Goog-FieldMask` 헤더를 사용한다는 점을 Swagger 예시에 반영해야 합니다.
- Overpass API는 `POST https://overpass-api.de/api/interpreter` 형태라는 점을 구현 노트에 남겨야 합니다.
- TomTom Flow Segment는 현재 코드에 클라이언트만 있으며, 기본 엔드포인트에는 아직 노출하지 않았습니다.
