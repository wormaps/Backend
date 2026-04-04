# 디지털 트윈 BE Phase 문서

## 목표

MVP 단계에서는 4개의 외부 API를 모두 하나의 3D 자산 파일에 넣는 것이 아니라,
정적인 공간 구조는 우선 `scene-meta.json`으로 만들고,
동적으로 변하는 데이터는 별도의 API 응답으로 제공하는 구조를 사용한다.

* 정적 구조 → `scene-meta.json`
* 실시간 상태 → JSON API
* 최종 렌더링 및 상태 반영 → FE Engine

---

# Phase 1. 장소 결정 및 Scene 생성 기준 확보

## 목적

사용자가 입력한 장소를 기준으로 Scene의 중심점과 범위를 결정한다.

## 사용 API

* Google Places API

## 입력

* 장소명
* placeId
* 좌표

예시:

```json
{
  "query": "Seoul City Hall"
}
```

## 처리

1. Google Places로 장소 검색
2. placeId, 중심 좌표(lat/lng), viewport 확보
3. 내부 sceneId 생성
4. Scene 중심 좌표와 반경(radius) 결정

## 출력

```json
{
  "sceneId": "scene_seoul_cityhall",
  "placeId": "google_place_id",
  "center": {
    "lat": 37.5665,
    "lng": 126.9780
  },
  "radiusM": 600
}
```

## 권장 범위

* small: 300m
* medium: 600m
* large: 1000m

MVP에서는 medium(600m) 정도를 기본값으로 사용한다.

---

# Phase 2. 공간 데이터 수집

## 목적

Scene 범위 안의 건물, 도로, 인도, POI 데이터를 수집한다.

## 사용 API

* OpenStreetMap + Overpass API

## 수집 대상

* 건물
* 도로
* 인도
* 공원
* 주요 POI

## 주요 태그

* building=* → 건물
* highway=* → 도로
* highway=footway / path → 인도
* amenity=* → 시설
* shop=* → 상점
* tourism=* → 관광지

## 처리

1. radius 기준 bbox 계산
2. Overpass API 호출
3. building, road, footway, poi 데이터 수집
4. 내부 Geometry 형태로 변환

## 내부 구조 예시

```ts
interface SceneGeometry {
  buildings: BuildingFootprint[]
  roads: RoadLine[]
  footways: FootwayLine[]
  pois: PoiPoint[]
}
```

---

# Phase 3. Geometry 정리 및 Mesh 생성

## 목적

OSM 데이터를 실제 3D 메시로 변환 가능한 형태로 정리한다.

## 처리

### Building

* polygon 추출
* extrusion 적용
* 높이 계산

높이 우선순위:

1. height
2. building:levels
3. 기본 높이 fallback

예시:

* 소형 건물: 8m
* 일반 건물: 15m
* 고층 건물: 40m

### Road

* centerline 기반 strip mesh 생성
* 도로 타입별 width 적용

예시:

* primary: 12m
* secondary: 8m
* residential: 5m
* footway: 2m

### Footway

* 얇은 plane mesh 생성
* 도로보다 밝은 머티리얼 사용

### POI

* 실제 mesh 대신 anchor point 생성
* FE에서 아이콘/마커로 표현

---

# Phase 4. Scene Meta 생성

## 목적

정적인 공간 구조를 FE가 바로 사용할 수 있는 `scene-meta.json` 형태로 생성한다.

## 포함 대상

* Scene origin / bounds
* 건물 목록
* 도로 목록
* 보행로 목록
* 주요 landmark / POI
* objectId metadata

## 포함하지 않는 대상

* 실시간 교통 흐름
* 날씨 상태
* Places 상세정보
* 운영시간
* 혼잡도
* 최종 mesh binary 자산

## MVP 출력 형태

MVP 1차에서는 `.glb`를 생성하지 않는다.

우선 아래 산출물을 만든다.

* `scene-meta.json`
* `bootstrap.json` 또는 bootstrap API 응답
* live API와 연결 가능한 `objectId` 목록

`.glb` 생성은 geometry 정규화 규칙과 FE 바인딩 규격이 안정화된 뒤 후속 단계로 미룬다.

## 권장 스타일

애니메이션풍보다는 lowpoly + data visualization 스타일 사용

### 이유

* 자동 생성 mesh와 잘 맞음
* 교통/날씨 overlay 적용이 쉬움
* 렌더 비용이 낮음
* MVP 속도에 유리함

## 권장 머티리얼

* 건물: 중성 회색
* 도로: 어두운 회색
* 보행로: 밝은 회색
* 주요 POI: emissive point
* 녹지: 단순 녹색 plane

## Metadata 예시

```json
{
  "objectId": "building_123",
  "osmId": "way_9988",
  "type": "building",
  "placeId": "google_place_id"
}
```

