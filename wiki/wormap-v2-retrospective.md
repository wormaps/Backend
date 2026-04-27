# WorMap v2 회고록 (Retrospective)

> **작성일**: 2026-04-26
> **컨텍스트**: Sisyphus 작업 세션 Phase 19 / 19.1 — GLB Export & Validation Pipeline
> **목적**: 현재까지의 아키텍처 결정, 구현 상태, 그리고 다음 작업 방향을 기록

---

## 1. 프로젝트 개요

### 1.1 WorMap v2란?

WorMap v2는 디지털 트윈 파이프라인입니다. 다중 제공자(Google Places, OSM, TomTom, Open-Meteo)의 데이터를 수집하여 정규화된 Entity → Evidence Graph → Twin Scene Graph → RenderIntent → MeshPlan → **GLB**로 이어지는 7단계 파이프라인을 통해 3D 도시 모델을 생성합니다.

### 1.2 핵심 설계 원칙

| 원칙 | 설명 |
|------|------|
| **Docs-First** | `docs/` 디렉토리가 단일 진실 공급원(Single Source of Truth) |
| **Fail-Fast** | 오류를 무시하지 않고 즉시 실패, 복구하지 않음 |
| **Validation-First** | 컴파일 → 검증 순서, 검증 실패 시 빌드 차단 |
| **Provider-Isolation** | 제공자 SDK/스키마는 GLB 컴파일러까지 도달하지 않음 |
| **Canonical Truth Layer** | TwinSceneGraph가 유일한 진실 계층 |
| **Type-First Contracts** | `packages/contracts/`에서 모든 타입 계약 정의 |

### 1.3 Reality Tier 시스템 (4단계)

```
REALITY_TWIN > STRUCTURAL_TWIN > PROCEDURAL_MODEL > PLACEHOLDER_SCENE
```

QA Gate 결과에 따라 tier가 결정되며, 최종 tier는 GLB 메타데이터와 Manifest에 기록됩니다.

---

## 2. 전체 아키텍처

### 2.1 파이프라인 흐름

```
SourceSnapshot (Provider API)
    │
    ▼
NormalizedEntityBundle
    │
    ▼
EvidenceGraph
    │
    ▼
TwinSceneGraph  ← [Canonical Truth Layer]
    │
    ▼
RenderIntentSet  ← [Render Policy 분리]
    │
    ▼
MeshPlan  ← [GLB Compiler 입력]
    │
    ├─→ GlbCompilerService (compile)
    │       │ placeholder metadata → 임시 GLB → canonical hash 계산
    │       │ → 최종 metadata 임베딩 → 최종 GLB
    │       ▼
    ├─→ GlbValidationService (validate)
    │       ├─ validateConsistency() → manifest ↔ artifact 일치성
    │       ├─ validateMeshPlan() → DCC 구조 무결성
    │       └─ validateArtifactBytes() → glTF validator + 해시 검증
    │       ▼
    └─→ SceneBuildRunResult
            ├─ snapshot_failure
            ├─ quarantined
            ├─ glb_validation_failure
            └─ completed
```

### 2.2 모듈 구조

```
app.module.ts
├── providersModule    → SnapshotCollectorService
├── normalizationModule → NormalizedEntityBuilderService
├── realityModule       → RealityTierResolverService
├── twinModule          → EvidenceGraphBuilder + TwinGraphBuilder
├── renderModule        → RenderIntentResolver + MeshPlanBuilder
├── qaModule            → QaGateService
├── glbModule           → GlbCompilerService + GlbValidationService
└── buildModule         → SceneBuildOrchestratorService
```

### 2.3 빌드 상태 머신 (12 상태)

```
REQUESTED
  → SNAPSHOT_COLLECTING → SNAPSHOT_COLLECTED
      ↓ (실패)               ↓
  SNAPSHOT_PARTIAL      NORMALIZING → NORMALIZED
                              ↓
                         GRAPH_BUILDING → GRAPH_BUILT
                              ↓
                         RENDER_INTENT_RESOLVING → RESOLVED
                              ↓
                         MESH_PLANNING → MESH_PLANNED
                              ↓
                         QA_RUNNING
                           ├─ 실패 → QUARANTINED
                           └─ 통과 → GLB_BUILDING → GLB_BUILT
                                         ↓
                                   COMPLETED
```

---

## 3. Phase 19 — GLB Pipeline

### 3.1 Phase 19/19.1 목표

- **Phase 19**: GLB Compiler가 persisted binary GLB bytes를 생성하고, validation이 그 bytes를 기준으로 통과
- **Phase 19.1**: GLB Validation Pipeline — 저장 전후 검증, 모든 필수 검증 항목 통과

