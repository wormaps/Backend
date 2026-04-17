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

## 4. 실패 시 우선 확인

- 외부 API 키 누락
- `SCENE_DATA_DIR` writable 여부
- `readiness` 상태
- 최근 실패 이력: `/api/scenes/debug/failures`
