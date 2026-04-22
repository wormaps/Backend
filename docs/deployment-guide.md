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
- representative scene이 `READY`이고 `qualityGate=PASS`여도 `QA summary=WARN`이면 Phase 3 close는 별도 판단이 필요하다. 특히 `observed_coverage`가 baseline 대비 얼마나 증가했는지와 해당 증가폭의 정량 기준이 문서화됐는지까지 확인한다.
- CI baseline evidence는 `.github/workflows/ci.yml`의 `bun run type-check`, `bun run test`, `bun run build`와 Phase 3 회귀 테스트들로 확인한다.

## 4. 실패 시 우선 확인

- 외부 API 키 누락
- `SCENE_DATA_DIR` writable 여부
- `readiness` 상태
- 최근 실패 이력: `/api/scenes/debug/failures`