### 3.2 GlbCompilerService (`src/glb/application/glb-compiler.service.ts`)

**책임**: MeshPlan → 유효한 GLB 바이너리 + 메타데이터 + 해시

**핵심 플로우 (2-pass)**:

```
1. Document 생성 (glTF 2.0)
   - Material/Mesh/Node/Scene 생성
   - Pivot → translation, Triangle mesh (3 vertices)
   
2. 부모-자식 계층 구성 (parentId 기반)
   
3. 1-pass: GLB_HASH_PLACEHOLDER로 metadata 생성
   - `sha256:00000000...` (64 zeros)
   - root.extras.worMap에 임베딩
   - NodeIO.writeBinary() → 임시 bytes
   
4. computeCanonicalGlbArtifactHash() → artifactHash 계산
   - 임시 bytes를 NodeIO.readBinary()로 파싱
   - root.extracts의 artifactHash/validationStamp/extrasValidationStamp → placeholder로 정규화
   - 재직렬화 → SHA-256 해시
   
5. 2-pass: 실제 artifactHash로 최종 metadata 생성
   - root.extras.worMap 갱신
   - NodeIO.writeBinary() → 최종 bytes
   - 해시 일치 검증 (불일치 시 예외 throw)
   
6. GlbArtifact 반환
```

**컴파일 결과 타입 (`GlbArtifact`)**:
```typescript
{
  sceneId: string;
  artifactRef: string;
  byteLength: number;
  artifactHash: string;
  bytes: Uint8Array;
  finalTier: RealityTier;
  qaSummary: QaSummary;
  meshSummary: GlbMeshSummary;
  gltfMetadata: WorMapGltfMetadataExport;
}
```

### 3.3 GlbValidationService (`src/glb/application/glb-validation.service.ts`)

**책임**: GLB 아티팩트의 3단계 종합 검증

**검증 항목**:

| 검증 단계 | 항목 | 코드 |
|-----------|------|------|
| **Consistency** | sceneId 일치 | REPLAY_MANIFEST_ARTIFACT_MISMATCH |
| | finalTier 일치 | REPLAY_MANIFEST_ARTIFACT_MISMATCH |
| | qaSummary 일치 | REPLAY_MANIFEST_ARTIFACT_MISMATCH |
| | artifactHash 일치 | REPLAY_MANIFEST_ARTIFACT_MISMATCH |
| | renderPolicyVersion 일치 | REPLAY_MANIFEST_ARTIFACT_MISMATCH |
| | extras identity 일치 | REPLAY_MANIFEST_ARTIFACT_MISMATCH |
| | extras snapshotBundleId 일치 | REPLAY_MANIFEST_ARTIFACT_MISMATCH |
| | extras artifactHash 일치 | REPLAY_MANIFEST_ARTIFACT_MISMATCH |
| | validationStamp 무결성 | REPLAY_MANIFEST_ARTIFACT_MISMATCH |
| | jsonHash round-trip | REPLAY_MANIFEST_ARTIFACT_MISMATCH |
| | sidecar 교차 검증 | REPLAY_MANIFEST_ARTIFACT_MISMATCH |
| **MeshPlan DCC** | 중복 노드 ID | DCC_GLB_DUPLICATE_NODE_ID |
| | 유효한 pivot (NaN 금지) | DCC_GLB_INVALID_PIVOT |
| | 누락된 material | DCC_MATERIAL_MISSING |
| | Orphan node | DCC_GLB_ORPHAN_NODE |
| | Parent cycle | DCC_GLB_PARENT_CYCLE |
| **Artifact Bytes** | Canonical hash 일치 | DCC_GLB_BINARY_HASH_MISMATCH |
| | Empty childless node | DCC_GLB_EMPTY_NODE |
| | Index buffer range | DCC_GLB_INDEX_OUT_OF_RANGE |
| | Accessor min/max | DCC_GLB_ACCESSOR_MINMAX_INVALID |
| | glTF-validator 통과 | DCC_GLB_VALIDATOR_ERROR |

### 3.4 GlbArtifactHash (`src/glb/application/glb-artifact-hash.ts`)

**해시 정규화의 필요성**:
- `artifactHash`와 `validationStamp` / `extrasValidationStamp`가 서로를 참조하는 순환 참조 문제
- 사용자 결정: **"Hash canonicalized bytes (Recommended)"**
- 해결: 해시 계산 시 해당 필드들을 `sha256:0000...` placeholder로 마스킹

