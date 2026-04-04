# WorMap API 명세서

## BE 스택

<aside>

BE 스택은 다음 기준으로 개발합니다.

- NestJS
  - 백엔드 API 처리 로직과 응답 규약을 담당합니다.
- Supabase PostgreSQL
  - 메인 DB 예정입니다. 현재 MVP 구현은 인메모리 fixture 기반이며, 이후 영속 저장소로 대체할 수 있도록 계층을 분리했습니다.
- Upstash Redis
  - 선택 사항입니다. Place Package / Scene Snapshot 캐싱 최적화 지점으로 고려합니다.
- AWS
  - 추후 배포/호스팅 대상입니다.

</aside>

# API OverView

<aside>

## BaseURL

```text
dev
http://localhost:3000

Base API Prefix
{BaseURL}/api
```

- Date / Time 포맷은 ISO 8601 UTC를 사용합니다.
  - 예시: `2026-03-05T08:40:21Z`
- 현재 MVP에는 파일 업로드 API가 없습니다.
- CORS 허용 도메인은 아직 코드에 반영하지 않았습니다.
  - `localhost:3000`
  - `127.0.0.1:3000`
  - 프론트 환경 확정 후 반영 필요

## API Rule

```text
모든 API는 다음 규칙을 따릅니다.
{BaseURL}/api/{resource}

예시
GET /api/places
GET /api/places/{placeId}
GET /api/places/{placeId}/package
GET /api/places/{placeId}/snapshot
```

## Response 구조

모든 응답은 공통 envelope를 사용합니다.

### Success Response

| Field | Type | 설명 |
| --- | --- | --- |
| ok | boolean | 요청 성공 여부 |
| status | number | HTTP 상태 코드 |
| message | string | 요청 결과 메시지 |
| data | object \| array | 응답 데이터 |
| meta.requestId | string | 요청 추적 ID |
| meta.timestamp | string | 응답 생성 시각(UTC) |

### Success Response Example

```json
{
  "ok": true,
  "status": 200,
  "message": "Request successful",
  "data": {},
  "meta": {
    "requestId": "req_01HQX8M3F",
    "timestamp": "2026-03-05T08:40:21Z"
  }
}
```

### Error Response

| Field | Type | 설명 |
| --- | --- | --- |
| ok | boolean | 요청 성공 여부 |
| status | number | HTTP 상태 코드 |
| error.code | string | 에러 식별 코드 |
| error.message | string | 에러 설명 |
| error.detail | object \| null | 추가적인 에러 정보 |
| meta.requestId | string | 요청 추적 ID |
| meta.timestamp | string | 응답 생성 시각(UTC) |

### Error Response Example

```json
{
  "ok": false,
  "status": 404,
  "error": {
    "code": "PLACE_NOT_FOUND",
    "message": "장소를 찾을 수 없습니다.",
    "detail": {
      "placeId": "unknown-place"
    }
  },
  "meta": {
    "requestId": "req_01HQX8M3F",
    "timestamp": "2026-03-05T08:40:21Z"
  }
}
```

</aside>

# Error Codes

## Common Error Codes

| Code | HTTP | 설명 |
| --- | --- | --- |
| INVALID_REQUEST | 400 | 잘못된 요청 |
| VALIDATION_ERROR | 400 | 요청 데이터 검증 실패 |
| RESOURCE_NOT_FOUND | 404 | 리소스를 찾을 수 없음 |
| INTERNAL_SERVER_ERROR | 500 | 서버 내부 오류 |
| PLACE_NOT_FOUND | 404 | placeId에 해당하는 장소를 찾을 수 없음 |
| INVALID_PLACE_ID | 400 | placeId 형식이 잘못됨 |
| INVALID_TIME_OF_DAY | 400 | 지원하지 않는 시간대 값 |
| INVALID_WEATHER | 400 | 지원하지 않는 날씨 값 |

# Domain Schemas

## RegistryInfo

```json
{
  "id": "gangnam-station",
  "slug": "gangnam-station",
  "name": "Gangnam Station",
  "country": "South Korea",
  "city": "Seoul",
  "location": {
    "lat": 37.4979,
    "lng": 127.0276
  },
  "placeType": "STATION",
  "tags": ["transit", "commercial", "commute"]
}
```

## PlaceDetail

```json
{
  "registry": {
    "id": "gangnam-station",
    "slug": "gangnam-station",
    "name": "Gangnam Station",
    "country": "South Korea",
    "city": "Seoul",
    "location": {
      "lat": 37.4979,
      "lng": 127.0276
    },
    "placeType": "STATION",
    "tags": ["transit", "commercial", "commute"]
  },
  "packageSummary": {
    "version": "2026.04-mvp",
    "generatedAt": "2026-04-04T00:00:00Z",
    "buildingCount": 1,
    "roadCount": 1,
    "walkwayCount": 1,
    "poiCount": 2
  },
  "supportedTimeOfDay": ["DAY", "EVENING", "NIGHT"],
  "supportedWeather": ["CLEAR", "CLOUDY", "RAIN", "SNOW"]
}
```

