# BE MVP Audit

기준 문서: [PRD.md](/Users/user/wormapb/PRD.md)

## 요약

현재 백엔드는 `장소 검색`, `scene 생성`, `scene-meta/detail`, `base.glb`, `weather live API`까지는 실제 실행 기준으로 동작한다. 다만 PRD의 MVP 포함 항목 기준으로 보면 `POI의 glb 미반영`, `공원/철도/다리/linear feature의 glb 미반영`, `crowd/lighting/timeOfDay/surface의 scene live 계약 부재`, `현재 날씨 대신 historical weather 사용`, `TomTom traffic 실응답 불안정`이 남아 있다.

## 최신 실행 결과

- 실행 시각
  - `2026-04-05T15:00:54.146Z`
- audit 명령
  - `set -a; source .env >/dev/null 2>&1; npm run audit:mvp`
- 실측 결과 요약
  - Google Places 검색 성공
  - Shibuya scene 생성 성공
  - `.json`, `.meta.json`, `.detail.json`, `.glb` 생성 성공
  - weather 응답 성공
  - traffic 응답 실패
    - `TomTom Traffic Flow Segment 응답이 비정상입니다.`
  - glb node category
    - 포함: building, road, crosswalk, walkway, streetFurniture, vegetation, billboard
    - 미포함: poi, landCover, linearFeature

## 실행 기준

- 정적 검증
  - `npm run type-check`
  - `npm test -- --runInBand`
- 실연동 검증
  - `node -r ts-node/register/transpile-only scripts/debug-google-search.ts`
  - `node -r ts-node/register/transpile-only scripts/run-shibuya-scene.ts`
  - `node -r ts-node/register/transpile-only scripts/run-be-mvp-audit.ts`

## Checklist

| 항목 | 상태 | 근거 |
| --- | --- | --- |
| 장소 검색 | 완료 | Google Places 실검색 성공 |
| Scene 생성 파이프라인 | 완료 | 검색 → detail → overpass → meta/detail → glb smoke 성공 |
| MVP 정적 요소 수집 | 완료 | 건물/도로/횡단보도/POI가 meta/detail에 존재 |
| traffic live API | 부분완료 | endpoint는 있으나 실 audit에서 TomTom 응답 비정상 |
| weather live API | 부분완료 | 동작은 하지만 현재 날씨가 아니라 archive historical 기반 |
| scene 산출물 일관성 | 완료 | `.json`, `.meta.json`, `.detail.json`, `.glb`, bootstrap 계약 확인 |
| FE 최소 소비 계약 | 완료 | `assetUrl`, `metaUrl`, `detailUrl`, `liveEndpoints`, `camera`, `objectId` 존재 |
| crowd/lighting/timeOfDay/surface scene 연결 | 미완료 | places snapshot에는 있으나 scene live endpoint로 연결되지 않음 |
| glb의 MVP 요소 반영 | 부분완료 | 건물/도로/횡단보도/보행로는 반영되지만 POI는 glb 미반영 |
| meta/detail 대비 glb 누락 요소 | 미완료 | land cover, linear feature, POI가 geometry로 거의 연결되지 않음 |

## Priority

### P0

- `.glb`에 PRD MVP 정적 요소를 충분히 반영하지 못하는 문제
  - POI가 meta에는 존재하지만 glb geometry에는 없음
  - land cover / railway / bridge / linear feature가 detail에는 있으나 glb에 없음
- scene live 계약에 crowd/lighting/timeOfDay/surface가 없는 문제

### P1

- FE는 liveEndpoints로 `traffic/weather/places`만 받으므로 PRD의 실시간 상태 경험을 완성할 수 없음
- `places` endpoint가 POI overlay만 반환해서 장소 상태 확장성이 낮음
- traffic endpoint는 존재하지만 실 audit 기준 TomTom 응답이 비정상이라 운영 안정성 확인이 더 필요

### P2

- weather가 `OPEN_METEO_HISTORICAL` 고정이라 “현재 날씨” 요구와 차이
- Mapillary는 실제 사용되지만 이미지 수가 0이어도 feature만으로 FULL이 나올 수 있어 품질 해석 주의 필요
- TomTom은 key는 존재하지만 특정 scene audit에서 정상 응답을 일관되게 주지 못함

### P3

- facade/signage/material 품질 개선
- 추가 시각 디테일 확장

## Phase

### Phase 1. 사실 확인

- `scripts/run-be-mvp-audit.ts` 기준으로 PRD 항목을 `PASS / PARTIAL / FAIL`로 판정
- 실행 결과 JSON을 보관하고, 문서 판정은 코드 존재가 아니라 실행 근거를 우선 사용

### Phase 2. 실행 검증

- 실검색 성공 여부 확인
- scene 생성 성공 여부 확인
- bootstrap/meta/detail/weather/traffic/places 응답 확인
- glb node name 기준으로 실제 포함 geometry 범주 확인

### Phase 3. 갭 분류

- `즉시 수정해야 하는 MVP 결함`
  - POI/land cover/linear feature glb 반영
  - crowd/lighting/timeOfDay/surface scene live 연결
- `FE 연동 전 보강할 계약 문제`
  - live endpoint shape 확장
  - places endpoint 확장 여부 결정
- `후속 버전으로 미뤄도 되는 확장`
  - facade realism, 더 정교한 signage/material

### Phase 4. 구현 순서

1. scene live 상태 API 확장
2. glb에 POI와 최소 land cover/linear feature 반영
3. bootstrap/live contract 문서화
4. 실제 audit script를 CI/ops smoke로 재사용

## 구현 작업 목록

### 1. Scene live 상태 확장

- `GET /api/scenes/{sceneId}/state` 또는 동등 endpoint 추가
- 최소 포함:
  - crowd
  - vehicles
  - timeOfDay
  - lighting
  - surface
- 기존 `places snapshot` 합성 로직을 scene 단위 object로 연결

### 2. glb 정적 범위 보강

- `POI`를 marker mesh 또는 anchor mesh로 glb에 포함
- `landCovers`는 park/plaza/water plane 수준으로 반영
- `linearFeatures`는 railway/bridge/waterway 중 최소 railway/bridge 우선 반영

### 3. 계약 보강

- bootstrap에 scene state endpoint 추가
- README/API 문서에 weather가 현재는 historical 기반임을 명시
- FE가 glb 미포함 요소를 meta/detail로 fallback 처리해야 하는 범주를 명시

## 검증 시나리오

- 검색 성공/실패
- scene 생성 성공/실패
- 산출물 파일 존재
- bootstrap/meta/detail/live API 응답 일관성
- glb node category 검사
- meta/detail에는 있고 glb에는 없는 범주 검사

## 현재 판정

- MVP 백엔드는 `부분 완료`
- 이유:
  - 검색/scene generation/bootstrap/weather는 실동작
  - traffic는 endpoint는 있으나 실 audit 기준 실패 사례가 존재
  - PRD MVP 기준의 정적 glb 범위와 scene live 상태 범위가 아직 부족