**정규화 함수**:
```typescript
normalizeHashFields(value: T): T
// 제귀적으로 모든 객체를 순회하며 다음 키를 placeholder로 대체:
// - artifactHash
// - validationStamp
// - extrasValidationStamp
```

**canonical 해시 계산 과정**:
```
1. NodeIO.readBinary(bytes) → Document
2. root.setExtras(normalizeHashFields(root.getExtras()))
3. NodeIO.writeBinary(document) → canonical bytes
4. SHA-256(canonical bytes) → sha256:...
```

### 3.5 GltfMetadataFactory (`src/glb/application/gltf-metadata.factory.ts`)

**입력**:
```typescript
{
  sceneId, buildId, snapshotBundleId,
  finalTier, finalTierReasonCodes,
  qaSummary, schemaVersions, meshSummary,
  artifactHash, sidecarRef?
}
```

**출력 구조**:
```typescript
{
  extras: {
    value: WorMapGltfExtras,    // { worMap: { schemaVersion, sceneId, buildId, ...,
    //   artifactHash, validationStamp, sidecarRef? } }
    json: string,               // JSON.stringify(value)
    jsonHash: string            // sha256:JSON의 해시
  },
  sidecar?: {
    value: WorMapGltfSidecar,   // { worMap: { schemaVersion, sidecarRef, ...,
    //   extrasValidationStamp, validationStamp } }
    json: string,
    jsonHash: string
  }
}
```

### 3.6 GlbModule 진입점

```typescript
// src/glb/glb.module.ts
export const glbModule = {
  name: 'glb',
  services: {
    glbCompiler: new GlbCompilerService(),
    glbValidation: new GlbValidationService(),
  },
};
```

---

## 4. Contract 시스템

### 4.1 QA 이슈 코드 전체 목록 (49개)

| 접두사 | 코드 |
|--------|------|
| COMPLIANCE | `ATTRIBUTION_MISSING`, `CACHED_PAYLOAD_ALLOWED`, `MANUAL_SOURCE_EXISTS`, `PROVIDER_POLICY_RISK`, `RETENTION_POLICY_RESPECTED` |
| DCC | `MATERIAL_MISSING`, `GLB_ACCESSOR_MINMAX_INVALID`, `GLB_BINARY_HASH_MISMATCH`, `GLB_BOUNDS_INVALID`, `GLB_DUPLICATE_NODE_ID`, `GLB_EMPTY_NODE`, `GLB_INDEX_OUT_OF_RANGE`, `GLB_INVALID_PIVOT`, `GLB_INVALID_TRANSFORM`, `GLB_ORPHAN_NODE`, `GLB_PARENT_CYCLE`, `GLB_PRIMITIVE_POLICY_VIOLATION`, `GLB_VALIDATOR_ERROR` |
| GEOMETRY | `DEGENERATE_TRIANGLE`, `INVALID_INSET`, `NON_MANIFOLD_EDGE`, `OPEN_SHELL`, `ROOF_WALL_GAP`, `SELF_INTERSECTION`, `Z_FIGHTING_RISK` |
| PROVIDER | `MAPPER_VERSION_MISSING`, `RATE_LIMIT_CAPTURED`, `REPLAYABLE`, `RESPONSE_HASH_MISSING`, `SNAPSHOT_FAILED` |
| REALITY | `DEFAULTED_RATIO_HIGH`, `FACADE_COVERAGE_LOW`, `HEIGHT_CONFIDENCE_LOW`, `INFERRED_RATIO_HIGH`, `MATERIAL_CONFIDENCE_LOW`, `OBSERVED_RATIO_LOW`, `PLACEHOLDER_RATIO_HIGH`, `PROCEDURAL_DECORATION_HIGH` |
| REPLAY | `CORE_METRIC_DRIFT`, `INPUT_HASHES_COMPLETE`, `MANIFEST_ARTIFACT_MISMATCH`, `SNAPSHOT_BUNDLE_ID_MISSING` |
| SCENE | `DUPLICATED_FOOTPRINT`, `ROAD_BUILDING_OVERLAP` |
| SPATIAL | `COORDINATE_NAN_INF`, `COORDINATE_OUTLIER`, `SCENE_EXTENT`, `EXTREME_TERRAIN_SLOPE`, `TERRAIN_GROUNDING_GAP` |

### 4.2 SceneBuildManifest 구조

