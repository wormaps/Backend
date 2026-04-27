# WorMap Remediation Phase Specification

이 문서는 WorMap 백엔드의 전사 감사 결과를 바탕으로, 문제 목록이 아니라 **도메인 복구 명세**를 정의한다.

이 문서의 목적은 세 가지다.

1. 현재 시스템에서 깨진 도메인 불변식을 명확히 적는다.
2. 복구 작업을 bounded context 기준으로 나누고 phase 단위로 통제한다.
3. 각 phase가 끝났다고 주장하려면 어떤 gate, 어떤 증거, 어떤 체크리스트를 통과해야 하는지 강제한다.

이 문서는 구현 아이디어 메모가 아니다. 이 문서는 엔지니어링, QA, 운영이 함께 사용하는 **실행 계약 문서**다.

## 0. 2026-04-27 Base Re-Audit

이 섹션은 2026-04-27 현재 코드베이스를 다시 확인한 결과다.

아래 2장 이후의 기존 baseline은 과거 백엔드 리메디에이션 문맥을 포함한다. 현재 v2 clean-slate 코드베이스의 우선순위 판단에는 이 0장이 우선한다.

### 0-1. 확인 명령

| 명령 | 결과 | 해석 |
|---|---|---|
| `bun run type-check` | fail | 정적 타입 검증이 깨져 있다 |
| `bun test` | fail | 일부 테스트가 모듈 부재로 실행 전 실패한다 |
| `rg --files` | pass | 현재 파일 구조 확인 완료 |
| `rg -n "MVP|placeholder|massing|Bun\\.serve|NestJS" src packages docs test scripts` | pass | MVP 경계와 아키텍처 혼재 지점 확인 완료 |

### 0-2. 현재 사실

| 항목 | 현재 상태 | 근거 |
|---|---|---|
| 실제 서버 진입점 | `Bun.serve` 기반 MVP 서버 | `src/index.ts` |
| PRD 기준 backend | NestJS 유지 | `docs/01-product/prd-v2.md` |
| package scripts | `start`, `dev`, `type-check`, `test`만 존재 | `package.json` |
| NestJS 의존성 | package에 없음 | `package.json` |
| NestJS 코드 | 일부 `src/scene`, `src/health`에 남아 있음 | `src/scene/services/generation/scene-generation.service.ts`, `src/health/health.service.ts` |
| type-check | 실패 | `@nestjs/common`, `@nestjs/config`, repository, metrics, logger 모듈 부재 |
| test | 실패 | `@nestjs/testing`, metrics, repository 모듈 부재 |
| GLB 출력 범위 | massing / road / walkway / poi marker 중심 | `packages/contracts/mesh-plan/index.ts` |
| RenderIntent detail | windows, entrances, roofEquipment, facadeMaterial, signage 전부 false | `src/render/application/render-intent-policy.service.ts` |
| 현재 MVP 문서 범위 | 현실적 고품질 GLB가 아니라 파이프라인 계약 무결성 증명 | `docs/01-product/mvp-scope.md` |

### 0-3. 현재 깨진 Base Invariants

| 불변식 | 현재 판정 | 설명 |
|---|---|---|
| Repository must type-check | 깨짐 | `tsconfig`가 `src/**/*.ts`, `test/**/*.ts` 전체를 포함하지만 일부 import 대상이 없다 |
| Runtime architecture must be singular | 깨짐 | 실제 실행은 Bun MVP인데 문서와 일부 코드는 NestJS를 전제한다 |
| Package scripts must reflect supported paths | 깨짐 | NestJS 관련 코드가 있으나 NestJS 실행/검증 script와 dependency가 없다 |
| Tests must fail on behavior, not missing modules | 깨짐 | 일부 테스트는 assertion 전에 모듈 import 실패로 중단된다 |
| Production base must separate live code from legacy code | 깨짐 | 살아 있는 MVP 코드와 죽은 운영 코드가 같은 `src` tree에 섞여 있다 |
| GLB quality claim must match contract capability | 깨짐 | contract가 massing만 지원하는데 제품 목표는 현실 동기화율 90% 이상이다 |

### 0-4. Root Cause

현재 문제의 근본 원인은 GLB compiler 하나가 약한 것이 아니다.

현재 코드베이스는 다음 세 상태가 동시에 존재한다.

1. PRD는 NestJS 기반 production pipeline을 요구한다.
2. 실제 실행 경로는 Bun 기반 MVP smoke server다.
3. 일부 `src`와 `test`는 과거 또는 미래 NestJS 운영 구조를 참조하지만 dependency와 파일이 없다.

따라서 지금은 “현실적인 도시를 더 잘 생성한다” 이전에 **검증 가능한 단일 base architecture**가 없다.

### 0-5. Base-First Phase Ordering

현재부터의 phase 순서는 GLB fidelity가 아니라 base stability를 먼저 복구하는 순서다.

| 우선순위 | Phase | 목표 | 차단 조건 |
|---:|---|---|---|
| P0 | Phase B0. Architecture Decision Lock | NestJS production path와 Bun MVP path 중 공식 실행 경로를 하나로 고정 | 공식 경로가 둘 이상이거나 문서와 script가 다름 |
| P0 | Phase B1. Typecheck Recovery | `bun run type-check` 통과 | missing module import가 하나라도 남음 |
| P0 | Phase B2. Test Harness Recovery | `bun test`가 모듈 부재 없이 실행 | assertion 이전 import error 발생 |
| P1 | Phase B3. Script and Package Contract | scripts가 실제 지원 경로만 노출 | 죽은 script 또는 dependency 없는 코드 경로 존재 |
| P1 | Phase B4. Runtime Boundary Split | live MVP/runtime code와 legacy/future code 분리 | `src` 전체 검증 시 무관한 과거 코드가 실패 유발 |
| P2 | Phase B5. Production Pipeline Foundation | provider snapshot부터 manifest까지 production build lifecycle 고정 | `/api/build`가 OSM-only shortcut에 머무름 |
| P3 | Phase B6. GLB Fidelity Expansion | MeshPlan/RenderIntent/GLB contract를 massing 이상으로 확장 | base gate가 녹색이 아님 |

