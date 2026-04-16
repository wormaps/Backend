# WORPAMB 프로젝트 리팩토링 로드맵

> **작성일**: 2026-04-16
> **분석 기반**: 전체 코드베이스 심층 분석 (8개 병렬 에이전트 + 직접 조사)
> **총 발견사항**: 42개 (Critical 16개, High 16개, Medium 10개)

---

## Phase 0: 사전 준비 (1일)

### 목표

리팩토링 진행 전 기반 환경 정비

### 작업 목록

#### 0.1 환경 설정 검증

- [x] `.env.example` 파일 생성 (현재 `.env`만 존재, `.env.example` 없음)
- [x] `.gitignore`에서 `.env` 추적 확인 (현재는 무시되어 있으나 워킹트리에 존재)
- [x] `README.md`와 코드 간 drift 수정 (smoke 디렉토리 설명 불일치)
- [x] `OVERPASS_API_URL` → `OVERPASS_API_URLS` 변수명 통일
- [x] `MAPILLARY_AUYHORIZATION_URL` 오타 수정 → `MAPILLARY_AUTHORIZATION_URL`

**참조 파일**:

- `/Users/user/wormapb/.env`
- `/Users/user/wormapb/.gitignore`
- `/Users/user/wormapb/README.md`
- `/Users/user/wormapb/src/places/clients/overpass/overpass.transport.ts`
- `/Users/user/wormapb/src/places/clients/mapillary.client.ts`

#### 0.2 테스트 환경 정비

- [x] 테스트 실행 환경 확인 (`bun test`)
- [x] 실패하는 테스트 사전 식별
- [x] 테스트 커버리지 기준선 측정

**참조 파일**:

- `/Users/user/wormapb/package.json` (test 스크립트)
- `/Users/user/wormapb/src/**/*.spec.ts` (35개 파일)

---

## Phase 1: Critical 보안 및 안정성 (1주일)

### 목표

즉시 수정해야 하는 치명적 보안 취약점 및 시스템 안정성 문제 해결

### 1.1 보안 미들웨어 추가 (Day 1-2)

#### 작업

- [x] `helmet` 패키지 설치 및 적용
- [x] CORS 설정 추가 (허용 origin 화이트리스트)
- [x] rate limiting 추가 (기본 100req/min)
- [x] API 키 검증 미들웨어 추가

**참조 파일**:

- `/Users/user/wormapb/src/main.ts` (미들웨어 등록 위치)
- `/Users/user/wormapb/package.json` (의존성 추가)

**성공 기준**: 외부에서 보안 헤더 확인, CORS 차단 동작, rate limit 초과 시 429 응답

#### 1.2 API 키 노출 방지

- [x] TomTom API 키를 쿼리스트링에서 헤더로 이동 (현재 `?key=`로 전송)
- [x] `fetch-json.ts`에서 업스트림 응답 body가 에러 응답에 포함되지 않도록 수정
- [x] `ApiExceptionFilter`에서 `detail.upstreamEnvelope` 외부 응답에서 제외

**참조 파일**:

- `/Users/user/wormapb/src/places/clients/tomtom-traffic.client.ts` (Line 32: `apiKey` 사용)
- `/Users/user/wormapb/src/common/http/fetch-json.ts` (Line 96-139: 엔벨로프 생성)
- `/Users/user/wormapb/src/common/http/api-exception.filter.ts` (에러 응답 구성)

**성공 기준**: 에러 응답에 업스트림 body 미포함, API 키가 로그에 미노출

### 1.3 SSRF 방어 (Day 2-3)

#### 작업

- [x] `image.thumbnailUrl` fetch 시 URL host 화이트리스트 추가
- [x] `OVERPASS_API_URLS` env 검증 (HTTPS만 허용, 프라이빗 IP 차단)
- [x] 외부 URL fetch 전 scheme/host 검증 유틸리티 생성

**참조 파일**:

- `/Users/user/wormapb/src/scene/services/vision/scene-facade-image-color.utils.ts` (Line 166: thumbnailUrl fetch)
- `/Users/user/wormapb/src/places/clients/overpass/overpass.transport.ts` (Line 104-108: 엔드포인트 해석)

**성공 기준**: 프라이빗 IP URL fetch 시 차단, 화이트리스트 외 도메인 차단

### 1.4 ConfigModule 및 환경 변수 검증 (Day 3-4)

#### 작업

- [x] `@nestjs/config` 패키지 설치
- [x] `ConfigModule.forRoot()` 추가 (전역 설정)
- [x] 환경 변수 스키마 검증 추가 (Joi 또는 Zod)
- [x] 필수 환경 변수 누락 시 부팅 실패 처리

