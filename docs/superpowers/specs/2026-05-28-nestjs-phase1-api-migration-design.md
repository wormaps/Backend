# NestJS Phase 1 API Migration Design (WorMap)

## 1. 목적

이 문서는 WorMap의 1차 NestJS 마이그레이션 범위를 정의한다.

1차 목표는 **API 진입부를 NestJS(Express 런타임)로 전환**하는 것이다.
도메인 파이프라인(정규화/그래프/렌더/GLB/QA)은 기존 구현을 유지한다.

## 2. 범위

### 포함

- 런타임을 Bun `Bun.serve()`에서 NestJS(Express)로 전환
- 기존 4개 엔드포인트 이관
  - `GET /health`
  - `GET /api`
  - `POST /api/build`
  - `GET /api/build/download`
- API 진입부용 Controller/Service 신설
- 환경변수 검증 정책 분기(prod fail-fast, dev/test warn)

### 제외

- 도메인 파이프라인 내부 로직 리팩터링
- providers/normalization/twin/render/glb/build의 Nest Provider 전환
- 멀티 인스턴스 상태 공유(다운로드 캐시 외부화)
- 인증/인가 체계 도입

## 3. 현재 상태 요약

- 현재 서버 진입은 `src/index.ts`의 `Bun.serve()`
- 도메인 조립은 `src/app.module.ts` 수동 구성
- `appModule.services.osmSceneBuild.run()`를 API가 직접 호출
- 최신 GLB는 프로세스 메모리 변수(`latestGlbBytes`, `latestGlbSceneId`)로 관리

## 4. 목표 아키텍처 (Approach A)

### 4.1 핵심 원칙

- API 레이어만 Nest로 전환
- 도메인 파이프라인은 어댑터 서비스에서 기존 인터페이스로 호출
- 결과 포맷은 최대한 유지하되 Nest 런타임 관례에 맞는 최소 정리 허용

### 4.2 구성 요소

1. `AppModule` (Nest)
   - `BuildController` 등록
   - `BuildGatewayService` 등록

2. `BuildController`
   - HTTP 입출력 책임
   - 엔드포인트 4개 노출

3. `BuildGatewayService`
   - 기존 도메인 파이프라인 호출 캡슐화
   - 최신 GLB 메모리 캐시 관리
   - 빌드 요청/응답 매핑

4. 기존 도메인 조립
   - `src/app.module.ts`의 서비스 조립 구조를 유지
   - `BuildGatewayService`가 이를 내부에서 사용

## 5. API 계약

### 5.1 POST `/api/build`

요청 DTO (`BuildRequestDto`)

- `sceneId: string` (required)
- `lat: number` (required)
- `lng: number` (required)
- `radius?: number` (default `150`)

응답

- 성공 (`200`)
  - `{ status: "completed", artifactHash, byteLength, meshSummary, sceneId, downloadUrl }`
- GLB 검증 실패 (`422`)
  - `{ status: "validation_failed", issues }`
- 기타 파이프라인 상태 실패 (`422`)
  - `{ status: result.kind, state }`
- 입력 오류 (`400`)
  - `{ error: string }`
- 예외 (`500`)
  - `{ error: string }`

### 5.2 GET `/api/build/download`

- 최신 GLB가 없으면 `404` + `{ error: 'No GLB built yet. POST /api/build first.' }`
- 있으면 `200`, `Content-Type: model/gltf-binary`, attachment 반환

### 5.3 GET `/health`

- `200` + `{ status: "ok", timestamp }`

### 5.4 GET `/api`

- API 문서 JSON 반환(기존 shape 유지)

## 6. 환경변수 정책

요구사항: `NODE_ENV`에 따른 분기

1. `production`
   - `GOOGLE_API_KEY`, `TOMTOM_API_KEY` 누락 시 부팅 실패 (fail-fast)
2. `development`, `test`
   - 누락 시 경고 로그 후 부팅 허용
   - 실제 provider 호출 시 런타임 에러는 기존 정책 유지

## 7. 단계별 실행 계획

### Step 1. Nest 런타임 골격 도입

- Nest 패키지 추가
  - `@nestjs/common`
  - `@nestjs/core`
  - `@nestjs/platform-express`
- `src/main.ts`를 Nest bootstrap 진입점으로 전환
- 실행 엔트리 스크립트 정리

완료 기준

- 서버 부팅 성공
- `GET /health` 200 응답

### Step 2. API 진입부 이관

- `BuildController` 구현
- `BuildGatewayService` 구현
- 기존 `/api` `/api/build` `/api/build/download` 이관

완료 기준

- 4개 엔드포인트 동작 유지

### Step 3. 환경변수 검증 분기 반영

- prod/dev/test 분기 구현

완료 기준

- 분기별 부팅 정책 확인

### Step 4. 회귀 검증

- `bun run type-check`
- `bun test`
- API 핵심 경로 테스트(최소 build/download)

완료 기준

- 타입체크/테스트 녹색

### Step 5. 진입점 정리

- `Bun.serve()` 진입 경로 제거
- 엔트리포인트 단일화

완료 기준

- 실행 경로 혼선 없음

## 8. 리스크 및 대응

1. 리스크: API 포맷 미세 불일치
- 대응: 기존 JSON shape 스냅샷/응답 검증 테스트 추가

2. 리스크: 도메인 조립 초기화 중복
- 대응: `BuildGatewayService`에서 lazy singleton 또는 1회 초기화 보장

3. 리스크: 런타임 전환 중 부팅 실패
- 대응: Step 1에서 `/health`만 먼저 검증 후 단계 진행

4. 리스크: 다운로드 캐시가 프로세스 메모리 의존
- 대응: 1차에서는 유지, 2차에서 외부 저장소 이전 검토

## 9. 완료 정의 (Phase 1 Done)

아래 조건을 모두 만족하면 1차 완료로 본다.

1. NestJS(Express) 런타임에서 API 4개 엔드포인트 제공
2. 기존 빌드 파이프라인 결과 계약 유지 (`artifactHash`, `byteLength`, download)
3. `production`/`development`/`test` 환경변수 정책 분기 반영
4. 타입체크/테스트 통과

## 10. 비목표 재확인

다음 항목은 1차에서 수행하지 않는다.

- 전체 서비스의 Nest Provider 전환
- 도메인 구조 개편
- 데이터 저장소/상태관리 아키텍처 변경
- 보안/인증 체계 도입
