# Phase 1 NestJS API Migration Plan

## 목표

- Bun `Bun.serve()` 기반 API 진입부를 NestJS(Express) 런타임으로 전환한다.
- 도메인 파이프라인(`appModule.services.osmSceneBuild.run`)은 그대로 유지한다.
- 기존 핵심 API 계약(`/health`, `/api`, `/api/build`, `/api/build/download`)을 유지한다.

## 범위

### 포함
- Nest 런타임 부트스트랩 추가
- Controller/Service 기반 API 진입부 이관
- 환경변수 검증 정책 분기(prod fail-fast, dev/test warn)
- 최소 e2e 수준 동작 확인

### 제외
- providers/normalization/twin/render/glb/build 내부 리팩터링
- 도메인 서비스의 Nest Provider 전환
- 다운로드 캐시 외부 저장소 이전

## 전제 조건

- 기존 테스트가 녹색이어야 함
- 현재 브랜치에서 타입체크 통과 상태

## 단계별 작업

- [ ] 1. Nest 의존성/스크립트 정비
  - `@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`, `reflect-metadata`, `rxjs` 추가
  - `package.json`의 실행 스크립트를 Nest 부트스트랩 진입 기준으로 조정
  - `tsconfig.json`에 데코레이터 메타데이터 옵션 검토/적용

- [ ] 2. Nest 앱 골격 생성
  - `src/main.ts`를 Nest bootstrap 엔트리로 전환
  - `src/http/app.module.ts`(Nest 모듈) 생성
  - 기존 `src/main.ts`의 `createWorMapMvpApp`는 테스트 의존성을 위해 `src/core/create-wormap-app.ts`로 분리

- [ ] 3. BuildGatewayService 작성
  - 기존 도메인 앱(`createWorMapMvpApp`) lazy singleton 초기화
  - `buildScene`, `getLatestGlb` 메서드 구현
  - 최신 GLB 메모리 캐시(`bytes`, `sceneId`)를 서비스 상태로 이동

- [ ] 4. BuildController 작성
  - `GET /health`
  - `GET /api`
  - `POST /api/build` (DTO + 입력 검증)
  - `GET /api/build/download`
  - 기존 응답 shape 유지, 예외 매핑(400/422/500)

- [ ] 5. 환경변수 검증 정책 분리
  - `validateProviderApiKeys`를 `strict`/`warn` 모드로 개선
  - `NODE_ENV=production`에서 strict
  - 그 외 환경에서 warn

- [ ] 6. 기존 Bun 라우팅 경로 제거/정리
  - `src/index.ts`의 `Bun.serve()` 제거 또는 레거시로 격리
  - 중복 엔트리 제거

- [ ] 7. 테스트/검증
  - `bun run type-check`
  - `bun test`
  - API 스모크 테스트(health/build/download)

- [ ] 8. 문서 업데이트
  - 실행 방법 업데이트(README 또는 deployment guide)
  - 변경된 엔트리포인트와 환경정책 기록

## 리스크 및 완화

1. 응답 포맷 미세 회귀
- 완화: 기존 JSON 키/상태코드 스냅샷 비교 테스트 추가

2. 테스트에서 `createWorMapMvpApp` 경로 깨짐
- 완화: 함수 위치 이동 시 re-export 유지

3. 환경변수 검증 타이밍 변화
- 완화: 모드 분기 테스트 케이스 추가

## 검증 체크리스트

- [ ] `GET /health` 200
- [ ] `GET /api` 문서 응답
- [ ] `POST /api/build` 성공 시 `status=completed` 또는 기존 실패 shape 유지
- [ ] `GET /api/build/download` 빌드 전 404, 빌드 후 200
- [ ] `bun run type-check` 통과
- [ ] `bun test` 통과

## 완료 기준

- NestJS(Express) 런타임에서 기존 API 4개 경로 정상 동작
- 도메인 파이프라인 결과 계약(`artifactHash`, `byteLength`, 다운로드)이 유지
- 환경변수 정책 분기가 요구사항과 일치
- 타입체크/테스트 녹색