**검증 대상 환경 변수**:

- `GOOGLE_API_KEY` (필수)
- `TOMTOM_API_KEY` (필수)
- `MAPILLARY_ACCESS_TOKEN` (선택)
- `OVERPASS_API_URLS` (선택, 기본값 있음)
- `SCENE_DATA_DIR` (선택, 기본값: `data/scene`)
- `PORT` (선택, 기본값: 8080)

**참조 파일**:

- `/Users/user/wormapb/src/app.module.ts` (모듈 구성)
- `/Users/user/wormapb/src/main.ts` (부팅 로직)

**성공 기준**: 필수 env 누락 시 부팅 실패 + 명확한 에러 메시지

### 1.5 Graceful Shutdown 추가 (Day 4)

#### 작업

- [x] `app.enableShutdownHooks()` 추가
- [x] `SceneGenerationService`에 `OnApplicationShutdown` 구현
- [x] 큐 드레인 로직 추가 (SIGTERM 시 진행 중인 작업 완료 대기)
- [x] `TtlCacheService`에 cleanup 메서드 추가

**참조 파일**:

- `/Users/user/wormapb/src/main.ts` (부팅 로직)
- `/Users/user/wormapb/src/scene/services/generation/scene-generation.service.ts` (Line 23-30: 큐)
- `/Users/user/wormapb/src/cache/ttl-cache.service.ts` (캐시 관리)

**성공 기준**: SIGTERM 시 큐 드레인 완료 후 종료, 미완료 씬 FAILED 처리

### 1.6 취약한 의존성 업데이트 (Day 5)

#### 작업

- [x] `bun audit` 실행 및 결과 분석
- [x] `lodash` 업데이트 또는 제거 (high/moderate 취약점)
- [x] `path-to-regexp` 업데이트 (high/moderate 취약점)
- [x] `picomatch` 업데이트 (moderate/high 취약점)
- [x] `@types/bun: "latest"`를 특정 버전으로 고정

**참조 파일**:

- `/Users/user/wormapb/package.json`

**성공 기준**: `bun audit` 경고 0개

---

## Phase 2: 아키텍처 기반 정리 (2주일)

### 목표

파이프라인 구조 명확화, 중복 제거, 책임 분리

### 2.1 Fidelity Planning 단일화 (Day 6-7)

#### 현황

- 현재 파이프라인에서 `sceneFidelityPlanStep.execute()`가 2회 호출됨
- Line 104-112: `fidelity_plan` (초기)
- Line 139-147: `fidelity_plan_final` (최종)
- 두 번째 호출이 첫 번째 결과를 기반으로 재계산하므로 중복 실행

#### 작업

- [x] 파이프라인에서 fidelity plan을 1회만 실행하도록 수정
- [x] `fidelity_plan_final` stage 제거 또는 통합
- [x] 로그에서 `fidelity_plan`과 `fidelity_plan_final` 구분 제거

**참조 파일**:

- `/Users/user/wormapb/src/scene/pipeline/scene-generation-pipeline.service.ts` (Line 104-147)
- `/Users/user/wormapb/src/scene/pipeline/steps/scene-fidelity-plan.step.ts`
- `/Users/user/wormapb/src/scene/services/planning/scene-fidelity-planner.service.ts`

**성공 기준**: 파이프라인 로그에 `fidelity_plan`이 1회만 기록

### 2.2 API 호출 중앙화 (Day 7-9)

#### 현황

- Weather API가 generation 중 + /weather + /state + /state/entities에서 중복 호출
- Traffic API가 generation 중 + /traffic에서 중복 호출

#### 작업

- [x] Generation 시 호출한 weather/traffic 데이터를 씬에 저장
- [x] 엔드포인트에서 저장된 데이터 우선 반환 (TTL 이내)
- [x] 필요 시에만 외부 API 재호출

**참조 파일**:

- `/Users/user/wormapb/src/scene/services/generation/scene-generation.service.ts` (Line 162-189: 샘플링)
- `/Users/user/wormapb/src/scene/services/live/scene-weather-live.service.ts`
- `/Users/user/wormapb/src/scene/services/live/scene-traffic-live.service.ts`

**성공 기준**: 동일 씬 조회 시 외부 API 호출 50% 감소

### 2.3 DI 우회 제거 (Day 9-12)

#### 현황

- 수동 `new` 인스턴스화 42개 발견
- NestJS DI 라이프사이클 우회
- 테스트 시 mocking 어려움

#### 작업 (우선순위별)

