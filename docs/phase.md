
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