```typescript
{
  sceneId: string;              // 씬 식별자
  buildId: string;              // 빌드 식별자
  state: SceneBuildState;       // 22개 상태 중 하나
  createdAt: string;            // ISO 8601
  scopeId: string;              // 검색 범위 ID
  snapshotBundleId: string;     // 스냅샷 번들 ID
  schemaVersions: SchemaVersionSet;  // 스키마 버전 셋
  mapperVersion: string;        // 매퍼 버전
  normalizationVersion: string; // 정규화 버전
  identityVersion: string;      // 아이덴티티 버전
  renderPolicyVersion: string;  // 렌더 정책 버전
  meshPolicyVersion: string;    // 메시 정책 버전
  qaVersion: string;            // QA 버전
  glbCompilerVersion: string;   // GLB 컴파일러 버전
  packageVersions: Record<string, string>;  // 패키지 버전
  inputHashes: Record<string, string>;      // 입력 데이터 해시
  artifactHashes: Record<string, string>;   // 아티팩트 해시 (GLB)
  finalTier: RealityTier;       // 최종 현실성 등급
  finalTierReasonCodes: string[]; // 등급 결정 사유
  qaSummary: QaSummary;         // QA 요약
  attribution: AttributionSummary; // 저작권 귀속
  complianceIssues: QaIssue[];  // 컴플라이언스 이슈
}
```

### 4.3 SceneBuildRunResult 종류

| 결과 타입 | 발생 조건 | 주요 데이터 |
|-----------|----------|------------|
| `snapshot_failure` | 스냅샷 수집 실패 | build, state, collected, qaResult, manifest |
| `quarantined` | QA 게이트 실패 | 모든 중간 산출물 + manifest |
| `glb_validation_failure` | GLB 검증 실패 | 모든 중간 산출물 + glbArtifact + glbValidation + manifest |
| `completed` | 전체 성공 | 모든 중간 산출물 + glbArtifact + manifest |

---

## 5. 테스트 현황

### 5.1 전체 테스트 (31 pass, 0 fail, 339 expect)

```
test/
├── src/
│   ├── glb-compiler-metadata.test.ts       ✓ 1 test
│   ├── glb-validation.service.test.ts       ✓ 4 tests
│   ├── scene-build-validation-failure.test.ts ✓ 1 test
│   ├── gltf-metadata.factory.test.ts         ✓ 1 test
│   ├── src-boundaries.test.ts                ✓ 3 tests
│   ├── mesh-plan-builder.test.ts             ✓ ? tests
│   └── qa-gate-control.test.ts               ✓ ? tests
├── fixtures/
│   └── phase2-fixtures.test.ts               ✓ 10 tests (3 baseline + 7 adversarial)
└── src/ (7 files)
```

### 5.2 GLB 파이프라인 테스트 상세

| 테스트 | 파일 | 검증 내용 |
|--------|------|----------|
| 컴파일 메타데이터 | glb-compiler-metadata.test.ts | sceneId, finalTier, qaSummary, artifactHash, meshSummary, byteLength |
| 정상 빌드 수용 | glb-validation.service.test.ts | validation passed=true, issues=[] |
| manifest/artifact 불일치 | glb-validation.service.test.ts | REPLAY_MANIFEST_ARTIFACT_MISMATCH |
| DCC hierarchy 오류 | glb-validation.service.test.ts | DCC_GLB_ORPHAN_NODE, INVALID_PIVOT, MATERIAL_MISSING |
| GLB 바이트 변조 | glb-validation.service.test.ts | DCC_GLB_BINARY_HASH_MISMATCH |
| 검증 실패 시 빌드 | scene-build-validation-failure.test.ts | glb_validation_failure 반환, FAILED 상태 |
| metadata 직렬화 | gltf-metadata.factory.test.ts | worMap extras, validationStamp, sidecar |
| baseline fixtures | phase2-fixtures.test.ts (3) | COMPLETED, 모든 아티팩트 존재 |
| adversarial fixtures | phase2-fixtures.test.ts (7) | 실패 상태, QA 이슈 분포 |
| 모듈 경계 | src-boundaries.test.ts | 의존성 분리, MVP 모듈 노출 |

### 5.3 테스트 픽스처

**Baseline (3)**:
- `baseline-clean-core-block` — OSM + OpenMeteo, POI + terrain
- `baseline-basic-road-scene` — OSM + TomTom, traffic 관계
- `baseline-basic-terrain-scene` — OSM only, terrain only