1. [x] `scene-vision.service.ts` (4개 서비스 `new`)
2. [x] `scene-hero-override.service.ts` (2개 서비스 `new`)
3. [x] `scene-quality-gate.service.ts` (`new AppLoggerService()`)
4. [x] `glb-build-runner.ts` (2개 서비스 `new`)
5. [x] `scene-asset-profile.step.ts` (2개 서비스 `new`)
6. [x] 그 외 31개 위치

**참조 파일**:

- `/Users/user/wormapb/src/scene/services/vision/scene-vision.service.ts` (Line 28-34)
- `/Users/user/wormapb/src/scene/services/hero-override/scene-hero-override.service.ts` (Line 10-11)
- `/Users/user/wormapb/src/scene/services/generation/scene-quality-gate.service.ts` (Line 31)
- `/Users/user/wormapb/src/assets/internal/glb-build/glb-build-runner.ts` (Line 164, 199)

**성공 기준**: `new [A-Z].*Service(` 패턴 0개 (테스트 제외)

### 2.4 중복 라우트 정리 (Day 12)

#### 현황

- `/scenes/:sceneId`와 `/scenes/:sceneId/status`가 동일 응답 반환
- `getSceneStatus()`가 단순히 `getScene()`을 호출

#### 작업

- [x] `/scenes/:sceneId/status`를 제거하거나 별도 경량 응답으로 변경
- [x] 또는 status에 추가 정보 포함 (큐 위치, 예상 완료 시간 등)

**참조 파일**:

- `/Users/user/wormapb/src/scene/scene.controller.ts` (Line 121-144)

**성공 기준**: 중복 라우트 제거 또는 명확한 책임 분리

### 2.5 프로토타입 레지스트리 정리 (Day 13)

#### 현황

- `prototypeRegistry.register()`가 어디서도 호출되지 않음
- `resolve()` 메서드도 미사용
- 의도된 기능이지만 미작동

#### 작업

- [x] 프로토타입 레지스트리 활용 방안 결정 (활성화 또는 제거)
- [x] 활성화 시: building 패턴 등록 로직 추가
- [x] 제거 시: 관련 코드 정리

**참조 파일**:

- `/Users/user/wormapb/src/assets/internal/glb-build/glb-build-prototype.registry.ts`
- `/Users/user/wormapb/src/assets/internal/glb-build/stages/glb-build-building-hero.stage.ts`

**성공 기준**: 레지스트리가 명확하게 활용되거나 코드에서 제거

### 2.6 큐 중복 제거 (Day 14)

#### 현황

- `generationQueue`가 단순 문자열 배열
- 같은 `sceneId`가 여러 번 enqueued 가능
- `isProcessingQueue` 플래그 외 중복 제거 없음

#### 작업

- [x] `generationQueue`를 `Set`으로 변경 또는 중복 체크 로직 추가
- [x] 동일 sceneId 재요청 시 기존 큐 항목 우선 처리

**참조 파일**:

- `/Users/user/wormapb/src/scene/services/generation/scene-generation.service.ts` (Line 23-30)

**성공 기준**: 동일 sceneId 중복 enqueue 방지

---

## Phase 3: 품질 및 성능 개선 (2주일)

### 목표

GLB 결과물 품질 향상 및 빌드 성능 최적화

### 3.1 재질 캐시 최적화 (Day 15-16)

#### 현황

- 캐시 키가 `name` 문자열뿐
- `createBuildingShellMaterial()`이 고유 hex 색상으로 캐시 미스 유발
- 동일 스타일이라도 색상이 약간 다르면 재질 재사용 불가

#### 작업

- [ ] 재질 이름에서 hex 값 제거 → 버킷/스타일 기반 키 사용
- [ ] `tuningOptions`를 캐시 키에 포함
- [ ] 동일 스타일 building 간 재질 공유 구현

**참조 파일**:

- `/Users/user/wormapb/src/assets/internal/glb-build/glb-build-material-cache.ts`
- `/Users/user/wormapb/src/assets/compiler/materials/glb-material-factory.scene.ts` (Line 266-285)

**성공 기준**: 동일 스타일 building 간 재질 재사용률 80% 이상

### 3.2 그룹 빌딩 활용 (Day 16-17)

#### 현황

- `buildGroupedBuildingShells()`가 계산되지만 `void groupedBuildings;`로 무시
- 동일 스타일 building을 그룹화하여 재질/기하학 공유 가능

#### 작업

- [ ] `groupedBuildings` 결과를 실제 빌딩 생성에 활용
- [ ] 그룹별 대표 building 생성 후 인스턴싱 적용

**참조 파일**:

- `/Users/user/wormapb/src/assets/internal/glb-build/stages/glb-build-building-hero.stage.ts` (Line 37-42)