### 0-6. Phase B0. Architecture Decision Lock

진입 조건:

- 현재 재감사 결과가 문서화되어 있을 것

목표:

- 공식 backend 실행 경로를 하나로 결정한다.

결정 옵션:

| 옵션 | 의미 | 필요한 후속 작업 |
|---|---|---|
| NestJS production path | PRD를 따른다 | NestJS dependency 복구, `apps/api` 또는 Nest app bootstrap 복구, Bun MVP 서버 격리 |
| Bun MVP path | 현재 실행 경로를 공식화한다 | NestJS 코드 legacy 격리, NestJS 문서/테스트 제외 또는 재작성 |

품질 게이트:

- Pass: `package.json`, `tsconfig.json`, docs, runtime entrypoint가 같은 실행 경로를 가리킨다.
- Block: PRD는 NestJS, script는 Bun, test는 NestJS를 보는 상태가 계속된다.

종료 기준:

- 공식 runtime path가 하나로 명시된다.
- 비공식 경로는 `legacy`, `experimental`, `future` 중 하나로 격리된다.

### 0-7. Phase B1. Typecheck Recovery

진입 조건:

- Phase B0 완료

목표:

- repo 전체 또는 명시된 supported workspace의 type-check를 녹색으로 만든다.

작업:

- missing module import 제거, 복구, 또는 격리
- `tsconfig` include/exclude 정책 재정의
- 실제 dependency와 코드 import 정합성 복구

품질 게이트:

- Pass: `bun run type-check` 종료 코드 0
- Block: `Cannot find module` 또는 implicit any 오류가 남음

종료 기준:

- type-check 실패가 기능 변경 논의의 노이즈가 되지 않는다.

### 0-8. Phase B2. Test Harness Recovery

진입 조건:

- Phase B1 완료

목표:

- 테스트 실패가 import/runtime harness 문제가 아니라 실제 behavior 문제를 가리키게 만든다.

작업:

- NestJS 테스트를 복구하거나 legacy로 격리
- 현재 MVP contract test와 production test scope 분리
- fixture/smoke/contract/provider 테스트 script 분리

품질 게이트:

- Pass: `bun test`가 모듈 부재 없이 실행되고 실패 시 assertion failure로 실패한다.
- Block: `Cannot find module`이 발생한다.

종료 기준:

- 테스트 결과가 신뢰 가능한 release signal이 된다.

### 0-9. Phase B3. Script and Package Contract

진입 조건:

- Phase B2 완료

목표:

- package scripts가 현재 지원하는 제품 경로를 정확히 표현한다.

필수 scripts:

| script | 목적 |
|---|---|
| `dev` | 공식 runtime local 실행 |
| `type-check` | supported code 전체 정적 검증 |
| `test` | 기본 회귀 테스트 |
| `test:contracts` | public contract 검증 |
| `test:glb` | GLB compiler/validator smoke 검증 |
| `qa` 또는 `qa:table` | scene QA table 생성 및 gate 확인 |

품질 게이트:

- Pass: 모든 script가 dependency와 실제 코드 경로를 가진다.
- Block: 문서에 있는 script가 없거나, package script가 죽은 경로를 호출한다.

종료 기준:

- 새 엔지니어가 `bun install` 후 scripts만으로 현재 상태를 재현할 수 있다.

### 0-10. Phase B4. Runtime Boundary Split

진입 조건:

- Phase B3 완료

목표:

- live runtime, legacy code, future production code를 물리적으로 분리한다.

권장 분리:

```text
apps/api        # production backend, PRD 기준이면 NestJS
apps/web        # viewer / QA dashboard
packages/core
packages/contracts
packages/providers
packages/twin
packages/render
packages/glb
packages/qa
legacy/         # 현재 검증 대상에서 제외할 과거 코드
```

품질 게이트:

- Pass: supported path만 type-check/test 대상이다.
- Block: legacy/future 코드가 기본 검증을 깨뜨린다.

종료 기준:

- 폴더 구조가 도메인 책임과 검증 범위를 동시에 표현한다.

### 0-11. Phase B5. Production Pipeline Foundation

진입 조건:

- Phase B4 완료

목표:

- `/api/build`를 OSM-only shortcut이 아니라 PRD pipeline으로 올린다.

필수 계약:

- `SceneScope` core/context 생성
- provider별 `SourceSnapshot`
- partial snapshot state
- normalized entity bundle
- evidence graph
- twin scene graph
- render intent set
- mesh plan
- QA report
- build manifest

품질 게이트:

- Pass: provider raw schema가 GLB compiler에 닿지 않는다.
- Pass: build state가 manifest에 남는다.
- Pass: partial provider failure가 명시 상태로 기록된다.
- Block: `/api/build`가 provider shortcut으로 GLB를 바로 만든다.

종료 기준:

- GLB 품질과 무관하게 build lifecycle이 재현 가능하다.

### 0-12. Phase B6. GLB Fidelity Expansion

진입 조건:

- Phase B5 완료

목표:

- massing-only GLB에서 구조적 디지털 트윈으로 확장한다.

작업:

- `MeshPlanNode.primitive` 확장
- facade/roof/entrance/material/detail intent 추가
- visual evidence 없는 detail 차단
- `STRUCTURAL_TWIN`, `REALITY_TWIN` gate 강화

품질 게이트:

- Pass: `STRUCTURAL_TWIN`은 구조 evidence 기준을 통과해야 한다.
- Pass: `REALITY_TWIN`은 visual evidence source 없이 부여되지 않는다.
- Block: procedural detail이 reality score를 올린다.

종료 기준:

- “그럴듯한 도시”가 아니라 “근거 있는 도시”를 생성한다.

## 1. 문서 사용 규칙

### 1-1. 이 문서가 결정하는 것

- 어떤 bounded context를 먼저 복구할지
- 각 phase의 진입 조건, 목표, gate, 종료 기준
- 어떤 증거가 있어야 phase 완료라고 볼 수 있는지
- 어떤 작업은 이번 리메디에이션 범위에서 제외되는지

### 1-2. 이 문서가 결정하지 않는 것