**Adversarial (7)**:
- `adversarial-partial-snapshot-failure` → SNAPSHOT_PARTIAL
- `adversarial-duplicated-footprints` → COMPLETED + SCENE_DUPLICATED_FOOTPRINT
- `adversarial-self-intersecting-polygon` → QUARANTINED + GEOMETRY_SELF_INTERSECTION
- `adversarial-road-building-overlap` → QUARANTINED + SCENE_ROAD_BUILDING_OVERLAP
- `adversarial-coordinate-outlier` → COMPLETED + SPATIAL_COORDINATE_OUTLIER
- `adversarial-extreme-terrain-slope` → COMPLETED + SPATIAL_EXTREME_TERRAIN_SLOPE
- `adversarial-provider-policy-violation` → COMPLETED + COMPLIANCE_PROVIDER_POLICY_RISK

---

## 6. 문서 상태

### 6.1 `docs/` 디렉토리 (36 files, Single Source of Truth)

```
01-product/    (3) — PRD v2.3 (1705줄), MVP scope, Reality Tier 정책
02-architecture/ (6) — ADR 3개, 시스템 개요, 도메인 경계, 파이프라인 라이프사이클
03-contracts/  (9) — 모든 데이터 계약 문서
04-quality/    (5) — QA Gate, DCC 검증, 형상 검증, 신뢰도 점수, 결정론적 재현
05-operations/ (5) — 상태 머신, 제공자 예산, 컴플라이언스, 감사, 보존
06-fixtures/   (3) — 픽스처 전략 및 정의
07-implementation/ (3) — 구현 계획, 저장소 구조, 코딩 표준
```

### 6.2 `wiki/` 디렉토리 (16 files, 탐색 및 결정 기록)

주요 문서:
- `Home.md` — 위키 시작점
- `dcc-glb-validation.md` — DCC/GLB 검증 상세
- `glb-artifact-and-manifest-metadata.md` — GLB artifact와 manifest metadata
- `gltf-extras-schema.md` — glTF extras/sidecar 스키마
- `manifest-artifact-consistency.md` — manifest/artifact 일치성
- `oracle-dcc-glb-validation-feedback.md` — Oracle 피드백 기록
- 나머지: 도메인 분리, 의도 투영, 상태 머신 등

### 6.3 CI/CD
- `.github/` 디렉토리 없음 (CI/CD 설정 아직 없음)
- `bun test`로 테스트 실행, `tsc --noEmit`으로 타입 체크

---

## 7. 주요 아키텍처 결정 (Key Decisions)

### 7.1 Phase 19 완료 조건

**Oracle 결정 (bg_182287cf)**:
> "Phase 19 cannot be closed yet. Metadata scaffolding + validation is not enough."

따라서 Phase 19는 **실제 GLB 바이트 생성 + 바이트 기반 검증 통과** 시에만 종료됨.

### 7.2 Artifact Hash 정규화

**문제**: `artifactHash`가 GLB 메타데이터에 포함되어 있고, `validationStamp`가 `artifactHash`를 포함한 JSON을 해싱하므로 순환 참조 발생.

**사용자 결정**: "Hash canonicalized bytes (Recommended)"
- 해결: 해시 계산 시 `artifactHash`, `validationStamp`, `extrasValidationStamp` 필드를 `sha256:0000...` placeholder로 마스킹
- 검증 시에도 동일한 정규화 적용

### 7.3 Validation-Only, No Repair

- GLB validation은 GLB compiler 내부에서 문제를 **수정하지 않음**
- 문제 발견 시 MeshPlan 또는 RenderIntent 단계로 되돌림
- Manifest / artifact 불일치는 **critical fail_build**

### 7.4 Full Validation Before COMPLETED

```
compile → validateConsistency() → validateMeshPlan() → validateArtifactBytes()
  → passed → COMPLETED
  → failed → FAILED (glb_validation_failure)
```

### 7.5 Mesh Plan에서의 검증 게이트

- DCC 계층 구조: orphan node, cycle, pivot 유효성 → critical + fail_build
- 이슈 코드: `DCC_GLB_*` prefix
- 검증 실패 시 빌드 실패, 자동 복구 없음

### 7.6 Root Extras만 사용

- 최종 결정: Root `asset.extras.worMap`만 메타데이터 대상
- Scene extras는 제거 (이전에는 root + scene 모두 설정했음)
- 이유: 단순성, 해시 안정성, 문서 정합성 (wiki에서 root extras 선호 명시)

---

## 8. 기술 스택

| 구성 | 기술 |
|------|------|
| Runtime | Bun 1.3.13 |
| Language | TypeScript (ESNext, strict, bundler moduleResolution) |
| 3D | `@gltf-transform/core` ^4.3.0, `@gltf-transform/functions` ^4.3.0 |
| Validator | `gltf-validator` ^2.0.0-dev.3.10 |
| Compression | `meshoptimizer` ^1.1.1 (설치됨, 아직 사용 안 함) |
| Geometry | `earcut` ^3.0.2 |
| Test | Bun test (jest-compatible) |
| Lint/Format | 설정 있음 (`eslint.config.mjs`) |