**성공 기준**: building 메시 수 50% 감소 (인스턴싱 적용)

### 3.3 기하학 정합성 개선 (Day 17-19)

#### 현황

- 패널 오프셋 18cm (벽에서 떨어져 보임)
- 지붕-쉘 갭 2cm (분리된 시각)
- 윈도우-바닥 정렬 불일치

#### 작업

- [ ] 패널 오프셋 조정 (벽에 밀착 또는 갭 줄이기)
- [ ] 지붕-쉘 갭 제거 (`topHeight + 0.02` 제거)
- [ ] 윈도우 위치를 실제 바닥 높이 기반으로 계산

**참조 파일**:

- `/Users/user/wormapb/src/assets/compiler/building/building-mesh.panel.builder.ts` (Line 552: 0.18m 오프셋)
- `/Users/user/wormapb/src/assets/compiler/building/building-mesh.roof-surface.builder.ts` (Line 92: 0.02m 갭)
- `/Users/user/wormapb/src/assets/compiler/building/building-mesh.window.builder.ts` (Line 24: 3.6m 하드코딩)

**성공 기준**: geometry correction 로그에서 패널/지붕 겹침 0개

### 3.4 GLB 최적화 (Day 19-21)

#### 현황

- Position/Normal 미양자화 (validator 이슈로 비활성화)
- 텍스처 경로 비활성화
- GLB 파일 26-29MB

#### 작업

- [ ] validator 이슈 해결 후 Position/Normal 양자화 활성화
- [ ] 텍스처 관련 코드 정리 (활성화 또는 명확한 비활성화)
- [ ] `enableTexturePath` 기본값 재설정 결정

**참조 파일**:

- `/Users/user/wormapb/src/assets/internal/glb-build/glb-build-runner.ts` (Line 467: 양자화 설정)
- `/Users/user/wormapb/src/assets/compiler/materials/glb-material-factory.scene.ts` (Line 15: enableTexturePath)

**성공 기준**: GLB 파일 크기 20MB 이하 또는 품질 저하 없이 크기 유지

### 3.5 캐시 스탬피드 방지 (Day 21-22)

#### 현황

- `getOrSet()`에 인플라이트 중복 제거 없음
- TTL 만료 시 동시 요청이 모두 upstream 호출

#### 작업

- [ ] `getOrSet()`에 pending promise 맵 추가
- [ ] 동일 키 동시 요청 시 첫 번째 결과 공유

**참조 파일**:

- `/Users/user/wormapb/src/cache/ttl-cache.service.ts`

**성공 기준**: 캐시 갱신 시 upstream 호출 1회로 제한

### 3.6 캐시 최대 크기 제한 (Day 22-23)

#### 현황

- `TtlCacheService`가 unbounded Map 사용
- 만료된 항목이 자동 제거되지 않음 (lazy 접근 시만 제거)
- 장기 실행 시 메모리 누수 가능

#### 작업

- [ ] LRU eviction 정책 추가
- [ ] 최대 항목 수 제한 설정
- [ ] 주기적 정리 작업 추가

**참조 파일**:

- `/Users/user/wormapb/src/cache/ttl-cache.service.ts`

**성공 기준**: 캐시 크기 상한 설정 및 만료 항목 자동 정리

### 3.7 SceneRepository eviction (Day 23-24)

#### 현황

- `scenes` Map이 모든 씬을 메모리에 보관
- `requestIndex` Map도 무한 증가
- 장기 실행 시 메모리 사용량 지속 증가

#### 작업

- [ ] 최근 접근 순서 기반 eviction 추가
- [ ] 최대 씬 수 제한
- [ ] 오래된 씬 자동 아카이브/제거

**참조 파일**:

- `/Users/user/wormapb/src/scene/storage/scene.repository.ts`

**성공 기준**: 메모리 사용량 상한 설정

---

## Phase 4: 관측성 및 테스트 (2주일)

### 목표

운영 모니터링 강화 및 테스트 커버리지 확대

### 4.1 메트릭 추가 (Day 25-27)

#### 작업

- [ ] Prometheus 또는 OpenTelemetry 연동
- [ ] API 호출 latency 메트릭 (외부 API별)
- [ ] 큐 depth 메트릭
- [ ] 캐시 hit/miss 메트릭
- [ ] GLB 빌드 시간/크기 메트릭
- [ ] 성공/실패율 메트릭

**측정 대상**:

- Google Places API 호출 latency
- Overpass API 호출 latency
- Mapillary API 호출 latency
- OpenMeteo API 호출 latency
- TomTom API 호출 latency
- GLB 빌드 시간
- 큐 대기 시간
- 캐시 hit율

