# WorMap v2 코드베이스 전면 분석 및 Phase 1.5 회고록

**작성일**: 2026-04-27  
**작성자**: Sisyphus (AI Agent)  
**대상**: WorMap v2 Digital Twin 프로젝트  
**범위**: 전체 코드베이스 분석 + Phase 1.5 Schema Hardening 구현

---

## 1. 프로젝트 개요

WorMap v2는 "현실 장소를 근거 기반의 정규화된 Twin Scene Graph로 만들고, 검증 가능한 3D 산출물(GLB)로 컴파일"하는 파이프라인입니다. PRD v2.3는 architecture-first, contract-first, fixture-first 접근을 요구합니다.

**핵심 계약**:
```text
Raw provider schema must never reach the GLB compiler.
```

---

## 2. 초기 코드베이스 상태 분석

### 2.1 아키텍처 평가

| 영역 | 등급 | 근거 |
|---|---|---|
| **아키텍처 정합성** | D | PRD의 NestJS, monorepo, 계약 경계 미준수 |
| **타입 계약 완성도** | C | 타입은 존재하나 런타임 검증 없음, raw schema 누수 |
| **Provider 계층** | C- | 실제 HTTP 호출은 하지만 계약 미준수, compliance 불완전 |
| **Twin/Graph 계층** | D+ | Evidence Graph는 유령, Relationship 계산 없음 |
| **Render Intent** | C | 기본 분기만, Confidence threshold 미적용 |
| **Mesh Plan** | C- | Flat 1:1 매핑, Parent hierarchy 없음 |
| **GLB Compiler** | C- | earcut/meshoptimizer 사용하나 geometry 버그, compression 100% 실패 |
| **QA Gate** | D+ | Material ref 체크만, 6가지 QA category 중 1개만 부분 구현 |
| **테스트/픽스처** | C | Fixture 존재, 그러나 3 fail/3 error, geometry correctness 테스트 없음 |
| **API 연결 안전성** | D+ | division by zero, 빈 배열 crash, zoom level 오류, 429 rate limit |
| **환경변수 관리** | C- | API 키 노출, 사용 안 하는 env var 다수, 이중 접근 패턴 |
| **Dead Code** | D | scene/ 2/3 dead, NestJS 잔재물 다수, health.service.ts dead |
| **Type Safety** | C | any/ts-ignore 없음, 그러나 as assertions 19개, ! 15개 |
| **런타임 안전성** | C- | NaN/Infinity propagation, JSON.parse unvalidated, empty catch 18개 |

### 2.2 발견된 심각한 버그들 (P0 — 오늘 배포하면 내일 100% 깨짐)

| # | 위치 | 버그 | 결과 |
|---|------|------|------|
| 1 | `tomtom-traffic.adapter.ts:32` | zoom level `89` (유효 범위 0-22 초과) | 400 Bad Request |
| 2 | `tomtom-traffic.adapter.ts:47` | `freeFlowTravelTime` 0 division | Infinity |
| 3 | `google-places.adapter.ts:79` | `p.displayName.text` | undefined 시 TypeError crash |
| 4 | `open-meteo.adapter.ts:59-66` | 빈 배열 → `Math.min(...[])` | -Infinity |
| 5 | `providers.module.ts:12-13` | API key `''` → 401/403 | 인증 실패 |
| 6 | `osm-scene-build.service.ts:34-39` | `Promise.all` 병렬 호출 | Overpass 429 rate limit |
| 7 | `coordinates/index.ts:45-47` | `ecefToWgs84` r=0 → NaN | silent corruption |
| 8 | `.env` | API 키 하드코딩 노출 | 보안 취약점 |

### 2.3 환경변수 실사용 현황

| 환경변수 | .env 존재 | 코드 실제 사용 | 상태 |
|---|---|---|---|
| `PORT` | ✅ | `src/index.ts` | 정상 |
| `GOOGLE_API_KEY` | ✅ | `providers.module.ts` + `health.service.ts` | ⚠️ 이중 접근, 빈값 시 401 |
| `TOMTOM_API_KEY` | ✅ | `providers.module.ts` + `health.service.ts` | ⚠️ 이중 접근, 빈값 시 401 |
| `OVERPASS_API_URLS` | ✅ | `health.service.ts`만, adapter 미사용 | 🔴 불일치 |
| `OPEN_METEO_BASE_URL` | ✅ | **0회 참조** | 🔴 죽은 env var |
| `MAPILLARY_ACCESS_TOKEN` | ✅ | health만, adapter 없음 | 🔴 dead code |

### 2.4 NestJS 미사용 확인

- `package.json`에 NestJS 의존성 없음
- `src/index.ts`는 `Bun.serve()` 사용
- `health.service.ts`, `scene-generation.service.ts` 등 NestJS `@Injectable()` 코드는 **인스턴스화되지 않는 dead code**
- `nest-cli.json`은 코드베이스 전체에서 0회 참조

### 2.5 Dead Code 목록