---

## 9. 작업 진행 내역

### Phase 19 완료 항목

- [x] GLB 컴파일러가 실제 바이트 생성 (`NodeIO.writeBinary`)
- [x] 2-pass export (placeholder → hash → final metadata)
- [x] Canonicalized byte hash (self-reference 해결)
- [x] gltf-validator 연동 (`validateBytes`)
- [x] Manifest/artifact consistency validation
- [x] DCC hierarchy validation (orphan, cycle, duplicate, pivot)
- [x] Empty childless node validation
- [x] Index buffer range validation
- [x] Accessor min/max validation
- [x] Byte tamper detection (canonical hash mismatch)
- [x] 모든 빌드 결과 타입 정의 (`SceneBuildRunResult`)
- [x] QA issue registry 업데이트 (3개 신규 코드)
- [x] 모든 테스트 통과 (31 pass, 0 fail)
- [x] tsc 타입 체크 통과
- [x] Oracle 피드백 위키 기록
- [x] root extras만 사용 (scene extras 제거)

### Phase 19 미완료/향후 항목

- [ ] Blender import smoke test (권장, 아직 미구현)
- [ ] Three.js viewer smoke test (권장, 아직 미구현)
- [ ] meshoptimizer 압축 (허용, 아직 적용 안 함)
- [ ] metadata sidecar export (escape hatch, 아직 미사용)

---

## 10. 파일 인덱스

### GLB 파이프라인 (src/glb/)

| 파일 | 역할 | LOC |
|------|------|-----|
| `glb.module.ts` | 모듈 등록 | 10 |
| `glb-compiler.service.ts` | GLB 컴파일러 | 189 |
| `glb-validation.service.ts` | GLB 검증 서비스 | 567 |
| `glb-artifact-hash.ts` | 해시 정규화 유틸리티 | 43 |
| `gltf-metadata.factory.ts` | 메타데이터 팩토리 | 102 |
| `gltf-validator.d.ts` | gltf-validator 타입 선언 | 36 |

### 빌드 오케스트레이션 (src/build/)

| 파일 | 역할 | LOC |
|------|------|-----|
| `build.module.ts` | 모듈 등록 | 43 |
| `scene-build.aggregate.ts` | 상태 머신 | 56 |
| `scene-build-orchestrator.service.ts` | 오케스트레이터 | 284 |
| `scene-build-run-result.ts` | 결과 타입 | 76 |
| `build-manifest.factory.ts` | 매니페스트 팩토리 | 68 |

### 계약 (packages/contracts/)

| 파일 | 역할 |
|------|------|
| `manifest/index.ts` | SceneBuildManifest, WorMap metadata |
| `qa/index.ts` | QaIssue, QaIssueCode |
| `mesh-plan/index.ts` | MeshPlan, MeshPlanNode |
| `twin-scene-graph/index.ts` | TwinSceneGraph, RealityTier |
| `render-intent/index.ts` | RenderIntent, RenderIntentSet |
| `evidence-graph/index.ts` | EvidenceGraph |
| `normalized-entity/index.ts` | NormalizedEntityBundle |
| `source-snapshot/index.ts` | SourceSnapshot |

### 테스트

| 파일 | 역할 |
|------|------|
| `test/src/glb-compiler-metadata.test.ts` | 컴파일러 메타데이터 |
| `test/src/glb-validation.service.test.ts` | 검증 서비스 |
| `test/src/scene-build-validation-failure.test.ts` | 빌드 실패 |
| `test/src/gltf-metadata.factory.test.ts` | 메타데이터 팩토리 |
| `test/fixtures/phase2-fixtures.test.ts` | 픽스처 기반 E2E |
| `test/src/src-boundaries.test.ts` | 모듈 경계 |
| `fixtures/phase2/index.ts` | 픽스처 export |
| `fixtures/phase2/baseline.ts` | 3 baseline fixtures |
| `fixtures/phase2/adversarial.ts` | 7 adversarial fixtures |

---

## 11. 다음 단계 (Next Steps)

### Short-term

1. **Phase 19.1 검증 항목 보강**
   - [ ] node transform NaN/Infinity 직접 검증 (현재는 pivot 검증만 있음, 컴파일러에서 직접 체크 필요)
   - [ ] accessor min/max 값 유효성 glTF validator 결과와 비교 검증 강화