- 세부 클래스명, 함수명, 디렉터리 구조 같은 로우 레벨 구현 상세
- 신규 지역 확장 로드맵
- 프론트엔드 렌더러 개선 계획
- 멀티 리전, 멀티 테넌시 같은 차세대 아키텍처 전환

### 1-3. 문서 작성 원칙

- 문장보다 표를 우선한다.
- 표보다 체크리스트를 우선한다.
- 체크리스트보다 증거 링크와 명령을 우선한다.
- 모든 phase는 같은 템플릿을 사용한다.
- `개선한다`, `안정화한다` 같은 모호한 표현만으로 phase를 닫을 수 없다.
- gate는 advisory가 아니라 binary다. 통과 또는 차단 둘 중 하나다.

## 2. Baseline Evidence

현재 상태는 빌드 성공과 런타임 신뢰성을 구분해서 봐야 한다.

| 항목 | 현재 값 | 의미 | 근거 |
|---|---:|---|---|
| Type check | pass | 정적 타입은 통과 | `bun run type-check` |
| Test | pass | 기존 테스트는 통과 | `bun test test` |
| Build | pass | 빌드는 통과 | `bun run build` |
| QA ready count | 0 | 실제 생성 결과는 준비 상태가 없음 | `bun run scene:qa-table` |
| QA failed count | 8 | 검증 대상 scene 전부 실패 | `data/scene/scene-qa-8-table.json` |
| observedAppearanceCoverage | 0.008 | 외관 관측 커버리지 거의 없음 | `data/scene/*.qa.json` |
| observedAppearanceRatio | 0.01 | appearance 증거 비율 거의 없음 | `data/scene/*.qa.json` |
| correctedCount | 3732 / 4002 | geometry correction 과도 적용 | `scene-akihabara-*.diagnostics.log` |
| buildingOverlapCount | 3662 | building overlap 대량 발생 | `scene-akihabara-*.diagnostics.log` |
| mapillaryUsed | false | facade 관측 소스 미사용 | `data/scene/*.detail.json` |
| detailStatus | PARTIAL | 생성 결과가 부분 상태 | `data/scene/*.json` |

### 2-1. Baseline 해석

현재 시스템은 다음 모순 상태다.

- 정적 검증은 녹색이다.
- 실제 장면 품질은 실패다.
- 운영 상태는 재시작에 취약하다.
- 외부 API 실패는 구조적으로 흡수되지 않는다.

따라서 이번 리메디에이션의 핵심은 “코드가 돌아간다”가 아니라 **도메인 불변식이 다시 지켜지게 만드는 것**이다.

## 3. DDD Domain Map

이 프로젝트는 파일 트리 기준이 아니라 도메인 책임 기준으로 다음 bounded context로 나눈다.

| Bounded Context | 책임 | Aggregate | Domain Service | Policy | Read Model | 핵심 불변식 |
|---|---|---|---|---|---|---|
| Access Control | 내부 API 접근 통제 | AccessPolicy | GlobalApiKeyGuard | Fail Closed | Public route exposure | private API는 인증 없이 열리면 안 된다 |
| Scene Request and Queue | scene 생성 요청 수락, 중복 억제, 큐 운영 | SceneJob | SceneGenerationService, SceneQueueManagerService | Single active job per sceneId | queue debug snapshot | scene 생성 상태는 재시작으로 사라지면 안 된다 |
| Scene Persistence | scene 및 파생 산출물 저장 | StoredScene | SceneRepository | Atomic persistence | bootstrap/detail/meta/twin/qa file set | scene와 파생 산출물은 논리적으로 일관돼야 한다 |
| Scene Composition | meta/detail/twin/validation/qa 생성 | SceneAggregate | generation pipeline services | READY only after valid composition | scene json family | 품질 실패 scene은 READY가 되면 안 된다 |
| Asset Build | mesh, material, glTF 합성 | BuiltAsset | GLB build pipeline | Material compatible mesh | base.glb | texture를 쓰는 mesh는 필요한 TEXCOORD를 가져야 한다 |
| Geospatial and Terrain | 좌표 변환, 고도 보간, geometry 보정 | SpatialFrame | terrain profile, correction services | Meter based geometry decisions | terrain diagnostics | 공간 연산은 degree 오차로 품질을 왜곡하면 안 된다 |
| Provider Integration | Google, Overpass, Mapillary, TomTom, Open Meteo 연동 | ProviderState | provider clients, fetch-json | Retries and degradation are provider specific | readiness, upstream envelopes | provider 실패는 분류되어야 하고 폭주 재시도로 번지면 안 된다 |
| Quality Gate and QA | 품질 판정, 배포 차단 신호 | QualityDecision | SceneQualityGateService, SceneMidQaService | Fail blocks release path | validation, qa report | QA fail과 READY 상태가 모순되면 안 된다 |
| Operations and Observability | health, metrics, alarms, deploy | RuntimeState | health service, metrics service | No silent failure | readiness, metrics, logs | 장애는 관측 가능해야 하며 상태는 휘발되면 안 된다 |

## 4. Domain Invariants

이 문서에서 강제로 복구해야 하는 핵심 불변식은 다음과 같다.

1. **Access invariant**
   - private endpoint는 유효한 API key 없이는 접근되면 안 된다.

2. **Persistence invariant**
   - `scene.json`, `meta`, `detail`, `twin`, `validation`, `qa`, `index`는 논리적으로 한 세트다.
   - 부분 저장 상태가 정상 상태처럼 읽히면 안 된다.

3. **Composition invariant**
   - `READY`는 실제 산출물과 품질 판단이 모두 일치할 때만 가능하다.

4. **Asset invariant**
   - texture 또는 material binding이 있는 primitive는 필요한 vertex attribute를 가져야 한다.

5. **Geospatial invariant**
   - 거리와 고도 계산은 meter 기준으로 일관돼야 한다.
   - 극단값, 고위도, degenerate polygon이 silently quality를 무너뜨리면 안 된다.

6. **Provider invariant**
   - provider별 rate limit, timeout, transient error는 구분되어야 한다.
   - provider 장애가 무제한 concurrency와 재시도 폭주로 확대되면 안 된다.