**참조 파일**:

- `/Users/user/wormapb/src/common/http/fetch-json.ts` (timestamp 측정 지점)
- `/Users/user/wormapb/src/scene/services/generation/scene-generation.service.ts` (큐 관리)
- `/Users/user/wormapb/src/cache/ttl-cache.service.ts` (캐시 관리)

**성공 기준**: Grafana 대시보드에서 주요 메트릭 실시간 확인 가능

### 4.2 트레이싱 강화 (Day 27-28)

#### 작업

- [ ] `x-request-id` 생성/전파 미들웨어 추가 (이미 존재하나 강화)
- [ ] 외부 API 호출에 requestId 포함
- [ ] 파이프라인 단계별 traceId 전파

**참조 파일**:

- `/Users/user/wormapb/src/common/http/request-context.util.ts`
- `/Users/user/wormapb/src/common/logging/app-logger.service.ts`

**성공 기준**: requestId로 전체 요청 추적 가능

### 4.3 Health Check 개선 (Day 28-29)

#### 현황

- `/health`가 uptime만 반환
- 외부 의존성 검증 없음
- Readiness/Liveness 미분리

#### 작업

- [ ] Liveness probe 추가 (프로세스 상태)
- [ ] Readiness probe 추가 (외부 의존성 검증)
- [ ] 각 외부 API 연결 상태 검증

**참조 파일**:

- `/Users/user/wormapb/src/health/health.controller.ts`

**성공 기준**: Readiness probe가 외부 API 연결 실패 시 503 반환

### 4.4 운영 디버그 엔드포인트 (Day 29-30)

#### 작업

- [ ] 큐 상태 조회 엔드포인트 추가
- [ ] 캐시 통계 엔드포인트 추가
- [ ] 최근 실패 이력 조회 엔드포인트 추가
- [ ] 씬 diagnostics 로그 조회 엔드포인트 추가

**참조 파일**:

- `/Users/user/wormapb/src/scene/scene.controller.ts` (새 엔드포인트 추가)

**성공 기준**: 운영 중 내부 상태 실시간 확인 가능

### 4.5 테스트 커버리지 확대 - 캐시 (Day 30-32)

#### 현황

- `TtlCacheService`에 대한 테스트 없음
- 캐시 스탬피드, eviction, TTL 동작 미검증

#### 작업

- [ ] `ttl-cache.service.spec.ts` 생성
- [ ] 기본 get/set 동작 테스트
- [ ] TTL 만료 동작 테스트
- [ ] 동시 접근 동작 테스트
- [ ] 최대 크기 제한 동작 테스트 (구현 후)

**참조 파일**:

- `/Users/user/wormapb/src/cache/ttl-cache.service.ts`

**성공 기준**: 캐시 관련 테스트 10개 이상

### 4.6 테스트 커버리지 확대 - 외부 API (Day 32-34)

#### 현황

- Google Places, OpenMeteo, TomTom, Mapillary 클라이언트에 대한 에러 시나리오 테스트 부족
- API 실패, rate limiting, timeout 케이스 미검증

#### 작업

- [ ] 각 클라이언트에 에러 시나리오 테스트 추가
  - [ ] 429 Rate Limit 응답
  - [ ] 500 서버 에러
  - [ ] Timeout
  - [ ] 네트워크 오류
- [ ] 실패 시 재시도 동작 검증
- [ ] 부분 실패 시 graceful degradation 검증

**참조 파일**:

- `/Users/user/wormapb/src/places/clients/google-places.client.ts`
- `/Users/user/wormapb/src/places/clients/open-meteo.client.ts`
- `/Users/user/wormapb/src/places/clients/tomtom-traffic.client.ts`
- `/Users/user/wormapb/src/places/clients/mapillary.client.ts`

**성공 기준**: 각 클라이언트에 에러 시나리오 테스트 5개 이상

### 4.7 테스트 커버리지 확대 - 핵심 서비스 (Day 34-37)

#### 현황

- `SceneGenerationService`, `SceneReadService`, `SceneLiveDataService` 등 핵심 서비스 미테스트
- 큐 처리, 재시도, 상태 전이 로직 미검증

#### 작업

- [ ] `SceneGenerationService` 큐 처리 테스트
  - [ ] 정상 생성 흐름
  - [ ] 큐 중복 방지
  - [ ] 실패 시 재시도
  - [ ] 최대 시도 후 FAILED 처리
- [ ] `SceneReadService` 조회 테스트
  - [ ] READY 씬 조회
  - [ ] PENDING 씬 조회
  - [ ] 존재하지 않는 씬 조회