2. **Phase 20 QA Gate Control**
   - [ ] Severity/Gate 모델 정교화
   - [ ] Tier downgrade/detail strip 시나리오별 테스트
   - [ ] QaIssue action 핸들링 구체화

3. **Phase 5 MeshPlan 구체화**
   - [ ] 건물 massing mesh 상세화
   - [ ] 도로/보도/지형 primitive 다양화
   - [ ] POI marker 구현

### Medium-term

4. **CI/CD 구축**
   - [ ] GitHub Actions 설정
   - [ ] PR에 tsc + bun test 자동 실행
   - [ ] 테스트 커버리지 임계값 설정

5. **검증 강화**
   - [ ] Blender smoke test 자동화 (CLI 기반)
   - [ ] Three.js 기반 viewer smoke test
   - [ ] bounding box sanity check
   - [ ] relationship line noise risk check

6. **의존성 정리**
   - [ ] `meshoptimizer` 압축 연동 결정 (현재는 미사용)
   - [ ] `earcut` 삼각 측량 연동
   - [ ] sidecar export 메커니즘 구현

---

## 부록 A: QA Issue 코드 상세

| 코드 | 심각도 | 액션 | 스코프 | 설명 |
|------|--------|------|--------|------|
| `COMPLIANCE_ATTRIBUTION_MISSING` | major | warn_only | provider | 저작권 귀속 정보 누락 |
| `COMPLIANCE_CACHED_PAYLOAD_ALLOWED` | info | record_only | provider | 캐시된 페이로드 허용 |
| `COMPLIANCE_MANUAL_SOURCE_EXISTS` | info | record_only | provider | 수동 소스 존재 |
| `COMPLIANCE_PROVIDER_POLICY_RISK` | major | warn_only | provider | 제공자 정책 위반 |
| `COMPLIANCE_RETENTION_POLICY_RESPECTED` | info | record_only | provider | 보존 정책 준수 |
| `DCC_GLB_ACCESSOR_MINMAX_INVALID` | critical | fail_build | mesh | accessor min/max 무결성 위반 |
| `DCC_GLB_BINARY_HASH_MISMATCH` | critical | fail_build | scene | 바이너리 해시 불일치 |
| `DCC_GLB_BOUNDS_INVALID` | critical | fail_build | mesh | 유효하지 않은 경계 |
| `DCC_GLB_DUPLICATE_NODE_ID` | critical | fail_build | mesh | 중복 노드 ID |
| `DCC_GLB_EMPTY_NODE` | critical | fail_build | mesh | 빈 노드 |
| `DCC_GLB_INDEX_OUT_OF_RANGE` | critical | fail_build | mesh | 인덱스 범위 초과 |
| `DCC_GLB_INVALID_PIVOT` | critical | fail_build | mesh | 유효하지 않은 피벗 |
| `DCC_GLB_INVALID_TRANSFORM` | critical | fail_build | mesh | 유효하지 않은 변환 |
| `DCC_GLB_ORPHAN_NODE` | critical | fail_build | mesh | 고아 노드 |
| `DCC_GLB_PARENT_CYCLE` | critical | fail_build | mesh | 부모 사이클 |
| `DCC_GLB_PRIMITIVE_POLICY_VIOLATION` | major | fail_build | mesh | 프리미티브 정책 위반 |
| `DCC_GLB_VALIDATOR_ERROR` | critical | fail_build | scene | glTF 검증기 오류 |
| `DCC_MATERIAL_MISSING` | critical | fail_build | material | 재질 누락 |
| `GEOMETRY_DEGENERATE_TRIANGLE` | major | downgrade_tier | mesh | 퇴화 삼각형 |
| `GEOMETRY_INVALID_INSET` | major | downgrade_tier | entity | 유효하지 않은 인셋 |
| `GEOMETRY_NON_MANIFOLD_EDGE` | major | downgrade_tier | mesh | 비다양체 엣지 |
| `GEOMETRY_OPEN_SHELL` | major | downgrade_tier | mesh | 열린 쉘 |
| `GEOMETRY_ROOF_WALL_GAP` | major | strip_detail | entity | 지붕-벽 간격 |
| `GEOMETRY_SELF_INTERSECTION` | major | downgrade_tier | entity | 자기 교차 |
| `GEOMETRY_Z_FIGHTING_RISK` | minor | warn_only | mesh | Z-fighting 위험 |
| `PROVIDER_MAPPER_VERSION_MISSING` | major | warn_only | provider | 매퍼 버전 누락 |
| `PROVIDER_RATE_LIMIT_CAPTURED` | info | record_only | provider | 속도 제한 포착 |
| `PROVIDER_REPLAYABLE` | info | record_only | provider | 재현 가능 |
| `PROVIDER_RESPONSE_HASH_MISSING` | major | warn_only | provider | 응답 해시 누락 |
| `PROVIDER_SNAPSHOT_FAILED` | critical | fail_build | provider | 스냅샷 수집 실패 |
| `REALITY_DEFAULTED_RATIO_HIGH` | major | downgrade_tier | scene | 기본값 비율 높음 |
| `REALITY_FACADE_COVERAGE_LOW` | major | downgrade_tier | scene | 외벽 커버리지 낮음 |
| `REALITY_HEIGHT_CONFIDENCE_LOW` | major | downgrade_tier | scene | 높이 신뢰도 낮음 |
| `REALITY_INFERRED_RATIO_HIGH` | major | downgrade_tier | scene | 추론 비율 높음 |
| `REALITY_MATERIAL_CONFIDENCE_LOW` | major | downgrade_tier | scene | 재질 신뢰도 낮음 |
| `REALITY_OBSERVED_RATIO_LOW` | major | downgrade_tier | scene | 관측 비율 낮음 |
| `REALITY_PLACEHOLDER_RATIO_HIGH` | major | downgrade_tier | scene | 플레이스홀더 비율 높음 |
| `REALITY_PROCEDURAL_DECORATION_HIGH` | minor | warn_only | scene | 절차적 장식 높음 |
| `REPLAY_CORE_METRIC_DRIFT` | major | warn_only | scene | 핵심 지표 드리프트 |
| `REPLAY_INPUT_HASHES_COMPLETE` | info | record_only | scene | 입력 해시 완전 |
| `REPLAY_MANIFEST_ARTIFACT_MISMATCH` | critical | fail_build | scene | manifest와 artifact 불일치 |
| `REPLAY_SNAPSHOT_BUNDLE_ID_MISSING` | major | warn_only | scene | 스냅샷 번들 ID 누락 |
| `SCENE_DUPLICATED_FOOTPRINT` | major | downgrade_tier | entity | 중복 footprint |
| `SCENE_ROAD_BUILDING_OVERLAP` | major | strip_detail | entity | 도로-건물 중첩 |
| `SPATIAL_COORDINATE_NAN_INF` | critical | fail_build | entity | 좌표 NaN/Infinity |
| `SPATIAL_COORDINATE_OUTLIER` | info | record_only | entity | 좌표 이상치 |
| `SPATIAL_SCENE_EXTENT` | minor | warn_only | scene | 씬 범위 |
| `SPATIAL_EXTREME_TERRAIN_SLOPE` | minor | warn_only | entity | 극단적 지형 경사 |
| `SPATIAL_TERRAIN_GROUNDING_GAP` | major | warn_only | entity | 지형 접지 간격 |