7. **Quality invariant**
   - QA fail but release pass 상태는 허용하지 않는다.

8. **Operations invariant**
   - 재시작, 배포, provider 장애 후에도 핵심 상태와 증거가 남아야 한다.

## 5. Problem Map by Bounded Context

### 5-1. Access Control

- `INTERNAL_API_KEY`가 비어 있으면 guard가 접근을 허용한다.
- debug endpoint가 production 구분 없이 노출된다.

깨진 불변식:

- private endpoint must fail closed

### 5-2. Scene Request and Queue

- queue, recent failures, processing state가 인메모리다.
- shutdown 30초 race 이후 pending scene 실패 처리가 거칠다.

깨진 불변식:

- scene generation state must survive restart and shutdown transitions

### 5-3. Scene Persistence

- multi file 저장이 순차 실행이라 partial write 가능성이 있다.
- parse 결과 구조 검증이 없다.
- cache와 file state의 일관성 보장이 약하다.

깨진 불변식:

- stored scene family must be atomically readable as one logical unit

### 5-4. Scene Composition

- quality gate와 QA가 분리돼 quality fail과 READY 판정이 어긋날 수 있다.
- `detailStatus=PARTIAL`, `mapillaryUsed=false`가 반복되는데 release gating이 약하다.

깨진 불변식:

- READY must imply composition quality, not just pipeline completion

### 5-5. Asset Build

- `TEXCOORD_0` 경로가 없다.
- triangulation 실패 시 box fallback으로 외형을 숨긴다.
- geometry correction 과다 적용이 품질 문제를 덮는다.

깨진 불변식:

- renderable asset must preserve material compatibility and geometric intent

### 5-6. Geospatial and Terrain

- IDW 보간이 degree distance를 사용한다.
- `cos(lat)` 근사로 고위도 왜곡이 크다.
- DEM fused와 flat placeholder가 혼재한다.

깨진 불변식:

- spatial decisions must use physically meaningful distance and terrain state

### 5-7. Provider Integration

- provider별 retry policy가 약하다.
- Open Meteo concurrency 제한을 지키지 않는다.
- circuit breaker가 없다.

깨진 불변식:

- provider degradation must be explicit, bounded, and observable

### 5-8. Quality Gate and QA

- retry, stale lock, parse failure, gate failure 테스트가 약하다.
- mock 위주 테스트로 실제 실패 경로가 가려진다.

깨진 불변식:

- quality decision must be reproducible by automated evidence

### 5-9. Operations and Observability

- metrics와 alerts가 영속적이지 않다.
- CI는 build까지만 있고 deploy gate가 없다.
- readiness가 실제 기능 상실을 완전히 반영하지 못한다.

깨진 불변식:

- runtime failure must be externally visible and actionable

## 6. Remediation Standards

모든 phase는 아래 표준을 따라야 한다.

| 표준 | 설명 |
|---|---|
| Fail Closed | 보안, 계약, gate는 기본 허용이 아니라 기본 차단 |
| Atomic Persistence | 한 논리 scene 저장은 한 단위처럼 읽히고 복구돼야 함 |
| No Silent Degradation | fallback은 상태, 원인, 영향이 명시돼야 함 |
| Bounded Concurrency | provider와 대형 scene 처리는 상한이 있어야 함 |
| Evidence First | phase 완료 주장은 수치, 로그, 테스트, 파일 증거가 있어야 함 |
| Gate Before Exit | gate 통과 없는 완료 기준은 무효 |
| Context Ownership | 변경은 항상 어느 bounded context의 aggregate, service, policy를 건드리는지 적어야 함 |

## 7. Phase Template

모든 phase는 아래 형식을 그대로 사용한다.

### Phase N. 이름

진입 조건:

- 이전 phase gate 통과

목표:

- 이 phase가 복구하려는 도메인 상태

대상 bounded context:

- 영향을 받는 context 목록

변경 대상:

- aggregate
- domain service
- policy
- read model

핵심 불변식:

- 이 phase가 복구해야 하는 invariant 목록

작업:

- 구현 작업 목록

품질 게이트:

- 통과 조건
- 차단 조건
- 증거 명령 또는 산출물

종료 기준:

- phase가 닫히기 위한 binary 조건

체크리스트:

- model
- code
- tests
- ops
- docs

롤백 기준:

- 어떤 상황이면 phase 결과를 되돌려야 하는지

## 8. Phase Ordering Rule

phase 순서는 기술 우선순위가 아니라 도메인 의존성 순서다.

1. Safety without integrity is meaningless.
2. Integrity without fidelity is misleading.
3. Fidelity without correctness is cosmetic.
4. Correctness without resilience is unstable.
5. Resilience without scale is fragile.
6. Scale without tests is untrustworthy.
7. Tests without operations maturity are unshippable.

## 9. Phase 1. Safety and Invariant Restoration

현재 상태:

- code / tests / ops / docs 반영 완료
- model 문서화는 추가 정리가 필요함
- 본 phase의 핵심 불변식(private fail closed, QA fail blocks READY, degraded dependency visibility)은 코드/테스트/운영 문서 기준으로 충족됨

진입 조건:

- baseline evidence가 기록되어 있을 것

목표:

- private API가 열려 있는 상태와 잘못된 READY 판정을 먼저 차단한다.

대상 bounded context:

- Access Control
- Scene Composition
- Quality Gate and QA
- Operations and Observability

변경 대상:

- AccessPolicy
- QualityDecision
- readiness policy

핵심 불변식:

- private endpoint must fail closed
- QA fail must block READY
- degraded dependency must not look healthy

작업:

- API key 미설정 fail close
- production debug route 차단
- READY 승격 경로 재정의
- readiness 필수 기능 상태 반영

품질 게이트:

- **Safety Gate**
  - Pass rule: 인증 없는 private 요청이 401 또는 403으로 차단됨
  - Block rule: 미설정 환경에서 private route 접근 가능
  - Evidence: 보안 테스트, curl 재현 기록

- **Decision Gate**
  - Pass rule: QA fail scene이 READY가 아님
  - Block rule: quality fail인데 READY 또는 bootstrap 제공
  - Evidence: representative scene result set

