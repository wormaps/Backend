# Domain Boundaries

## Provider Domain

- Google Places, Overpass, Open-Meteo, TomTom 호출
- raw payload, query hash, response hash, compliance metadata

## Contract Domain

- `SourceSnapshot`
- `EvidenceGraph`
- `TwinSceneGraph`
- `RenderIntentSet`
- `MeshPlan`
- `SceneBuildManifest`

## Rendering Domain

- Render intent resolution
- Mesh planning
- GLB compile

## Reality Domain

- Reality Tier initial/provisional resolution
- tier downgrade policy의 공통 계산
- twin과 render가 공유하는 품질 등급 정책

## 금지 경계

- raw provider schema는 GLB compiler로 넘어갈 수 없다.
- GLB compiler는 confidence/provenance를 생성할 수 없다.
- normalization은 visual detail 결정을 하지 않는다.
- twin은 render application service에 직접 의존하지 않는다.

## Domain Interfaces

### Provider → Contract
- 입력: raw provider response
- 출력: SourceSnapshot
- 금지: provider raw schema가 Contract 밖으로 노출

### Contract → Rendering
- 입력: TwinSceneGraph
- 출력: RenderIntentSet, RealityTier
- 금지: RenderIntent이 provider raw type에 의존

### Rendering → GLB
- 입력: MeshPlan
- 출력: GlbArtifact
- 금지: MeshPlan 외부 데이터 참조

### GLB → Manifest
- 입력: GlbArtifact, QaResult
- 출력: SceneBuildManifest
- 금지: 검증되지 않은 해시 기록

## Data Flow
Provider API → SourceSnapshot → NormalizedEntity → EvidenceGraph → TwinSceneGraph → RenderIntentSet → MeshPlan → GLB bytes → GlbArtifact → SceneBuildManifest