| 파일 | 상태 | 이유 |
|---|---|---|
| `src/scene/services/generation/scene-generation.service.ts` | DEAD | 존재하지 않는 파일 4개 import |
| `src/scene/services/generation/scene-queue-manager.service.ts` | DEAD | production 미등록 |
| `src/health/health.service.ts` | DEAD | NestJS 미사용으로 인스턴스화 불가 |
| `scripts/generate-test-scenes.ts` | BROKEN | `@nestjs/testing` import |
| `test/phase6-*.spec.ts` | BROKEN | `@nestjs/testing` import |
| `test/phase8-*.spec.ts` (3개) | BROKEN | `@nestjs/testing` 또는 `../metrics/metrics.instance` |
| `nest-cli.json` | DEAD | 0회 참조 |

### 2.6 타입 안전성 탈출구 완전 재고

| 카테고리 | 개수 | 가장 위험한 예시 |
|---|---|---|
| `as` type assertions | 19개 | `health.service.ts:59` — private property 직접 접근 |
| `!` non-null assertions | 15개 | `glb-compiler.service.ts:275` — earcut output |
| `any` types | 5개 | `scripts/build-scene-qa-table.ts` |
| `JSON.parse` without validation | 6개 | `scene-storage.utils.ts:30` |
| empty `catch` blocks | 18개 | 대부분 intentional, 일부 무시 |
| division by zero | 4개 | `tomtom-traffic.adapter.ts:47` |

---

## 3. Phase 1.5 Schema Hardening 구현

### 3.1 Oracle 상담 결과

- **Phase 1은 이미 완료**: TypeScript types만으로 PRD 기준 충족
- **zod는 권장사항, 필수 아님**: PRD Section 19 (GLB Compiler)에서만 언급
- **그러나 geometry discriminated union은 실질적 가치 있음**: `Record<string, unknown>` 제거가 핵심
- **마이그레이션 전략**: 기존 TypeScript types 유지 + parallel zod schemas 추가 (Option A)

### 3.2 Momus 검토 결과

- **Wave 2 병렬 → 순차**: `MeshPlanNode.geometry` 변경이 6개 이상 파일에 영향
- **glb-compiler 리팩토링 필수**: `(geometry as {...})` → `switch (geometry.kind)`
- **각 wave 후 `bun run type-check` 필수**

### 3.3 구현 상세

#### Wave 1: zod 설치
- `zod@4.3.6` 설치

#### Wave 2: Geometry Discriminated Union
- `packages/core/geometry/mesh-geometry.ts` 생성
  - `BuildingMeshGeometry`, `RoadMeshGeometry`, `WalkwayMeshGeometry`, `PoiMeshGeometry`, `TerrainMeshGeometry`
  - `kind` field discriminator
  - `z.discriminatedUnion('kind', [...])` schema
- `packages/core/geometry/geometry.schema.ts` 생성
  - `LocalPointSchema`, `LocalPolygonSchema`

#### Wave 3: 10개 Contract Zod Schemas
- 8개 `*.schema.ts` 파일 생성
- `packages/core/schemas/index.ts`에 `SchemaVersionSetSchema`
- `packages/contracts/index.ts`에서 re-export

#### Wave 4: Record<string, unknown> 제거 + GLB Compiler 리팩토링
- `MeshPlanNode.geometry` → `MeshGeometry`
- `NormalizedEntity.geometry` → `MeshGeometry`
- `glb-compiler.service.ts`: unsafe casts → `switch (geometry.kind)`
- `mesh-plan-builder.service.ts`: `resolveGeometry()` 추가
- `normalized-entity-builder.service.ts`: `toMeshGeometry()` 추가
- `twin-entity-projection.service.ts`: unsafe casts 제거

#### Wave 5: Validate Helpers
- `packages/contracts/validate.ts` 생성
- 10개 `validateXxx()` 함수 (Result-type, no throw)
- `ValidationResult<T>` 타입

#### Wave 6: PoC Validation + Tests
- `twin-graph-builder.service.ts`에 `validateTwinSceneGraph()` PoC
- `test/contracts/schema-validation.test.ts` — 30개 tests

---

## 4. 테스트 결과

| 항목 | 이전 | 이후 | 변화 |
|---|---|---|---|
| pass | 55 | **84** | **+29** |
| fail | 3 | 3 | = (기존 NestJS 관련) |
| errors | 3 | 3 | = (기존 NestJS 관련) |
| expect() calls | 455 | **479** | **+24** |
| test files | 20 | **21** | **+1** |

**새로 추가된 30개 schema validation tests가 모두 pass.**

---

## 5. 변경된 파일 (23개)

### 새로 생성 (13개)
1. `packages/core/geometry/mesh-geometry.ts`
2. `packages/core/geometry/geometry.schema.ts`
3. `packages/contracts/source-snapshot/source-snapshot.schema.ts`
4. `packages/contracts/evidence-graph/evidence-graph.schema.ts`
5. `packages/contracts/twin-scene-graph/twin-scene-graph.schema.ts`
6. `packages/contracts/render-intent/render-intent.schema.ts`
7. `packages/contracts/mesh-plan/mesh-plan.schema.ts`
8. `packages/contracts/normalized-entity/normalized-entity.schema.ts`
9. `packages/contracts/qa/qa.schema.ts`
10. `packages/contracts/manifest/manifest.schema.ts`
11. `packages/contracts/validate.ts`
12. `test/contracts/schema-validation.test.ts`