---

## 부록 B: 용어 사전

| 용어 | 설명 |
|------|------|
| **GLB** | 바이너리 glTF 2.0 포맷 (단일 파일) |
| **glTF** | JSON 기반 3D 장면 전송 포맷 |
| **MeshPlan** | GLB 컴파일러 입력으로 사용되는 메시 생성 계획 |
| **RenderIntent** | 씬의 각 엔티티가 어떻게 시각화되어야 하는지 정의 |
| **TwinSceneGraph** | 씬의 canonical truth layer (모든 사실 데이터 포함) |
| **RealityTier** | 씬의 현실성 등급 (REALITY_TWIN > STRUCTURAL_TWIN > PROCEDURAL_MODEL > PLACEHOLDER_SCENE) |
| **QA Gate** | 빌드 품질 평가 및 제어 시스템 |
| **Manifest** | 빌드 재현성과 감사의 기준이 되는 메타데이터 |
| **Extras** | glTF 확장 메타데이터 필드 (tool-specific data) |
| **Sidecar** | GLB 내부에 임베딩하기 어려운 큰 메타데이터를 위한 보조 파일 |
| **ValidationStamp** | glTF extras의 무결성을 보장하는 SHA-256 해시 |
| **Canonical Hash** | 순환 참조를 피하기 위해 특정 필드를 마스킹한 후 계산된 해시 |
| **Oracle** | 아키텍처 결정을 위한 고급 추론 에이전트 |

---

> **문서 상태**: v1.0 — Phase 19 / 19.1 GLB Pipeline 회고록
> **다음 갱신**: Phase 20 QA Gate Control 또는 Phase 5 MeshPlan 구체화 진행 시