- [ ] `SceneLiveDataService` 데이터 결합 테스트
  - [ ] 정상 데이터 결합
  - [ ] 부분 데이터 결합
  - [ ] 캐시 활용 검증

**참조 파일**:

- `/Users/user/wormapb/src/scene/services/generation/scene-generation.service.ts`
- `/Users/user/wormapb/src/scene/services/read/scene-read.service.ts`
- `/Users/user/wormapb/src/scene/services/live/scene-live-data.service.ts`

**성공 기준**: 핵심 서비스별 테스트 10개 이상

---

## Phase 5: 최적화 및 확장성 (3주일)

### 목표

성능 최적화 및 수평 확장 지원

### 5.1 큐 분산 처리 (Day 38-42)

#### 현황

- 인메모리 큐로 인스턴스 간 공유 불가
- 수평 확장 시 중복 처리 가능

#### 작업

- [ ] Redis 또는 BullMQ 기반 큐 도입 검토
- [ ] 분산 락 구현 (동일 sceneId 중복 방지)
- [ ] 큐 상태 외부 저장소 연동

**참조 파일**:

- `/Users/user/wormapb/src/scene/services/generation/scene-generation.service.ts`
- `/Users/user/wormapb/src/cache/ttl-cache.service.ts` (Redis 캐시로 전환 검토)

**성공 기준**: 여러 인스턴스에서 동작 시 중복 처리 방지

### 5.2 파일 쓰기 원자성 (Day 42-44)

#### 현황

- GLB 파일 직접 쓰기 (crash 시 손상 가능)
- JSON 파일 직접 쓰기 (부분 쓰기 가능)
- 로그 append (interleaving 가능)

#### 작업

- [ ] 임시 파일 + rename 패턴 적용
- [ ] JSON 파일 쓰기 원자성 보장
- [ ] 로그 파일 롤링 구현

**참조 파일**:

- `/Users/user/wormapb/src/assets/internal/glb-build/glb-build-runner.ts` (Line 754: writeFile)
- `/Users/user/wormapb/src/scene/storage/scene.repository.ts` (파일 쓰기)
- `/Users/user/wormapb/src/scene/storage/scene-storage.utils.ts` (로그 append)

**성공 기준**: 쓰기 중 crash 시 이전 상태 유지

### 5.3 대형 파일 분해 (Day 44-48)

#### 현황

- 500줄 이상 파일 14개
- 책임 과밀로 변경 영향 범위 예측 어려움

#### 분해 대상 (우선순위)

1. [ ] `glb-build-runner.ts` (1,044줄) → 빌드 실행 / 최적화 / 검증 분리
2. [ ] `scene-geometry-correction.step.ts` (890줄) → 겹침 감지 / 보정 / 검증 분리
3. [ ] `glb-material-factory.scene.ts` (878줄) → 재질 생성 / 텍스처 / 캐시 분리
4. [ ] `scene-facade-vision.service.ts` (808줄) → 이미지 분석 / 색상 추출 / 힌트 생성 분리

**참조 파일**:

- `/Users/user/wormapb/src/assets/internal/glb-build/glb-build-runner.ts`
- `/Users/user/wormapb/src/scene/pipeline/steps/scene-geometry-correction.step.ts`
- `/Users/user/wormapb/src/assets/compiler/materials/glb-material-factory.scene.ts`
- `/Users/user/wormapb/src/scene/services/vision/scene-facade-vision.service.ts`

**성공 기준**: 각 파일 300줄 이하

### 5.4 모듈 분리 (Day 48-50)

#### 현황

- `scene.module.ts`에 37개 프로바이더
- 하나의 모듈에 너무 많은 책임

#### 작업

- [ ] 기능별 서브모듈 분리
  - [ ] `SceneVisionModule` (시각 데이터 수집)
  - [ ] `SceneGenerationModule` (생성 파이프라인)
  - [ ] `SceneLiveModule` (실시간 데이터)
  - [ ] `SceneStorageModule` (저장소)

**참조 파일**:

- `/Users/user/wormapb/src/scene/scene.module.ts`

**성공 기준**: 각 서브모듈 10개 이하 프로바이더

### 5.5 입력 검증 강화 (Day 50-52)

#### 현황

- `sceneId`, `placeId`에 길이 제한 없음
- 좌표 범위 검증 없음
- `class-validator` 미사용

#### 작업

- [ ] `class-validator` 패키지 설치
- [ ] DTO에 검증 데코레이터 추가
- [ ] 길이 제한 추가 (sceneId: 64자, placeId: 256자)
- [ ] 좌표 범위 검증 (lat: -90~90, lng: -180~180)