### 수정 (10개)
13. `package.json` (zod 추가)
14. `packages/core/geometry/index.ts`
15. `packages/core/schemas/index.ts`
16. `packages/contracts/index.ts`
17. `packages/contracts/mesh-plan/index.ts`
18. `packages/contracts/normalized-entity/index.ts`
19. `src/glb/application/glb-compiler.service.ts`
20. `src/render/application/mesh-plan-builder.service.ts`
21. `src/normalization/application/normalized-entity-builder.service.ts`
22. `src/twin/application/twin-graph-builder.service.ts`
23. `src/twin/application/twin-entity-projection.service.ts`

---

## 6. PRD 기준 달성도

| PRD Phase 1 기준 | 상태 |
|---|---|
| "모든 계약이 typed schema로 존재한다" | ✅ TypeScript types 완료 + zod schemas 추가 |
| "provider raw 타입은 contracts 밖에 머무른다" | ✅ 유지 |
| "QaIssueCode는 namespace 기반 enum 또는 const registry로 고정된다" | ✅ 이미 완료 |

**Phase 1.5 추가 달성**:
- ✅ 10개 contract에 runtime zod validation
- ✅ 4개 `Record<string, unknown>` escape hatch 제거
- ✅ geometry discriminated union (`kind` field)
- ✅ GLB compiler unsafe casts → type-safe 패턴
- ✅ 30개 schema validation tests
- ✅ PoC pipeline boundary validation

---

## 7. 여전히 남아있는 문제들

### P0 — 즉시 수정 필요
1. `tomtom-traffic.adapter.ts:32` — zoom level `89` → `10`
2. `tomtom-traffic.adapter.ts:47` — division by zero guard
3. `google-places.adapter.ts:79` — `displayName?.text ?? ''`
4. `open-meteo.adapter.ts:59-66` — 빈 배열 guard
5. `providers.module.ts:12-13` — API key 빈값 시 throw
6. `osm-scene-build.service.ts:34-39` — `Promise.all` → sequential
7. `coordinates/index.ts:45-47` — r=0 guard
8. `.env` — API 키 노출 제거

### 아키텍처 수준
- NestJS 미사용으로 인한 dead code 다수
- Monorepo 구조 미준수 (단일 패키지)
- Provider raw schema가 여전히 일부 downstream으로 누수
- Evidence Graph는 유령 (edge 생성 없음)
- SceneRelationship 계산 없음
- Meshopt compression 100% 실패 (Bun/WASM 호환성)

---

## 8. 교훈 및 인사이트

### 8.1 "Bottom-up 개발"의 함정
PRD는 "Schema + Fixtures를 먼저 통과해야 한다"고 했지만, 실제 구현은:
1. HTTP API 엔드포인트 먼저
2. Overpass에서 데이터 긁어오는 adapter
3. "어떻게든 GLB 바이너리가 나오게" compiler
4. 나중에 타입 정의와 테스트 덧붙임

이것이 PRD 2절에서 비판한 "v1 보수 방식" 그대로였습니다.

### 8.2 계약 경계 붕괴
PRD의 핵심 계약 `Raw provider schema must never reach the GLB compiler`가 완전히 무너졌었습니다. Phase 1.5에서 geometry를 discriminated union으로 교체함으로써 이 경계를 부분적으로 복원했습니다.

### 8.3 TypeScript ≠ Runtime Safety
타입이 있어도 `as` assertions, `!` non-null assertions, `JSON.parse` without validation 등으로 런타임에 여전히 crash 가능. zod 추가로 이 격차를 줄였습니다.

---

## 9. 다음 단계 제안

### Phase 2: Fixtures First
- golden fixtures를 zod schemas로 검증
- deterministic replay 기준 구현 (PRD 22.2)
- schema 변경 시 migration/version bump policy (PRD 8.1)

### Phase 3: Provider Snapshot MVP
- Provider Adapters를 `SourceSnapshot` 계약으로 통일
- raw schema 유출 완전 차단
- compliance/attribution policy 완성

### Phase 4: Graph and Intent MVP
- Evidence Graph에 실제 edge 생성
- SceneRelationship 계산
- Confidence threshold policy 적용

### Phase 5: Minimal MeshPlan and GLB
- Geometry pipeline 구축 (polygon validation → watertight mesh)
- Meshopt compression Bun 호환성 해결
- Building massing geometry를 watertight mesh로 생성

---

## 10. 참고 문서

- PRD: `/Users/user/wormapb/docs/01-product/prd-v2.md`
- Phase Plan: `/Users/user/wormapb/docs/07-implementation/phase-plan.md`
- 본 회고록: `/Users/user/wormapb/wiki/wormap-v2-retrospective.md`