종료 기준:

- 인증 우회 재현이 불가능할 것
- readiness가 기능 상실을 숨기지 않을 것
- QA fail but READY 사례가 0일 것

체크리스트:

- [ ] model: Access policy와 Quality decision rule이 문서화되었다
- [X] code: fail close와 READY blocking 경로가 구현되었다
- [X] tests: 인증 우회와 quality fail state transition 테스트가 추가되었다
- [X] ops: readiness 판정 기준이 운영 문서에 반영되었다
- [X] docs: 본 phase 결과가 문서와 README에 반영되었다

롤백 기준:

- health endpoint가 정상 동작을 못 하거나 기존 public route를 잘못 차단할 경우

## 10. Phase 2. Persistence and Contract Recovery

현재 상태:

- code 반영 완료
- corrupted / partial / malformed read contract 테스트는 반영 완료
- model / ops / bootstrap contract versioning 문서는 아직 미반영
- auto-repair / regeneration은 이번 phase에서 구현하지 않고 fail closed + explicit corruption으로 제한함

진입 조건:

- Safety Gate 통과

목표:

- scene family 저장을 논리적으로 atomic하게 만들고 read contract를 복구한다.

대상 bounded context:

- Scene Persistence
- Scene Composition

변경 대상:

- StoredScene aggregate
- SceneRepository
- bootstrap/read contracts

핵심 불변식:

- one logical scene must not be partially readable as valid

작업:

- multi file atomicity 설계
- parse/schema validation 도입
- damaged artifact detection 도입
- repair 또는 regeneration flow 도입

품질 게이트:

- **Contract Gate**
  - Pass rule: bootstrap, validation, qa, detail contract schema 전부 통과
  - Block rule: 손상 파일이 정상 scene처럼 읽힘
  - Evidence: contract tests, corrupted fixture tests

- **Persistence Gate**
  - Pass rule: partial write 시 복구 또는 명시 실패
  - Block rule: orphan artifact가 조용히 남음
  - Evidence: failure injection integration test

종료 기준:

- 손상된 JSON은 undefined가 아니라 명시 오류로 처리될 것
- partial write 재현 시 정상 READY scene으로 읽히지 않을 것

체크리스트:

- [ ] model: StoredScene family consistency rule이 문서화되었다
- [X] code: repository read/write path에 schema validation이 들어갔다
- [ ] tests: partial write, parse failure, repair flow 테스트가 추가되었다
- [ ] ops: corrupted scene 복구 절차가 운영 문서에 추가되었다
- [ ] docs: bootstrap contract versioning 정책이 문서화되었다

롤백 기준:

- 기존 scene를 더 이상 읽지 못하는 호환성 파손이 발생할 경우

## 11. Phase 3. Asset Fidelity and Geometry Recovery

현재 상태:

- code 반영 완료
- glTF preflight fail closed, TEXCOORD_0 경로, triangulation fallback evidence, correctedRatio advisory signal 반영 완료
- representative smoke 기준 Shibuya / Akihabara는 더 이상 TEXCOORD preflight로 실패하지 않음
- representative scene 최신 결과는 Shibuya / Akihabara 모두 `qualityGate=PASS`, `scene.status=READY`, `QA summary=WARN` 상태다
- representative scene의 `observed_coverage`는 baseline(0.008) 대비 증가했고 latest representative evidence는 Shibuya `0.056`, Akihabara `0.056`이다
- Visual Gate close 기준은 representative `observedAppearanceCoverage >= 0.05`, baseline 대비 5배 이상 증가, 대표 landmark/highrise scene의 `fallbackMassingRate = 0`으로 정량화한다
- latest representative evidence 기준으로 Phase 3 종료 기준은 충족된 상태다

진입 조건:

- Contract Gate 통과

목표:

- 외관 부재와 박스 fallback 중심의 asset 품질 붕괴를 복구한다.

대상 bounded context:

- Asset Build
- Scene Composition

변경 대상:

- BuiltAsset aggregate
- GLB build services
- geometry correction policies

핵심 불변식:

- textured asset must carry compatible vertex attributes
- fallback must be explicit and measurable

작업:

- TEXCOORD 경로 도입
- material compatibility validation
- glTF validator 연동
- triangulation failure taxonomy 도입
- geometry correction 정책 재설계

품질 게이트:

- **Fidelity Gate**
  - Pass rule: glTF validator error 0
  - Block rule: texture binding이 있는데 TEXCOORD 누락
  - Evidence: validator output

- **Visual Gate**
  - Pass rule: representative scene의 `observedAppearanceCoverage >= 0.05` 이고 baseline 대비 5배 이상 증가한다
  - Block rule: fallback box 비율이 감소하지 않음
  - Evidence: QA diff report, representative scene screenshots or metrics
  - Current representative evidence: baseline `observedAppearanceCoverage=0.008` → latest Shibuya `0.056`, Akihabara `0.056`; both representative scenes report `fallbackMassingRate=0`

종료 기준:

- validator error 0
- representative scene에서 `observedAppearanceCoverage >= 0.05` 이고 baseline 대비 5배 이상 증가
- 랜드마크/고층 scene의 fallback 비율 감소

체크리스트:

- [X] model: asset fidelity rule과 fallback taxonomy가 정의되었다
- [X] code: UV, material compatibility, fallback classification이 구현되었다
- [X] tests: glTF contract와 representative scene regression test가 추가되었다
- [X] ops: asset validation 결과를 CI에서 확인 가능하다
- [X] docs: asset build quality rule이 문서화되었다
- model evidence:
  - textured asset: texture binding이 있는 primitive는 compatible vertex attributes(`TEXCOORD_0`)를 반드시 가져야 한다
  - fallback taxonomy:
    - `polygon_budget_exceeded` / `polygon_budget_reserved_for_critical`: 예산 제한으로 인한 skip
    - `missing_source`: upstream source 부재로 인한 skip
    - `empty_or_invalid_geometry`: geometry 정합성 실패로 인한 skip
    - `TRIANGULATION_FALLBACK`: build는 지속하되 evidence-only metric으로 노출되는 geometry fallback
  - advisory-only signals:
    - `triangulationFallbackCount`
    - `correctedRatio`