---

# Phase 5. Scene 데이터 저장

## 목적

생성된 Scene 메타데이터를 저장하고 FE에서 접근 가능한 URL 또는 조회 경로를 제공한다.

## 저장 위치

* 로컬 파일 저장 또는 DB
* 필요 시 S3 / CloudFront

## 역할

### 1차 MVP

* `scene-meta.json` 저장
* bootstrap 응답에 필요한 scene 정보 저장
* live API 조회를 위한 scene / poi / road 매핑 저장

### 후속 확장

* `.glb` 저장
* texture 저장
* scene manifest 저장
* CDN 캐싱

## 저장 예시

```txt
/scenes/scene_seoul_cityhall/manifest.json
/scenes/scene_seoul_cityhall/scene-meta.json
/scenes/scene_seoul_cityhall/pois.json
```

---

# Phase 6. 실시간 상태 API 제공

## 목적

실시간 교통, 날씨, 장소 정보를 FE에 제공한다.

## 사용 API

* Open-Meteo Historical Weather API
* TomTom Traffic API
* Google Places Details API

## 제공 Endpoint

```txt
GET /scenes/:sceneId/bootstrap
GET /scenes/:sceneId/weather
GET /scenes/:sceneId/traffic
GET /scenes/:sceneId/places
```

## Weather 역할

* 하늘 색상
* 조명 세기
* 안개
* 비/눈 파티클
* 노면 반사

## Traffic 역할

* 도로 색상 변경
* congestion score 계산
* 혼잡도 표시
* 도로 pulse 애니메이션

예시:

```ts
congestionScore = 1 - currentSpeed / freeFlowSpeed
```

혼잡도 기준:

* 0.0 ~ 0.2 → green
* 0.2 ~ 0.5 → yellow
* 0.5 ~ 0.8 → orange
* 0.8 이상 → red

---

# Phase 7. FE 연동

## 목적

FE Engine이 `scene-meta.json`과 실시간 상태를 조합해 최종 Scene을 렌더링한다.

## FE 흐름

1. Scene bootstrap 호출
2. metaUrl 수신
3. `scene-meta.json` 로드
4. weather/traffic/places API 병렬 호출
5. metadata id와 상태값 매핑
6. 도로 색상, 날씨 효과, POI 마커 반영

## Bootstrap 응답 예시

```json
{
  "sceneId": "scene_seoul_cityhall",
  "metaUrl": "https://cdn.example.com/scenes/scene_seoul_cityhall/scene-meta.json",
  "liveEndpoints": {
    "weather": "/scenes/scene_seoul_cityhall/weather",
    "traffic": "/scenes/scene_seoul_cityhall/traffic",
    "places": "/scenes/scene_seoul_cityhall/places"
  }
}
```

---

# Phase 8. 추후 확장

## 이후 고려 가능

* 차량 이동 애니메이션
* 군중 시뮬레이션
* 시간대 변화
* 실시간 이벤트
* CCTV/센서 연동
* CesiumJS
* 3D Tiles
* 대규모 도시 단위 Scene

## CesiumJS 재검토 시점

* Scene 범위가 1km 이상으로 커짐
* 도시 단위 지형 필요
* 정밀 좌표계 필요
* 지형/위성/LOD 스트리밍 필요
* `.glb` 단일 Scene 구조가 한계에 도달함

현재 MVP 단계에서는 Three.js 기반 단일 Scene 구조를 유지한다.

---

# BE MVP 설계

## 1. MVP 목표

BE MVP의 목표는 아래 3가지를 동시에 만족하는 것이다.

1. 사용자가 입력한 장소를 기준으로 Scene을 생성할 수 있어야 한다.
2. 정적인 공간 구조를 `scene-meta.json`으로 생성할 수 있어야 한다.
3. FE가 교통, 날씨, 장소 정보를 동적으로 덧입힐 수 있도록 bootstrap/live API를 제공해야 한다.

즉 MVP는 **"Scene metadata 생성기 + 상태 제공 서버"** 로 정의한다.

---

## 2. MVP 범위

### 포함

* Google Places 기반 장소 검색 및 중심 좌표 결정
* Overpass 기반 건물/도로/보행로/POI 수집
* `scene-meta.json` 생성
* scene 저장
* Scene bootstrap API
* Traffic API
* Weather API
* Places overlay API

### 제외

* 정적 Scene `.glb` 생성
* S3 / CloudFront 업로드
* 차량 이동 시뮬레이션
* 실시간 WebSocket
* CesiumJS
* 3D Tiles
* 도시 단위 타일 스트리밍
* 포토리얼리스틱 재질
* 복잡한 애니메이션 연출

---

## 3. 시스템 역할 정의