**참조 파일**:

- `/Users/user/wormapb/src/scene/scene.controller.ts` (@Param, @Query)
- `/Users/user/wormapb/src/common/http/query-parsers.ts`

**성공 기준**: 잘못된 입력 시 400 응답 + 명확한 에러 메시지

### 5.6 레이트리밋 처리 (Day 52-53)

#### 현황

- 429 에러가 일반적인 `EXTERNAL_API_REQUEST_FAILED`으로 변환
- 재시도 정책 없음 (Overpass/TomTom만 예외)

#### 작업

- [ ] 429 응답 시 자동 재시도 (exponential backoff)
- [ ] Retry-After 헤더 준수
- [ ] 각 클라이언트에 재시도 정책 적용

**참조 파일**:

- `/Users/user/wormapb/src/common/http/fetch-json.ts` (에러 처리)
- `/Users/user/wormapb/src/places/clients/overpass/overpass.transport.ts` (재시도 패턴 참고)

**성공 기준**: 429 응답 시 자동 복구

### 5.7 로그 로테이션 (Day 53-54)

#### 현황

- diagnostics 로그가 무한 증가
- 로테이션 미구현
- 장기 실행 시 디스크 사용량 증가

#### 작업

- [ ] 로그 파일 크기 제한 설정
- [ ] 로테이션 정책 구현 (일별 또는 크기 기반)
- [ ] 오래된 로그 자동 정리

**참조 파일**:

- `/Users/user/wormapb/src/scene/storage/scene-storage.utils.ts`

**성공 기준**: 로그 파일 크기 상한 설정 및 자동 정리

---

## Phase 6: 검증 및 안정화 (1주일)

### 목표

모든 변경사항 통합 검증 및 안정성 확보

### 6.1 통합 테스트 (Day 55-57)

#### 작업

- [ ] 엔드투엔드 시나리오 테스트
  - [ ] 씬 생성 → 조회 → GLB 다운로드
  - [ ] 동일 씬 재생성
  - [ ] 실패 → 재시도 → 성공
  - [ ] 동시 요청 처리
- [ ] 외부 API 실패 시나리오
  - [ ] Google Places 실패
  - [ ] Overpass 실패
  - [ ] Mapillary 실패
  - [ ] GLB 빌드 실패

**성공 기준**: 모든 통합 테스트 통과

### 6.2 성능 벤치마크 (Day 57-58)

#### 작업

- [ ] 씬 생성 latency 측정
- [ ] GLB 빌드 시간 측정
- [ ] 메모리 사용량 측정
- [ ] 동시 요청 처리 능력 측정

**성공 기준**:

- 씬 생성 latency < 60초 (현재 ~72초)
- GLB 빌드 시간 < 30초 (현재 ~66초)
- 메모리 사용량 < 2GB

### 6.3 문서화 (Day 58-59)

#### 작업

- [ ] API 문서 업데이트
- [ ] 아키텍처 문서 작성
- [ ] 배포 가이드 작성
- [ ] 운영 매뉴얼 작성

**성공 기준**: 문서 완성 및 팀 공유

### 6.4 최종 검증 (Day 60)

#### 작업

- [ ] 전체 테스트 스위트 실행
- [ ] 보안 스캔 실행
- [ ] 성능 테스트 실행
- [ ] 코드 리뷰 완료

**성공 기준**: 모든 검증 통과

---

## 부록 A: 발견된 파일 위치 참조

### 파이프라인 및 중복

- `/Users/user/wormapb/src/scene/pipeline/scene-generation-pipeline.service.ts`
- `/Users/user/wormapb/src/scene/services/generation/scene-generation.service.ts`
- `/Users/user/wormapb/src/scene/pipeline/steps/scene-fidelity-plan.step.ts`
- `/Users/user/wormapb/src/scene/services/planning/scene-fidelity-planner.service.ts`

### GLB 품질

- `/Users/user/wormapb/src/assets/internal/glb-build/glb-build-runner.ts`
- `/Users/user/wormapb/src/assets/internal/glb-build/stages/glb-build-building-hero.stage.ts`
- `/Users/user/wormapb/src/assets/compiler/materials/glb-material-factory.scene.ts`
- `/Users/user/wormapb/src/assets/internal/glb-build/glb-build-material-cache.ts`
- `/Users/user/wormapb/src/assets/internal/glb-build/glb-build-prototype.registry.ts`

### 기하학