- ops evidence:
  - CI는 `.github/workflows/ci.yml`에서 `bun run type-check`, `bun run test`, `bun run build`를 수행한다
  - Phase 3 관련 회귀 증거는 `test/phase3-texcoord-preflight.spec.ts`, `test/phase3-texcoord-geometry.spec.ts`, `test/phase3-triangulation-fallback-metric.spec.ts`, `test/phase3-observed-coverage-mapillary.spec.ts`로 확인한다

롤백 기준:

- validator 통과는 하지만 실제 mesh가 더 많이 깨질 경우

## 12. Phase 4. Geospatial Correctness

현재 상태:

- meter-based IDW interpolation이 적용되었다 (`scene-terrain-profile.service.ts`의 `haversineDistanceMeters` 기반)
- representative geospatial edge case는 고위도 / degenerate footprint / no DEM fixture 테스트로 검증 가능하다
- terrain mode contract(`DEM_FUSED`, `FLAT_PLACEHOLDER`)와 `heightReference`는 diagnostics와 domain contract에 명시된다
- terrain fallback 상태는 diagnostics log와 profile metadata에서 관측 가능하다

진입 조건:

- Fidelity Gate 통과

목표:

- 고도, 거리, 좌표 변환의 수학적 의미를 복구한다.

대상 bounded context:

- Geospatial and Terrain

변경 대상:

- SpatialFrame aggregate
- terrain interpolation services
- geometry correction helpers

핵심 불변식:

- distance based decisions must use meter based distance
- terrain mode must be explicit

작업:

- IDW meter distance 수정
- 고위도 변환 전략 개선
- terrain mode contract 분리
- degenerate geometry handling 개선

품질 게이트:

- **Geography Gate**
  - Pass rule: high latitude, degenerate footprint, no DEM fixtures가 기대 상태를 반환
  - Block rule: degree based interpolation이 남아 있음
  - Evidence: geo edge case tests

종료 기준:

- meter based interpolation으로 전환 완료
- terrain mode가 diagnostics와 contract에 명시됨
- 고위도/degenerate fixture 테스트 통과

체크리스트:

- [X] model: terrain mode와 spatial correctness invariant가 명시되었다
- [X] code: interpolation과 transform 경로가 수정되었다
- [X] tests: high latitude, invalid polygon, no DEM fixture가 추가되었다
- [X] ops: terrain fallback 상태가 관측 가능하다
- [X] docs: geospatial assumptions와 한계가 문서화되었다
- model evidence:
  - terrain mode contract:
    - `DEM_FUSED`: DEM sample 기반 terrain profile이며 `hasElevationModel=true`
    - `FLAT_PLACEHOLDER`: DEM 부재 또는 sample 부족 fallback이며 `hasElevationModel=false`
  - spatial correctness invariant:
    - interpolation decisions must use physical meter distance, not raw degree delta
    - terrain state must be explicit through `mode`, `source`, `heightReference`
- code evidence:
  - `src/scene/services/spatial/scene-terrain-profile.service.ts`: IDW가 raw degree delta 대신 `haversineDistanceMeters`를 사용한다
  - `src/places/utils/geo.utils.ts`, `src/scene/utils/scene-spatial-frame.utils.ts`: extreme latitude에서 longitude scale collapse를 막기 위한 clamp가 반영되었다
  - `src/places/domain/building-footprint.value-object.ts`: zero-area degenerate footprint를 reject한다
- test evidence:
  - `test/phase9-terrain-profile.spec.ts`: meter-based interpolation 및 no-DEM resolve fallback 검증
  - `test/phase9-terrain-fusion.spec.ts`: terrain mode/no-DEM fallback contract 검증
  - `test/phase4-high-latitude-spatial.spec.ts`: high latitude bounds / metersPerDegree / round-trip 검증
  - `test/phase4-degenerate-geometry.spec.ts`: invalid polygon / degenerate footprint fixture 검증
- ops evidence:
  - `scene-terrain-profile.service.ts`의 `logFlatProfile()`는 `mode`, `source`, `hasElevationModel`, `heightReference`, `sampleCount`, `sourcePath`를 diagnostics에 기록한다
  - `scene-terrain-fusion.step.ts`는 no-DEM fallback 시 `terrainProfile.mode=FLAT_PLACEHOLDER`를 diagnostics에 남긴다
  - CI는 `.github/workflows/ci.yml`에서 `bun run test`를 실행하므로 Phase 4 테스트도 함께 검증된다

롤백 기준:

- 일반 위도 scene의 결과가 광범위하게 악화될 경우

## 13. Phase 5. Provider Resilience

현재 상태:

- provider별 retry matrix가 `fetch-json.ts`에 반영되었다
- Open Meteo client는 in-memory 직렬화 큐로 upstream fetch concurrency를 1로 제한한다
- provider-scoped in-memory circuit breaker가 추가되었고 `open-meteo` scope 기준으로 상태를 공유한다
- readiness surface는 `providerHealth` snapshot으로 degraded/open provider 상태를 노출한다
- breaker state와 fast rejection은 metrics로 관측 가능하다

진입 조건:

- Geography Gate 통과

목표:

- provider 실패가 무제한 재시도와 silent degradation으로 번지지 않게 한다.

대상 bounded context:

- Provider Integration
- Operations and Observability

변경 대상:

- ProviderState
- fetch policies
- provider health read models

핵심 불변식:

- retries must be provider specific
- concurrency must be bounded
- degradation must be explicit

작업:

- provider별 retry matrix 구현
- Open Meteo 직렬화 큐
- circuit breaker 도입
- 429, timeout, 5xx 구분 메트릭 추가

품질 게이트:

- **Resilience Gate**
  - Pass rule: provider 장애 주입 시 retry 폭주 없음, degraded state 식별 가능
  - Block rule: 동일 실패가 Promise 폭주 또는 retry storm로 증폭
  - Evidence: fault injection test, metrics snapshot

종료 기준:

- provider별 retry policy 문서화 및 구현 완료
- Open Meteo concurrency 위반이 재현되지 않음
- circuit breaker 상태 전이가 관측됨