### BE

* 외부 API 호출
* 공간 데이터 정규화
* Scene metadata 생성
* scene 저장
* bootstrap/live API 제공
* 캐시 관리

### FE

* `scene-meta.json` 해석
* objectId와 live 상태 바인딩
* 교통/날씨/POI 상태 반영
* Scene 렌더링

---

## 4. NestJS 모듈 구조

```txt
src/
  app.module.ts
  common/
    config/
    logger/
    errors/
  scene/
    scene.module.ts
    controllers/
      scene.controller.ts
    application/
      create-scene.usecase.ts
      get-bootstrap.usecase.ts
      get-scene-status.usecase.ts
    domain/
      entities/
      dto/
      types/
    infrastructure/
      repositories/
      storage/
      generators/
      mappers/
  providers/
    providers.module.ts
    google-places/
      google-places.client.ts
    overpass/
      overpass.client.ts
    open-meteo/
      open-meteo.client.ts
    tomtom/
      tomtom.client.ts
  cache/
    cache.module.ts
  database/
    database.module.ts
```

NestJS는 controller, provider, module 기반으로 구조를 나누는 것이 기본 개념이고, provider는 의존성 주입 단위로 관리된다. ([docs.nestjs.com](https://docs.nestjs.com/?utm_source=chatgpt.com))

---

## 5. 핵심 엔티티

### Scene

```ts
interface SceneEntity {
  sceneId: string
  placeId: string
  name: string
  centerLat: number
  centerLng: number
  radiusM: number
  status: 'pending' | 'ready' | 'failed'
  metaUrl?: string
  createdAt: string
  updatedAt: string
}
```

### SceneMeta

```ts
interface SceneMeta {
  sceneId: string
  origin: {
    lat: number
    lng: number
  }
  bounds: {
    radiusM: number
  }
  roads: {
    objectId: string
    osmWayId: string
    type: string
  }[]
  buildings: {
    objectId: string
    osmWayId: string
    name?: string
  }[]
  pois: {
    poiId: string
    placeId?: string
    lat: number
    lng: number
    category?: string
  }[]
}
```

### BootstrapResponse

```ts
interface BootstrapResponse {
  sceneId: string
  metaUrl: string
  liveEndpoints: {
    traffic: string
    weather: string
    places: string
  }
}
```

---

## 6. 생성 파이프라인

### Step 1. 장소 검색

입력된 query를 Google Places로 검색해 중심 좌표와 placeId를 구한다.

입력:

```json
{
  "query": "Seoul City Hall"
}
```

출력:

```json
{
  "placeId": "google_place_id",
  "name": "Seoul City Hall",
  "lat": 37.5665,
  "lng": 126.9780
}
```

### Step 2. Scene 범위 계산

입력 좌표를 기준으로 radius를 정하고 bbox를 계산한다.

기본 규칙:

* small: 300m
* medium: 600m
* large: 1000m

MVP 기본값은 `medium`으로 고정한다.

### Step 3. Overpass 수집

bbox 기준으로 건물, 도로, 보행로, POI를 조회한다.

수집 대상:

* building
* highway
* footway/path
* amenity/shop/tourism

### Step 4. Geometry 정규화

수집한 OSM 데이터를 FE 렌더에 맞게 정규화한다.

처리:

* polygon 닫힘 보정
* 중복 좌표 제거
* local origin 변환
* 도로 타입 정리
* 잘못된 shape 제거

### Step 5. Meta JSON 생성

FE가 objectId와 live 상태를 연결할 수 있도록 `scene-meta.json`을 생성한다.

### Step 6. Scene 저장

MVP 1차에서는 생성된 scene 결과를 DB 또는 로컬 파일로 저장한다.

저장 대상:

* `scene-meta.json`
* scene 기본 정보
* road / poi objectId 매핑

### Step 7. 후속 자산화

`.glb` 생성과 S3 업로드는 후속 단계에서 붙인다.

후속 단계에서는 아래를 추가한다.

* `base.glb`
* S3 업로드
* CloudFront asset URL 제공

---

## 7. API 설계

### 7-1. Scene 생성

`POST /scenes`

요청:

```json
{
  "query": "Seoul City Hall",
  "scale": "medium"
}
```

응답:

```json
{
  "sceneId": "scene_001",
  "status": "ready",
  "metaUrl": "https://cdn.example.com/scenes/scene_001/scene-meta.json"
}
```

### 7-2. Bootstrap 조회

`GET /scenes/:sceneId/bootstrap`

응답:

```json
{
  "sceneId": "scene_001",
  "metaUrl": "https://cdn.example.com/scenes/scene_001/scene-meta.json",
  "liveEndpoints": {
    "traffic": "/scenes/scene_001/traffic",
    "weather": "/scenes/scene_001/weather",
    "places": "/scenes/scene_001/places"
  }
}
```

### 7-3. Traffic 조회

`GET /scenes/:sceneId/traffic`

응답:

```json
{
  "updatedAt": "2026-04-04T13:00:00Z",
  "segments": [
    {
      "objectId": "road_1",
      "currentSpeed": 11,
      "freeFlowSpeed": 17,
      "congestionScore": 0.35,
      "status": "slow"
    }
  ]
}
```

### 7-4. Weather 조회

`GET /scenes/:sceneId/weather`

응답:

```json
{
  "updatedAt": "2026-04-04T13:00:00Z",
  "weatherCode": 3,
  "temperature": 13.2,
  "preset": "cloudy"
}
```

### 7-5. Places Overlay 조회

`GET /scenes/:sceneId/places`

응답:

```json
{
  "pois": [
    {
      "poiId": "poi_1",
      "name": "Cafe Example",
      "category": "cafe",
      "lat": 37.5666,
      "lng": 126.9781
    }
  ]
}
```

---

## 8. 상태 흐름

### Scene 생성 시

1. FE가 `POST /scenes` 호출
2. BE가 Places 검색
3. BE가 bbox 계산
4. BE가 Overpass 수집
5. BE가 geometry 정규화
6. BE가 `scene-meta.json` 생성
7. BE가 scene 저장
8. ready 응답 반환

### Scene 렌더 시

1. FE가 `GET /scenes/:sceneId/bootstrap` 호출
2. FE가 `metaUrl` 수신
3. FE가 `scene-meta.json` 로드
4. FE가 traffic/weather/places 요청
5. FE가 objectId 기준으로 상태 매핑
6. FE가 색상/이펙트/마커 반영

---

## 9. 캐시 전략

### Scene Meta

* scene 생성 후 DB 또는 파일 저장
* 동일 query + 동일 scale 요청 시 기존 scene 재사용 가능

### Traffic

* TTL 1~3분
* 좌표별 짧은 캐시

### Weather

* TTL 5~10분

### Places

* placeId 중심 저장
* 상세정보는 필요할 때 재호출

---

## 10. DB 최소 스키마

### scenes

```sql
CREATE TABLE scenes (
  scene_id VARCHAR(100) PRIMARY KEY,
  place_id VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  center_lat DOUBLE PRECISION NOT NULL,
  center_lng DOUBLE PRECISION NOT NULL,
  radius_m INTEGER NOT NULL,
  status VARCHAR(20) NOT NULL,
  meta_url TEXT,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL
);
```

### scene_generation_logs

```sql
CREATE TABLE scene_generation_logs (
  id BIGSERIAL PRIMARY KEY,
  scene_id VARCHAR(100) NOT NULL,
  step VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL,
  message TEXT,
  created_at TIMESTAMP NOT NULL
);
```

---

## 11. MVP 기술 선택

### 서버

* NestJS
* TypeScript
* Bun 또는 Node 런타임

### 외부 API

* Google Places
* Overpass
* Open-Meteo
* TomTom

### 저장소

* PostgreSQL 또는 로컬 파일

### 후속 자산 생성

* `@gltf-transform/core`
* 커스텀 geometry builder
* S3
* CloudFront

### 캐시

* Redis

### DB

* PostgreSQL

---

## 12. 구현 우선순위

### P0

* `POST /scenes`
* Places 검색
* bbox 계산
* Overpass 수집
* geometry 정규화
* `scene-meta.json` 생성
* bootstrap API
* traffic API
* weather API
* places overlay API

### P1

* scene 재사용 전략
* Redis 캐시
* file/DB 저장 안정화

### P2

* `.glb` 생성
* S3 / CloudFront 업로드
* generation queue
* background worker 분리
* error retry

---

## 13. 이 MVP의 최종 정의

이 MVP는 아래처럼 정의한다.

**"사용자가 입력한 장소를 기준으로 Scene metadata를 생성하고, FE가 해당 metadata와 실시간 상태 API를 결합해 디지털 트윈 화면을 구성할 수 있도록 지원하는 BE 시스템"**

---

## 14. 핵심 판단

이 MVP 1차에서 핵심 자산은 `.glb`가 아니라,
**장소의 정적인 공간 골격을 설명하는 `scene-meta.json`** 이다.

동적으로 변하는 교통, 날씨, 장소 정보는 별도의 API로 분리하고,
FE가 이를 objectId 기반으로 장면에 반영하는 구조를 사용한다.

`.glb`는 geometry 정규화 규칙과 FE 바인딩 규격이 충분히 안정화된 뒤 붙인다.
이 순서가 현재 코드베이스와 구현 난이도 기준에서 더 현실적이다.