- `/Users/user/wormapb/src/assets/compiler/building/building-mesh.panel.builder.ts`
- `/Users/user/wormapb/src/assets/compiler/building/building-mesh.roof-surface.builder.ts`
- `/Users/user/wormapb/src/assets/compiler/building/building-mesh.window.builder.ts`
- `/Users/user/wormapb/src/assets/compiler/building/building-mesh.shell.builder.ts`

### DI 및 아키텍처

- `/Users/user/wormapb/src/scene/scene.module.ts`
- `/Users/user/wormapb/src/scene/services/vision/scene-vision.service.ts`
- `/Users/user/wormapb/src/scene/services/hero-override/scene-hero-override.service.ts`
- `/Users/user/wormapb/src/scene/services/generation/scene-quality-gate.service.ts`

### 보안 및 설정

- `/Users/user/wormapb/src/common/http/fetch-json.ts`
- `/Users/user/wormapb/src/common/http/api-exception.filter.ts`
- `/Users/user/wormapb/src/common/http/api-response.interceptor.ts`
- `/Users/user/wormapb/src/places/clients/google-places.client.ts`
- `/Users/user/wormapb/src/places/clients/tomtom-traffic.client.ts`
- `/Users/user/wormapb/src/places/clients/mapillary.client.ts`
- `/Users/user/wormapb/src/places/clients/overpass/overpass.transport.ts`
- `/Users/user/wormapb/.env`
- `/Users/user/wormapb/.gitignore`
- `/Users/user/wormapb/README.md`

### 상태 및 캐시

- `/Users/user/wormapb/src/cache/ttl-cache.service.ts`
- `/Users/user/wormapb/src/scene/storage/scene.repository.ts`
- `/Users/user/wormapb/src/scene/services/live/scene-weather-live.service.ts`
- `/Users/user/wormapb/src/scene/services/live/scene-traffic-live.service.ts`
- `/Users/user/wormapb/src/scene/services/live/scene-state-live.service.ts`

### 모니터링 및 테스트

- `/Users/user/wormapb/src/common/logging/app-logger.service.ts`
- `/Users/user/wormapb/src/health/health.controller.ts`
- `/Users/user/wormapb/src/main.ts`
- `/Users/user/wormapb/package.json`

### 로그 파일

- `/Users/user/wormapb/data/scene/*.diagnostics.log`

---

## 부록 B: 메트릭 기준선

### 현재 상태 (측정 필요)

- 씬 생성 latency: ~72초
- GLB 빌드 시간: ~66초
- GLB 파일 크기: 26-29MB
- building 겹침: 2,419개
- 메모리 사용량: 미측정

### 목표 상태

- 씬 생성 latency: < 60초
- GLB 빌드 시간: < 30초
- GLB 파일 크기: < 20MB
- building 겹침: < 100개
- 메모리 사용량: < 2GB

---

## 부록 C: 위험 평가

### 높은 위험

- Phase 2 DI 우회 제거 (42개 위치 수정, 광범위한 영향)
- Phase 3 재질 캐시 최적화 (렌더링 품질 영향 가능)
- Phase 5 큐 분산 처리 (아키텍처 변경)

### 중간 위험

- Phase 1 보안 미들웨어 추가 (기존 동작 영향 가능)
- Phase 4 메트릭 추가 (성능 오버헤드)

### 낮은 위험

- Phase 0 환경 설정 정비
- Phase 6 문서화

---

## 부록 D: 의존성 관계

```
Phase 0 (사전 준비)
    ↓
Phase 1 (보안/안정성) ← 필수 선행
    ↓
Phase 2 (아키텍처) ← Phase 1 완료 후
    ↓
Phase 3 (품질/성능) ← Phase 2 완료 후
    ↓
Phase 4 (관측성/테스트) ← Phase 2 완료 후 (병렬 가능)
    ↓
Phase 5 (최적화/확장) ← Phase 3, 4 완료 후
    ↓
Phase 6 (검증/안정화) ← 모든 Phase 완료 후
```

---

## 부록 E: 의사결정 기록

### 결정된 사항

1. ConfigModule 도입 (@nestjs/config)
2. Graceful shutdown 추가
3. 보안 미들웨어 도입 (helmet, CORS, rate limiting)
4. DI 우회 제거

### 결정 필요 사항

1. 큐 분산 처리 방식 (Redis vs BullMQ vs 기타)
2. 메트릭 도구 (Prometheus vs OpenTelemetry vs 기타)
3. 텍스처 경로 활성화 여부
4. 프로토타입 레지스트리 활용 여부

### 보류 사항

1. 수평 확장 전략
2. CDN 연동
3. 다중 리전 배포

---

**문서 버전**: 1.0
**최종 수정**: 2026-04-16
**담당자**: Sisyphus