체크리스트:

- [X] model: provider failure taxonomy가 정의되었다
- [X] code: retry, queue, breaker가 provider별로 구현되었다
- [X] tests: 429, timeout, 5xx fault injection 테스트가 추가되었다
- [X] ops: provider health metrics와 alerts 기준이 정의되었다
- [X] docs: provider policy matrix가 문서화되었다
- model evidence:
  - provider failure taxonomy:
    - `rateLimit`: HTTP 429 / `Retry-After` 기반 backoff 대상
    - `timeout`: `TimeoutError` 기반 transient failure
    - `serverError`: HTTP 5xx 계열 retryable provider failure
    - non-retryable 4xx는 circuit breaker failure로 누적되지 않는다
  - provider state model:
    - breaker state: `closed` / `open` / `half-open`
    - health snapshot state: `healthy` / `degraded` / `open`
- code evidence:
  - `src/common/http/fetch-json.ts`: provider-specific retry policy, fault classification, fast rejection, breaker integration
  - `src/places/clients/open-meteo.client.ts`: bounded concurrency semaphore(1)로 직렬화 큐 구현
  - `src/common/http/circuit-breaker.ts`: provider-scoped in-memory circuit breaker 및 normalization(`open-meteo`)
  - `src/health/health.service.ts`: readiness에 `providerHealth` snapshot 노출
- test evidence:
  - `test/phase5-provider-resilience.spec.ts`: 429 / timeout / 5xx fault injection, retry matrix, Open Meteo serialization, breaker state transition 검증
  - `test/health-readiness.spec.ts`: readiness `providerHealth` snapshot 및 required readiness semantics 유지 검증
- ops evidence:
  - metrics:
    - `external_api_requests_total`
    - `external_api_request_duration_ms`
    - `circuit_breaker_state`
    - `circuit_breaker_rejections_total`
  - provider health snapshot:
    - `GET /api/health/readiness`
    - `providerHealth.providers[*].provider/state/failureCount/lastTransitionAt`
  - alert 기준(최소 운영 기준):
    - `circuit_breaker_state{provider="open-meteo"} == 2` 지속
    - `circuit_breaker_rejections_total` 급증
    - `external_api_requests_total{outcome="failure"}` 비율 상승
- provider policy matrix:
  - `open-meteo`: retryOn=`rateLimit,serverError`, maxRetries=3, breaker+serialization 적용
  - `google-places`: retryOn=`rateLimit`, maxRetries=2
  - `tomtom`: retryOn=`rateLimit,timeout`, maxRetries=2
  - `mapillary`: retryOn=`rateLimit,serverError`, maxRetries=2
  - `overpass`: retryOn=`rateLimit,timeout,serverError`, maxRetries=3

롤백 기준:

- 정상 provider latency가 크게 상승하거나 성공 경로가 과도하게 차단될 경우

## 14. Phase 6. Scale and Throughput Stabilization

진입 조건:

- Resilience Gate 통과

목표:

- 4k+ building scene에서 처리 시간과 메모리 사용이 폭발하지 않도록 한다.

대상 bounded context:

- Asset Build
- Scene Request and Queue
- Provider Integration

변경 대상:

- overlap policies
- queue processing model
- diagnostics write policy

핵심 불변식:

- large scene processing must remain bounded in time, memory, and concurrency

작업:

- spatial index 도입
- Promise concurrency limit 도입
- diagnostics batching
- queue throughput 개선

품질 게이트:

- **Scale Gate**
  - Pass rule: representative large scene benchmark가 목표 범위 내
  - Block rule: O(N^2) overlap path가 여전히 주요 병목
  - Evidence: benchmark output, memory snapshot

종료 기준:

- 대표 대형 scene 생성 시간이 baseline 대비 유의미하게 감소
- 메모리 사용량과 외부 API 동시 요청 수가 상한 내

체크리스트:

 - [x] model: bounded concurrency와 throughput policy가 정의되었다
 - [x] code: overlap, Promise, diagnostics 병목 개선이 구현되었다
 - [x] tests: benchmark와 load fixture가 추가되었다
 - [x] ops: throughput metrics가 수집된다
 - [x] docs: large scene 운영 한계와 기준이 문서화되었다

롤백 기준:

- 처리량은 증가했지만 품질이나 correctness가 크게 떨어질 경우

## 15. Phase 7. Quality Gate and Regression Hardening

진입 조건:

- Scale Gate 통과

목표:

- 지금까지 복구한 상태가 회귀하지 않도록 자동 증거 체계를 강화한다.

대상 bounded context:

- Quality Gate and QA
- Scene Composition
- Scene Persistence

변경 대상:

- QualityDecision aggregate
- regression test suite

핵심 불변식:

- quality decision must be automatically reproducible

작업:

- retry, stale lock, parse failure, gate fail 테스트 추가
- representative scene regression suite 구축
- release blocking rules 문서화

품질 게이트:

- **Regression Gate**
  - Pass rule: representative scene suite 전부 통과
  - Block rule: QA fail but release pass 상태가 존재
  - Evidence: CI reports, qa-table diff

종료 기준:

- 주요 실패 경로가 자동 테스트에 포함됨
- representative scene regression suite가 CI 필수 단계가 됨

체크리스트:

- [X] model: quality decision lifecycle이 문서화되었다
- [X] code: release blocking rules가 반영되었다
- [X] tests: regression suite와 failure path tests가 추가되었다
- [X] ops: qa-table 재생성 절차와 기준이 문서화되었다
- [X] docs: QA fail but release pass 금지 정책이 문서화되었다

Phase 7 현재 상태:

- code / tests / ops / docs 반영 완료
- model 문서는 domain invariant (§4), Quality Gate Matrix (§17), Regression Gate 정의 충족
- 본 phase의 핵심 불변식(QA fail but release pass 금지, representative live evidence gate 운영)은 core 5-scene 기준으로 충족됨
- release blocking rules 구현 증거:
  - `test/phase1-qa-fail-blocks-ready.spec.ts`: QA summary=FAIL 시 status=FAILED, failureCategory=QA_REJECTED 검증
  - `test/phase7-representative-regression.spec.ts`: representative 8-scene QA table contract 검증
  - `test/phase7-qa-table-gate.spec.ts`: core 5-scene gate fail-closed, tail 3-scene non-blocking 검증
  - `test/phase7-failure-paths.spec.ts`: parse failure, stale lock, retry, QUALITY_GATE_REJECTED, QA_REJECTED 검증
  - `test/phase7-weather-provider.spec.ts`: weather provider fallback → UNKNOWN provider 검증
  - `test/phase7-traffic-provider.spec.ts`: traffic provider fallback → UNAVAILABLE provider 검증
  - `test/phase3-regression-evidence.spec.ts`: UV contract + preflight + triangulation fallback + correctedRatio 통합 회귀 검증
  - `scripts/generate-test-scenes.ts`: 8개 representative scene live evidence 생성 (`bun run scene:generate-test-scenes`)
  - `scripts/build-scene-qa-table.ts`: 8개 representative scene에 대한 QA table 재생성 및 core gate (`bun run scene:qa-table`)
- ops / docs 문서화:
  - `docs/deployment-guide.md` §4: release-blocking rules 및 QA 정책
  - `docs/operations-manual.md` §8: qa-table 재생성 절차 및 representative regression suite 운영

롤백 기준:

- 테스트는 늘었지만 false positive가 높아 팀이 gate를 우회하기 시작할 경우

## 16. Phase 8. Operations and Release Maturity

진입 조건:

- Regression Gate 통과

목표:

- 시스템을 실제 운영 가능한 수준으로 만든다.

대상 bounded context:

- Operations and Observability
- Scene Request and Queue
- Provider Integration

변경 대상:

- RuntimeState aggregate
- metrics and alerting policy
- deploy policy

핵심 불변식:

- failure must be observable
- runtime state must survive restart where required
- release must pass deploy gate, not just build

작업:

- queue and failure state 영속화
- external metrics backend 연동
- Slack or PagerDuty alarm 연동
- deploy and canary gate 추가

품질 게이트:

- **Ops Gate**
  - Pass rule: restart 후 핵심 상태와 metrics가 유지되거나 복구 가능
  - Block rule: 장애가 로그 없이 지나가거나 alert가 없음
  - Evidence: restart drill, alert drill, deploy drill

- **Release Gate**
  - Pass rule: build, test, regression, canary verification 통과
  - Block rule: build green만으로 배포 가능
  - Evidence: CI/CD pipeline result

종료 기준:

- 재시작, provider 장애, 배포 테스트에서 운영 절차가 검증됨
- 알람과 관측성 경로가 실제로 동작함
- CI가 build only가 아니라 release gate까지 포함함

체크리스트:

- [ ] model: 운영 상태와 release policy가 명시되었다
- [ ] code: 상태 영속화, metrics export, alert hooks가 구현되었다
- [ ] tests: restart drill과 deploy drill이 자동화되었다
- [ ] ops: alert runbook과 rollback 절차가 운영 문서에 반영되었다
- [ ] docs: release gate와 on call 기준이 문서화되었다

롤백 기준:

- 운영 절차가 지나치게 복잡해져 실제 배포를 막기만 하고 보호하지 못할 경우

## 17. Quality Gate Matrix

| Gate | 목적 | Pass Rule | Block Rule | Evidence |
|---|---|---|---|---|
| Safety Gate | 인증, 공개 범위, READY blocking | 인증 우회 없음 | private route 노출 | 보안 테스트 |
| Contract Gate | 저장/읽기 계약 | 손상 파일 명시 실패 | partial valid read | contract tests |
| Fidelity Gate | glTF/mesh 품질 | validator error 0 | TEXCOORD mismatch | validator output |
| Geography Gate | 공간 연산 정확성 | edge case 통과 | degree distance 의사결정 | geo tests |
| Resilience Gate | provider 실패 흡수 | retry storm 없음 | 무제한 재시도 | fault injection |
| Scale Gate | 대형 scene 처리량 | benchmark target 달성 | O(N^2) 병목 유지 | benchmark |
| Regression Gate | 회귀 방지 | representative suite 통과 | QA fail but release pass | CI report |
| Ops Gate | 운영 가시성 | alert, state, drill 정상 | silent failure | drill result |
| Release Gate | 배포 통제 | build 이상 단계 통과 | build green only | pipeline result |

## 18. Checklist Rules

체크리스트는 아래 규칙을 만족해야 한다.

1. 모든 항목은 binary여야 한다.
2. 한 항목은 하나의 결과만 말해야 한다.
3. 각 항목은 다음 중 하나와 연결되어야 한다.
   - 테스트 파일
   - 실행 명령
   - 산출물 파일
   - 메트릭
   - 로그
4. 각 phase는 최소 다섯 범주를 모두 포함해야 한다.
   - model
   - code
   - tests
   - ops
   - docs
5. 체크리스트가 비어 있거나 증거 연결이 없으면 phase 완료를 주장할 수 없다.

## 19. Final Sign Off Checklist

- [ ] private API 인증 우회가 제거되었다
- [ ] scene family partial write가 정상 상태처럼 읽히지 않는다
- [ ] representative scene에서 QA fail but READY 사례가 없다
- [ ] glTF validator error가 0이다
- [ ] 지리 edge case 테스트가 통과한다
- [ ] provider fault injection 테스트가 통과한다
- [ ] 대형 scene benchmark가 기준을 통과한다
- [ ] representative scene regression suite가 CI 필수 단계다
- [ ] restart, alert, deploy drill이 검증되었다
- [ ] 운영 문서, 배포 문서, phase 문서가 최신 상태다

## 20. Out of Scope

- 신규 도시/지역 확장 전략
- 프론트엔드 렌더러 자체 품질 개선
- 멀티 리전, 멀티 테넌시 전환
- 완전한 데이터베이스 아키텍처 전환

## 21. Reference Documents

- `README.md`
- `docs/architecture.md`
- `docs/hybrid-phase-plan.md`
- `docs/deployment-guide.md`
- `docs/operations-manual.md`
- `docs/scene-validation-and-benchmark.md`
