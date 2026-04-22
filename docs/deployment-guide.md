# Deployment Guide

이 문서는 현재 WorMap 백엔드의 배포 전 체크리스트를 정리한다.

## 1. 배포 전 확인

- `bun run type-check`
- `bun test`
- `bun run bench:scene`는 필요 시 별도 실행
- 환경 변수 확인
  - `GOOGLE_API_KEY`
  - `TOMTOM_API_KEY`
  - `MAPILLARY_ACCESS_TOKEN`
  - `OVERPASS_API_URLS`
  - `INTERNAL_API_KEY`

## 2. 런타임 명령

- 개발: `bun run start:dev`
- 프로덕션: `bun run start:prod`

## 3. 배포 고려사항

- `Scene` 데이터는 로컬 파일 저장소를 사용하므로 배포 환경의 writable storage가 필요하다.
- health readiness는 외부 API 연결 상태에 의존한다.
- bench 실행은 실제 외부 API 설정 상태에 따라 수치가 달라진다.
- **필수 환경 변수**: `GOOGLE_API_KEY`, `OVERPASS_API_URLS`가 설정되지 않으면 `/api/health`가 503을 반환한다. Kubernetes readiness probe가 이를 사용하므로 배포 전 반드시 확인한다.
- Phase 3 이후에는 representative smoke에서 TEXCOORD preflight / glTF validator / QA reject 여부를 함께 확인해야 한다.
- representative scene이 `QA_REJECTED` 이면 asset build가 성공했더라도 Visual Gate는 통과한 것으로 보지 않는다.
- representative scene이 `READY`이고 `qualityGate=PASS`, `QA summary=WARN`인 경우에도 Phase 3 close는 가능하다. 이때 Visual Gate는 representative `observedAppearanceCoverage >= 0.05`, baseline 대비 5배 이상 증가, representative landmark/highrise scene의 `fallbackMassingRate = 0` 기준으로 판단한다.
- CI baseline evidence는 `.github/workflows/ci.yml`의 `bun run type-check`, `bun run test`, `bun run build`와 Phase 3 회귀 테스트들로 확인한다.
- Phase 4 이후에는 Geography Gate 기준으로 다음을 함께 확인해야 한다:
  - meter-based interpolation 유지
  - terrain mode가 diagnostics와 contract에 명시됨
  - high latitude / invalid polygon / no DEM fixture 테스트 통과
- terrain fallback이 발생하면 `GET /api/scenes/{sceneId}/diagnostics`와 diagnostics log에서 `FLAT_PLACEHOLDER` 여부를 먼저 확인한다.

## 4. 실패 시 우선 확인

- 외부 API 키 누락
- `SCENE_DATA_DIR` writable 여부
- `readiness` 상태
- 최근 실패 이력: `/api/scenes/debug/failures`
