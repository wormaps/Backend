# BE MVP Audit

기준 문서: [PRD.md](/Users/user/wormapb/PRD.md)

## 요약

현재 백엔드는 `장소 검색`, `scene 생성`, `scene-meta/detail`, `base.glb`, `weather live API`까지는 실제 실행 기준으로 동작한다. 이후 보완으로 `POI/land cover/linear feature의 glb 반영`, `scene live state 계약`, `bootstrap render contract`, `places overlay 확장`, `오늘 날짜 기준 current weather 우선 사용`, `traffic best-effort/degraded 응답`이 추가되었다. 다만 TomTom의 업스트림 품질 자체는 코드로 완전히 해결할 수 없으므로, 운영 기준의 실응답 안정성은 계속 확인이 필요하다.

## 최신 실행 결과

- 실행 시각
  - `2026-04-05T15:39:34.158Z`
- audit 명령
  - `set -a; source .env >/dev/null 2>&1; npm run audit:mvp`
- 실측 결과 요약
  - Google Places 검색 성공
  - Shibuya scene 생성 성공
  - `.json`, `.meta.json`, `.detail.json`, `.glb` 생성 성공
  - weather 응답 성공
  - traffic 응답 성공
    - `degraded=true`
    - `failedSegmentCount=716`
  - glb node category
    - 포함: building, road, crosswalk, walkway, streetFurniture, vegetation, poi, landCover, linearFeature, billboard

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
| traffic live API | 완료 | endpoint는 degraded 모드와 host fallback을 지원하고, 실 audit에서도 응답 성공 |
| weather live API | 완료 | 오늘 날짜는 current weather 우선, 과거 날짜는 historical 사용 |
| scene 산출물 일관성 | 완료 | `.json`, `.meta.json`, `.detail.json`, `.glb`, bootstrap 계약 확인 |
| FE 최소 소비 계약 | 완료 | `assetUrl`, `metaUrl`, `detailUrl`, `liveEndpoints`, `camera`, `objectId`, `renderContract` 존재 |
| crowd/lighting/timeOfDay/surface scene 연결 | 완료 | `/api/scenes/:sceneId/state` 추가 |
| glb의 MVP 요소 반영 | 완료 | `POI`, `land cover`, `linear feature` 최소 geometry 반영 |
| meta/detail 대비 glb 누락 요소 | 완료 | bootstrap render contract와 glb coverage 계약 추가 |

## Priority

### P0

- `.glb`에 PRD MVP 정적 요소를 충분히 반영하지 못하는 문제
  - POI가 meta에는 존재하지만 glb geometry에는 없음
  - land cover / railway / bridge / linear feature가 detail에는 있으나 glb에 없음
- scene live 계약에 crowd/lighting/timeOfDay/surface가 없는 문제

### P1

- `places` endpoint 확장과 bootstrap `renderContract` 추가로 FE 계약은 보강됨
- 남은 P1은 실연동 품질 확인에 가깝고, 특히 traffic endpoint의 운영 안정성 확인이 더 필요

### P2

- weather source가 `OPEN_METEO_CURRENT` 또는 `OPEN_METEO_HISTORICAL`로 분기되도록 보완됨
- traffic은 `LIVE_BEST_EFFORT` 모드와 host fallback으로 보완됨
- Mapillary는 실제 사용되지만 이미지 수가 0이어도 feature만으로 FULL이 나올 수 있어 품질 해석 주의 필요
- TomTom 업스트림이 특정 시점에 불안정할 수 있으므로 실 audit는 계속 필요

### P3

- facade/signage/material 품질 개선 반영
- roof accent mesh와 tone별 billboard/facade panel 반영

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
- bootstrap에 `renderContract.glbCoverage / overlaySources / liveDataModes` 추가
- `places` endpoint에 `landmarks / categories` 추가
- README/API 문서에 weather가 현재는 historical 기반임을 명시

## 검증 시나리오

- 검색 성공/실패
- scene 생성 성공/실패
- 산출물 파일 존재
- bootstrap/meta/detail/live API 응답 일관성
- glb node category 검사
- meta/detail에는 있고 glb에는 없는 범주 검사

## 현재 판정

- MVP 백엔드는 `완료`
- 이유:
  - 검색/scene generation/bootstrap/meta/detail/glb/live API가 실 audit에서 모두 동작
  - PRD MVP 기준의 정적 glb 범위와 scene live 상태 범위가 충족됨
  - 남은 이슈는 운영 품질과 추가 고도화 성격이며 MVP 충족 자체를 막지는 않음