## PlacePackage

```json
{
  "placeId": "gangnam-station",
  "version": "2026.04-mvp",
  "generatedAt": "2026-04-04T00:00:00Z",
  "camera": {
    "topView": { "x": 0, "y": 170, "z": 130 },
    "walkViewStart": { "x": 10, "y": 1.7, "z": 18 }
  },
  "bounds": {
    "northEast": { "lat": 37.4985, "lng": 127.0285 },
    "southWest": { "lat": 37.4972, "lng": 127.0267 }
  },
  "buildings": [],
  "roads": [],
  "walkways": [],
  "pois": [],
  "landmarks": []
}
```

`PlacePackage`는 FE 렌더링 입력용 구조입니다.

- `camera.topView`: 기본 탑뷰 카메라 포지션
- `camera.walkViewStart`: 워크뷰 시작 포지션
- `bounds`: Scene 로딩 범위
- `buildings`, `roads`, `walkways`, `pois`, `landmarks`: MVP 고정 구조물 데이터

## SceneSnapshot

```json
{
  "placeId": "gangnam-station",
  "timeOfDay": "NIGHT",
  "weather": "SNOW",
  "generatedAt": "2026-04-04T08:40:21Z",
  "source": "MVP_SYNTHETIC_RULES",
  "crowd": {
    "level": "LOW",
    "count": 74
  },
  "vehicles": {
    "level": "LOW",
    "count": 28
  },
  "lighting": {
    "ambient": "DIM",
    "neon": true,
    "buildingLights": true,
    "vehicleLights": true
  },
  "surface": {
    "wetRoad": false,
    "puddles": false,
    "snowCover": true
  },
  "playback": {
    "recommendedSpeed": 1,
    "pedestrianAnimationRate": 0.85,
    "vehicleAnimationRate": 0.7
  }
}
```

`SceneSnapshot`은 현재 MVP에서 외부 실시간 API를 직접 호출하지 않고 규칙 기반으로 생성합니다.

- `source: MVP_SYNTHETIC_RULES`
- 추후 외부 API 연동 시 `source` 값과 `detail` 스키마 확장 예정

# API

## 1. 헬스 체크

### `GET /api/health`

서버 기본 상태를 확인합니다.

### Response

```json
{
  "ok": true,
  "status": 200,
  "message": "서비스 상태가 정상입니다.",
  "data": {
    "service": "wormapb",
    "uptimeSeconds": 120
  },
  "meta": {
    "requestId": "req_01HQX8M3F",
    "timestamp": "2026-03-05T08:40:21Z"
  }
}
```

## 2. 장소 목록 조회

### `GET /api/places`

지원하는 장소 목록을 조회합니다.

### Response

`data`는 `RegistryInfo[]` 입니다.

## 3. 장소 상세 조회

### `GET /api/places/{placeId}`

### Path Parameter

| Field | Type | 설명 |
| --- | --- | --- |
| placeId | string | 장소 식별자 |

### Response

`data`는 `PlaceDetail` 입니다.

## 4. Place Package 조회

### `GET /api/places/{placeId}/package`

FE 렌더링에 필요한 구조 데이터를 조회합니다.

### Response

`data`는 `PlacePackage` 입니다.

## 5. Scene Snapshot 조회

### `GET /api/places/{placeId}/snapshot`

선택한 시간대/날씨 기준 장면 상태를 생성합니다.

### Query Parameter

| Field | Type | Required | 설명 |
| --- | --- | --- | --- |
| timeOfDay | string | N | `DAY`, `EVENING`, `NIGHT` |
| weather | string | N | `CLEAR`, `CLOUDY`, `RAIN`, `SNOW` |

### Default Rule

- `timeOfDay` 미입력 시 `DAY`
- `weather` 미입력 시 `CLEAR`

### Response

`data`는 `SceneSnapshot` 입니다.

### Error Example

```json
{
  "ok": false,
  "status": 400,
  "error": {
    "code": "INVALID_TIME_OF_DAY",
    "message": "timeOfDay 값이 올바르지 않습니다.",
    "detail": {
      "field": "timeOfDay",
      "allowedValues": ["DAY", "EVENING", "NIGHT"],
      "received": "dawn"
    }
  },
  "meta": {
    "requestId": "req_01HQX8M3F",
    "timestamp": "2026-03-05T08:40:21Z"
  }
}
```

# 향후 확장 포인트

- Google Places API 기반 장소 검색
- OpenStreetMap + Overpass 기반 Place Package 자동 생성
- Open-Meteo 기반 실제 날씨 반영
- TomTom Traffic 기반 차량 흐름 반영
- Supabase/PostgreSQL 영속화
- Upstash Redis 캐싱
