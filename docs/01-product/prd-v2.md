# WorMap Digital Twin v2.3 PRD

## 0. 문서 성격

이 문서는 단순 제품 요구사항 문서가 아니다.

WorMap v2의 기준 문서이며 다음 세 가지 역할을 동시에 가진다.

1. 아키텍처 재건 선언문
2. 품질 기준서
3. 데이터 계약 초안

이 문서의 목적은 "API 여러 개를 조합해 GLB를 만든다"가 아니라, 현실 장소를 근거 기반의 정규화된 Twin Scene Graph로 만들고, 그 그래프를 검증 가능한 3D 산출물로 컴파일하는 방법을 정의하는 것이다.

## 1. 핵심 결론

WorMap v2는 다음 방향으로 간다.

- Backend: NestJS 유지
- Frontend: Next.js는 viewer와 QA dashboard로 분리
- API: Google Places, Overpass, Open-Meteo Historical Weather, TomTom Traffic 유지
- GLB: `TwinSceneGraph -> RenderIntentSet -> MeshPlan -> GLB`로 생성
- 품질: Reality Tier와 QA Gate가 산출물 생성 여부를 제어
- 원칙: 근거 없는 디테일을 현실처럼 보이게 만들지 않는다

가장 중요한 계약은 다음이다.

```text
Raw provider schema must never reach the GLB compiler.
```

GLB compiler 입력은 오직 검증된 `TwinSceneGraph`, `RenderIntentSet`, `MeshPlan`이다.

## 2. 현재 main branch 실패 원인

확인된 사실:

- Blender 씬에서 대량의 검은 점선이 보였다.
- 원인은 실제 도시 선 지오메트리라기보다 부모-자식 relationship line일 가능성이 높다.
- `bld_*` empty node가 실제 pivot transform을 갖지 않고 원점에 남아 있었다.
- 선택되지 않은 건물도 empty node로 등록되었다.
- roof, window, entrance, roof equipment가 건물별 mesh로 대량 생성되었다.
- observed appearance coverage가 낮은 상태에서 procedural facade/roof detail이 과하게 생성되었다.
- geometry correction이 충돌과 중복을 보정으로 덮었다.
- `invalidSetbackJoinCount`가 merge 과정에서 45에서 0으로 사라지는 품질 게이트 누락이 있었다.

추정:

- 현재 main의 핵심 문제는 GLB 라이브러리 문제가 아니라 pipeline contract 문제다.
- `SceneMeta/SceneDetail`이 사실상 raw/inferred/rendering state를 모두 섞은 중간 구조로 사용되면서 책임 경계가 무너졌다.

의견:

- v1을 계속 보수하는 방식은 품질 회복 가능성이 낮다.
- v2는 타입 계약, 단계별 산출물, QA Gate, build lifecycle을 먼저 고정한 뒤 구현해야 한다.

## 3. 제품 원칙

### 3.1 Evidence First

모든 entity와 property는 provenance를 가진다.

```ts
type Provenance = "observed" | "inferred" | "defaulted";
```

- `observed`: provider 또는 관측 source에서 확인됨
- `inferred`: 명시적 규칙으로 추정됨
- `defaulted`: 근거가 부족해 시스템 기본값 사용

`inferred`와 `defaulted`는 반드시 `reasonCodes`, `confidence`, `derivation`을 가진다.

### 3.2 Scene Graph First

API 응답을 GLB builder에 직접 전달하지 않는다.

```text
Provider Snapshot
-> Normalized Entity
-> Evidence Graph
-> Twin Scene Graph
-> RenderIntentSet
-> Mesh Plan
-> GLB
-> QA Report
```

### 3.3 Reality Tier

생성 결과는 다음 중 하나로 분류한다.

```ts
type RealityTier =
  | "REALITY_TWIN"
  | "STRUCTURAL_TWIN"
  | "PROCEDURAL_MODEL"
  | "PLACEHOLDER_SCENE";
```

- `REALITY_TWIN`: 핵심 구조와 외관이 충분히 관측됨
- `STRUCTURAL_TWIN`: 구조는 신뢰 가능하지만 외관은 제한적임
- `PROCEDURAL_MODEL`: 구조 일부와 많은 추정으로 구성됨
- `PLACEHOLDER_SCENE`: 데모 또는 fallback 수준

현실성이 낮은 결과를 현실 디지털 트윈이라고 표시하지 않는다.

### 3.4 Conservative Visuals

시각적 디테일은 근거가 있을 때만 추가한다.

- 근거 없는 roof equipment 자동 생성 금지
- 근거 없는 간판, 창문 패턴, facade 색상 과장 금지
- 낮은 confidence 건물은 massing only
- high-confidence core area에만 세부 facade 허용
- procedural detail은 quality score를 올리지 않는다

### 3.5 QA Controls Build

QA는 리포트가 아니라 제어 로직이다.

```text
critical issue -> fail build
major issue    -> downgrade tier or strip detail
minor issue    -> warn
info issue     -> record only
```

## 4. 기술 선택

### 4.1 NestJS

NestJS를 backend engine으로 유지한다.

이유:

- provider adapter, pipeline service, batch job, queue, artifact storage에 적합하다.
- module/service/provider 구조가 명확하다.
- 장기 실행 build lifecycle을 관리하기 좋다.
- Next.js API route보다 작업 상태, retry, replay, logging을 분리하기 좋다.

### 4.2 Next.js

Next.js는 viewer와 QA dashboard로 사용한다.

역할:

- 장소 검색 UI
- GLB preview
- entity provenance inspector
- QA issue viewer
- Reality Tier badge
- build artifact 비교

### 4.3 추천 구조

```text
apps/api
  NestJS backend

apps/web
  Next.js viewer and QA dashboard

packages/core
  coordinates, geometry, typed schemas, validation

packages/providers
  Google Places, Overpass, Open-Meteo, TomTom adapters

packages/twin
  Evidence Graph, Twin Scene Graph, identity, derivation

packages/render
  Render Intent and visual policy resolution

packages/glb
  Mesh Plan and GLB compiler

packages/qa
  provider, spatial, geometry, DCC, reality validation
```

## 5. Provider 역할과 제한

### 5.1 Google Places API

역할:

- 장소 검색
- 장소 이름
- place id
- 대표 좌표
- 카테고리
- viewport 또는 location bias
- POI semantic seed

제한:

- 건물 footprint source로 쓰지 않는다.
- facade, height, roof shape를 확정하지 않는다.
- 장소 검색과 semantic identity source로 제한한다.

### 5.2 OpenStreetMap + Overpass API

역할:

- building footprint
- road centerline
- walkway
- crossing 후보
- POI
- OSM tag

제한:

- Overpass는 read-only OSM data query source다.
- OSM tag가 없는 height/material/roof는 observed가 아니다.
- multipolygon, duplicated way, self-intersection을 신뢰하지 말고 반드시 정규화한다.

### 5.3 Open-Meteo Historical Weather API

역할:

- 특정 WGS84 coordinate와 기간의 historical weather
- atmosphere state
- wetness, visibility, lighting hint

제한:

- weather는 geometry source가 아니다.
- weather는 material state, lighting state, simulation state에만 반영한다.

### 5.4 TomTom Traffic API

역할:

- nearest road fragment의 current speed
- free flow speed
- travel time
- confidence
- road closure
- traffic state overlay

제한:

- TomTom traffic response로 도로 geometry를 재구성하지 않는다.
- traffic coordinates는 visualization support 성격이 있으므로 OSM road graph와 matching해서 state layer로만 쓴다.

### 5.5 Visual Evidence Source

현재 API 세트만으로는 외관이 정확한 포토리얼 디지털 트윈을 보장할 수 없다.

향후 `REALITY_TWIN`을 안정적으로 달성하려면 다음 중 하나가 필요하다.

- Mapillary
- 사용자 업로드 이미지
- curated landmark asset
- photogrammetry/captured mesh
- 3D Tiles source

### 5.6 Provider Compliance & Attribution

provider 데이터는 기술 계약뿐 아니라 사용 정책 계약도 가진다.

Google Places:

- Places API content는 정책이 허용하는 예외 외에는 장기 저장하지 않는다.
- `place_id`는 caching restriction 예외로 장기 저장 가능하다.
- Google Places 결과를 UI에 노출할 때는 Google attribution 요구사항을 따른다.
- PRD의 `SourceSnapshot`은 compliance metadata를 가져야 한다.

OpenStreetMap:

- OSM은 데이터 소스이고, Overpass는 OSM 데이터를 조회하는 read-only query interface다.
- OSM 데이터 사용 결과물은 OpenStreetMap과 contributors attribution을 제공해야 한다.
- OSM 데이터는 ODbL 조건을 고려해야 한다.
- OSM 기반 파생 데이터 배포 정책은 별도 legal review 대상이다.

TomTom / Open-Meteo:

- traffic/weather 응답은 snapshot metadata에 provider, query time, source timestamp, license/compliance reference를 기록한다.
- provider별 retention/caching 정책은 `SourceSnapshot.policy`에 기록한다.

```ts
type SourceSnapshotPolicy = {
  provider: SourceEntityRef["provider"];
  attributionRequired: boolean;
  attributionText?: string;
  retentionPolicy: "ephemeral" | "cache_allowed" | "id_only" | "artifact_allowed";
  policyVersion: string;
  policyUrl?: string;
};
```

규칙:

- GLB sidecar manifest는 attribution summary를 포함한다.
- viewer는 attribution summary를 표시할 수 있어야 한다.
- provider policy 위반 가능성이 있으면 QA issue `PROVIDER_POLICY_RISK`를 생성한다.

## 6. Scene Scope Contract

Scene 범위는 품질과 비용을 결정하는 핵심 계약이다.

```ts
type SceneScope = {
  center: GeoCoordinate;
  boundaryType: "viewport" | "radius" | "polygon";
  radiusMeters?: number;
  polygon?: GeoPolygon;
  focusPlaceId?: string;
  coreArea: GeoPolygon;
  contextArea: GeoPolygon;
  exclusionAreas?: GeoPolygon[];
};
```

정책:

- `coreArea`: 높은 품질과 강한 QA를 요구하는 영역
- `contextArea`: 주변 문맥용 단순화 영역
- `coreArea` 밖에서는 facade/window/roof detail을 기본 제한
- QA coverage는 coreArea 기준으로 우선 계산
- contextArea entity는 LOD downshift 가능
- scene extent는 scope에서 파생되며 build 중 임의 확장하지 않는다

권장 기본값:

```text
SMALL  core radius: 150m, context radius: 300m
MEDIUM core radius: 300m, context radius: 600m
LARGE  core radius: 500m, context radius: 1000m
```

Initial operational default:

- 위 radius 값은 현재 프로젝트 경험 기반의 초기값이다.
- benchmark phase에서 제품 목표 FPS, GLB 크기, provider cost에 맞춰 calibration해야 한다.

## 7. Build Lifecycle

Scene build는 명시적 상태 머신을 가진다.

```ts
type SceneBuildState =
  | "REQUESTED"
  | "SNAPSHOT_COLLECTING"
  | "SNAPSHOT_PARTIAL"
  | "SNAPSHOT_COLLECTED"
  | "NORMALIZING"
  | "NORMALIZED"
  | "GRAPH_BUILDING"
  | "GRAPH_BUILT"
  | "RENDER_INTENT_RESOLVING"
  | "RENDER_INTENT_RESOLVED"
  | "MESH_PLANNING"
  | "MESH_PLANNED"
  | "GLB_BUILDING"
  | "GLB_BUILT"
  | "QA_RUNNING"
  | "QUARANTINED"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED"
  | "SUPERSEDED";
```

단계별 산출물:

```text
SNAPSHOT_COLLECTED       snapshot bundle
NORMALIZED               normalized entity bundle
GRAPH_BUILT              twin scene graph
RENDER_INTENT_RESOLVED   render intent set
MESH_PLANNED             mesh plan
GLB_BUILT                glb artifact
COMPLETED                qa report + manifest
```

각 단계는 재시도 가능해야 한다.

재시도 원칙:

- provider fetch 실패: snapshot 단계에서만 retry
- provider 일부 실패: `SNAPSHOT_PARTIAL`로 기록하고 fallback 허용 여부를 QA Gate에서 판단
- normalization 실패: raw snapshot은 보존
- graph build 실패: normalized bundle은 보존
- GLB build 실패: MeshPlan은 보존
- QA 실패: GLB artifact는 quarantine 상태로 저장 가능
- 동일 scene에 더 최신 successful build가 생기면 이전 active build는 `SUPERSEDED`가 된다

## 7.1 Preflight Build Admission

build 시작 전에 admission control을 수행한다.

검사 항목:

- SceneScope 크기와 core/context 면적
- 예상 core/context entity 수
- provider별 예상 request 수와 비용
- 예상 GLB byte size, node count, triangle count
- 필수 provider availability
- provider compliance risk

결정:

```text
pass
  -> build 시작

shrink_context
  -> coreArea는 유지하고 contextArea를 축소

split_scene
  -> large scene을 tile 또는 chunk로 분할

reject
  -> budget, compliance, 필수 provider 조건을 만족하지 못하면 build 거절
```

정책:

- coreArea는 사용자 의도와 품질 기준의 중심이므로 자동 축소하지 않는다.
- budget 초과 시 contextArea 축소가 첫 번째 fallback이다.
- estimatedCoreEntityCount가 threshold를 넘으면 scene split 또는 reject를 선택한다.
- preflight 실패는 GLB 생성 실패가 아니라 build admission 실패로 기록한다.

## 8. Versioned Build Manifest

모든 build는 manifest를 가진다.

```ts
type SceneBuildManifest = {
  sceneId: string;
  buildId: string;
  state: SceneBuildState;
  createdAt: string;
  scopeId: string;
  snapshotBundleId: string;
  schemaVersions: SchemaVersionSet;
  mapperVersion: string;
  normalizationVersion: string;
  identityVersion: string;
  renderPolicyVersion: string;
  meshPolicyVersion: string;
  qaVersion: string;
  glbCompilerVersion: string;
  packageVersions: Record<string, string>;
  inputHashes: Record<string, string>;
  artifactHashes: Record<string, string>;
  attribution: AttributionSummary;
  complianceIssues: QaIssue[];
};

type AttributionSummary = {
  required: boolean;
  entries: Array<{
    provider: string;
    label: string;
    url?: string;
  }>;
};
```

목적:

- deterministic replay
- 이전 build와 diff
- mapper 변경 영향 추적
- QA rule 변경 영향 추적
- provider snapshot 재사용

### 8.1 Schema Version & Migration Policy

모든 산출물은 schema version을 가진다.

```ts
type SchemaVersionSet = {
  sourceSnapshotSchema: string;
  normalizedEntitySchema: string;
  evidenceGraphSchema: string;
  twinSceneGraphSchema: string;
  renderIntentSchema: string;
  meshPlanSchema: string;
  qaSchema: string;
  manifestSchema: string;
};
```

규칙:

- breaking schema change는 migration spec 또는 major version bump가 필수다.
- fixture expected output 변경은 schema/rule version 변경과 함께 커밋한다.
- deterministic replay 비교는 manifest의 `schemaVersions`를 먼저 비교한다.
- 마이그레이션 없는 incompatible artifact는 active build 후보가 될 수 없다.

## 8.2 SourceSnapshot Contract

provider 응답은 `SourceSnapshot`으로만 파이프라인에 들어온다.

```ts
type SourceSnapshot = {
  id: string;
  provider: "google_places" | "osm" | "open_meteo" | "tomtom" | "manual" | "curated";
  sceneId: string;
  requestedAt: string;
  receivedAt?: string;
  queryHash: string;
  responseHash?: string;
  storageMode: "none" | "metadata_only" | "ephemeral_payload" | "cached_payload";
  payloadRef?: string;
  payloadSchemaVersion?: string;
  sourceTimestamp?: string;
  status: "success" | "partial" | "failed";
  errorCode?: string;
  compliance: SourceSnapshotPolicy;
};
```

저장 모드:

- `none`: payload를 저장하지 않음
- `metadata_only`: query hash, response hash, attribution, timing만 저장
- `ephemeral_payload`: 단기 디버깅/재시도용 임시 저장
- `cached_payload`: provider 정책이 허용하는 범위에서 replay용 저장

규칙:

- `queryHash`는 필수다.
- 성공 또는 partial snapshot은 가능한 경우 `responseHash`를 가진다.
- raw payload 저장 여부는 provider compliance policy가 결정한다.
- replay 가능한 snapshot과 policy상 payload 보관 불가 snapshot을 구분한다.

## 9. Evidence Graph

Evidence Graph는 독립 단계로 유지한다.

역할:

- provider source와 normalized entity/property 사이의 근거 연결을 보존한다.
- 서로 모순되는 source를 `contradicts`로 기록한다.
- inferred/defaulted property가 어떤 source와 rule에서 파생됐는지 기록한다.
- TwinSceneGraph가 단순 entity collection이 아니라 근거 기반 graph임을 강제한다.

```ts
type EvidenceGraph = {
  sceneId: string;
  snapshotBundleId: string;
  nodes: EvidenceNode[];
  edges: EvidenceEdge[];
  generatedAt: string;
  evidencePolicyVersion: string;
};

type EvidenceNode = {
  id: string;
  entityId?: string;
  propertyKey?: string;
  sourceEntityRef?: SourceEntityRef;
  provenance: "observed" | "inferred" | "defaulted";
  confidence: number;
  reasonCodes: string[];
  valueHash?: string;
};

type EvidenceEdge = {
  from: string;
  to: string;
  relation: "supports" | "derived_from" | "contradicts" | "supersedes";
  reasonCodes: string[];
};
```

규칙:

- `observed` property는 최소 하나 이상의 `supports` edge를 가져야 한다.
- `inferred` property는 최소 하나 이상의 `derived_from` edge를 가져야 한다.
- `defaulted` property는 missing evidence reason code를 가져야 한다.
- Evidence Graph 없이 TwinSceneGraph를 생성하지 않는다.

## 10. Entity Identity & Derivation

### 10.1 SourceEntityRef

```ts
type SourceEntityRef = {
  provider: "google_places" | "osm" | "open_meteo" | "tomtom" | "manual" | "curated";
  sourceId: string;
  layer?: string;
  sourceSnapshotId: string;
};
```

### 10.2 Manual & Curated Policy

`manual`과 `curated`는 만능 탈출구가 아니다.

정책:

- `manual`: 운영자 또는 사용자가 명시적으로 입력한 값
- `curated`: 검증된 내부 landmark 또는 asset dataset
- 둘 다 `sourceSnapshotId` 또는 artifact reference가 필수다.
- 둘 다 `SourceEntityRef`에 기록해야 한다.
- `manual`은 기본적으로 `observed`가 아니다. 검증자가 승인한 경우에만 observed로 승격할 수 있다.
- `curated`는 dataset version과 reviewer 또는 source artifact를 가져야 한다.
- manual/curated가 provider source와 충돌하면 EvidenceGraph에 `contradicts` edge를 기록한다.
- manual source alone으로 Reality Tier를 올릴 수 없다.
- curated source는 review status가 `approved`일 때만 Reality Tier 계산에 반영할 수 있다.
- manual override는 reviewer, reason, timestamp, artifact ref를 가진 audit record를 생성해야 한다.

### 10.3 DerivationRecord

```ts
type DerivationRecord = {
  step: string;
  version: string;
  reasonCodes: string[];
  inputEntityIds?: string[];
  outputEntityIds?: string[];
};
```

### 10.4 TwinEntity Base

```ts
type TwinEntityBase = {
  id: string;
  stableId: string;
  type: TwinEntityType;
  confidence: number;
  sourceSnapshotIds: string[];
  sourceEntityRefs: SourceEntityRef[];
  derivation: DerivationRecord[];
  tags: string[];
  qualityIssues: QaIssue[];
};
```

규칙:

- `id`는 build-local id일 수 있다.
- `stableId`는 provider id, normalized geometry hash, semantic role을 조합해 만든다.
- merge된 entity는 모든 source ref와 derivation을 보존한다.
- conflict entity는 자동으로 정상 entity처럼 렌더링하지 않는다.

## 11. Typed Entity Properties

`Record<string, EvidenceValue<unknown>>`는 초안에서만 허용한다.

실구현은 entity별 typed property schema를 사용한다.

### 11.1 EvidenceValue

```ts
type EvidenceValue<T> = {
  value: T;
  provenance: "observed" | "inferred" | "defaulted";
  confidence: number;
  source: string;
  reasonCodes: string[];
  derivation?: DerivationRecord[];
};
```

### 11.2 Building

```ts
type TwinBuildingEntity = TwinEntityBase & {
  type: "building";
  geometry: BuildingGeometry;
  properties: BuildingProperties;
};

type BuildingProperties = {
  name?: EvidenceValue<string>;
  height?: EvidenceValue<number>;
  levels?: EvidenceValue<number>;
  roofShape?: EvidenceValue<RoofShape>;
  facadeMaterial?: EvidenceValue<FacadeMaterial>;
  facadeColor?: EvidenceValue<string>;
  buildingUse?: EvidenceValue<string>;
  isLandmark?: EvidenceValue<boolean>;
};
```

### 11.3 Road

```ts
type TwinRoadEntity = TwinEntityBase & {
  type: "road";
  geometry: RoadGeometry;
  properties: RoadProperties;
};

type RoadProperties = {
  name?: EvidenceValue<string>;
  highwayClass?: EvidenceValue<string>;
  lanes?: EvidenceValue<number>;
  widthMeters?: EvidenceValue<number>;
  surface?: EvidenceValue<string>;
  trafficState?: EvidenceValue<TrafficState>;
};
```

### 11.4 POI

```ts
type TwinPoiEntity = TwinEntityBase & {
  type: "poi";
  geometry: PointGeometry;
  properties: PoiProperties;
};

type PoiProperties = {
  name?: EvidenceValue<string>;
  category?: EvidenceValue<string>;
  placeId?: EvidenceValue<string>;
  osmTags?: EvidenceValue<Record<string, string>>;
};
```

## 12. Twin Scene Graph

TwinSceneGraph는 v2의 canonical truth layer다.

```ts
type TwinSceneGraph = {
  sceneId: string;
  scope: SceneScope;
  coordinateFrame: CoordinateFrame;
  entities: TwinEntity[];
  relationships: SceneRelationship[];
  evidenceGraphId: string;
  terrain?: TerrainLayer;
  stateLayers: SceneStateLayer[];
  metadata: TwinSceneGraphMetadata;
};

type TwinEntity =
  | TwinBuildingEntity
  | TwinRoadEntity
  | TwinPoiEntity
  | TwinWalkwayEntity
  | TwinTerrainEntity
  | TwinTrafficFlowEntity;

type TwinEntityType =
  | "building"
  | "road"
  | "walkway"
  | "poi"
  | "terrain"
  | "traffic_flow";

type SceneRelationship = {
  id: string;
  fromEntityId: string;
  toEntityId: string;
  relation:
    | "adjacent_to"
    | "contains"
    | "intersects"
    | "duplicates"
    | "conflicts"
    | "matches_traffic_fragment"
    | "supports_access";
  confidence: number;
  reasonCodes: string[];
};

type TwinSceneGraphMetadata = {
  initialRealityTierCandidate: RealityTier;
  observedRatio: number;
  inferredRatio: number;
  defaultedRatio: number;
  coreEntityCount: number;
  contextEntityCount: number;
  qualityIssues: QaIssue[];
};
```

규칙:

- TwinSceneGraph는 provider raw schema를 포함하지 않는다.
- 모든 entity는 `sourceEntityRefs`와 `derivation`을 가진다.
- 모든 observed/inferred/defaulted 비율은 coreArea 기준과 scene 전체 기준을 분리해 계산할 수 있어야 한다.
- conflict relationship은 RenderIntent에서 detail stripping 또는 exclusion 후보가 된다.

## 13. Core Type Appendix

문서의 예시 타입에서 사용하는 핵심 shape는 다음 범위를 가진다.

```ts
type GeoCoordinate = {
  lat: number;
  lng: number;
};

type LocalPoint = {
  x: number;
  y: number;
  z: number;
};

type GeoPolygon = {
  outer: GeoCoordinate[];
  holes?: GeoCoordinate[][];
};

type LocalPolygon = {
  outer: LocalPoint[];
  holes?: LocalPoint[][];
};

type CoordinateFrame = {
  origin: GeoCoordinate;
  axes: "ENU";
  unit: "meter";
  elevationDatum: "LOCAL_DEM" | "ELLIPSOID" | "UNKNOWN";
};

type BuildingGeometry = {
  footprint: LocalPolygon;
  terrainSamples?: LocalPoint[];
  baseY?: number;
};

type RoadGeometry = {
  centerline: LocalPoint[];
  bufferPolygon?: LocalPolygon;
};

type PointGeometry = {
  point: LocalPoint;
};

type RoofShape = "flat" | "gable" | "hip" | "shed" | "stepped" | "unknown";
type FacadeMaterial = "concrete" | "glass" | "brick" | "metal" | "stone" | "tile" | "unknown";

type TrafficState = {
  currentSpeedKph?: number;
  freeFlowSpeedKph?: number;
  confidence?: number;
  closure?: boolean;
};
```

## 14. Coordinate & Geometry Contract

### 14.1 Coordinate Frame

모든 mesh 단계는 local ENU meter만 사용한다.

```text
x = east meters
y = elevation meters
z = north meters
```

WGS84는 provider snapshot, normalized entity, provenance에는 보존하지만 mesh builder에는 직접 전달하지 않는다.

### 14.2 Polygon Validation

건물 footprint는 mesh 생성 전 다음을 통과해야 한다.

- closed ring
- orientation normalization
- duplicate vertex removal
- degenerate edge removal
- minimum area
- self-intersection check
- hole containment check
- multipolygon policy

### 14.3 Height Resolution

건물 높이 우선순위:

```text
OSM height
> OSM building:levels * local floor height
> curated landmark height
> district/type fallback
```

fallback height는 observed가 아니다.

### 14.4 Terrain Grounding

```text
samples = terrain elevations at footprint vertices and centroid
baseY = median(samples)
terrainDelta = max(samples) - min(samples)
```

정책:

- low terrainDelta: single base
- medium terrainDelta: skirt/plinth
- high terrainDelta: terraced base or QA issue

### 14.5 Duplicate & Conflict

```text
IoU > 0.85         duplicate merge
0.25 < IoU <= 0.85 conflict
IoU <= 0.25        independent
```

conflict는 자동 height stagger로 숨기지 않는다.

### 14.6 Road-Building Collision

```text
1. road centerline buffer 생성
2. building footprint와 intersection 계산
3. small intrusion -> clip 후보
4. large intrusion -> QA major/critical
```

### 14.7 Layer Y Policy

```ts
const LayerY = {
  terrain: 0,
  roadBase: 0.03,
  sidewalk: 0.035,
  roadMarking: 0.045,
  crosswalk: 0.055,
  decal: 0.065,
};
```

layer offset은 중앙 정책으로만 관리한다.

## 15. Render Intent Layer

TwinSceneGraph와 MeshPlan 사이에 Render Intent를 둔다.

이 레이어는 사실 데이터와 시각화 결정을 분리한다.

```ts
type RenderIntentSet = {
  sceneId: string;
  twinSceneGraphId: string;
  intents: RenderIntent[];
  policyVersion: string;
  generatedAt: string;
  tier: {
    initialCandidate: RealityTier;
    provisional: RealityTier;
    reasonCodes: string[];
  };
};

type RenderIntent = {
  entityId: string;
  visualMode:
    | "massing"
    | "structural_detail"
    | "landmark_asset"
    | "traffic_overlay"
    | "placeholder"
    | "excluded";
  allowedDetails: {
    windows: boolean;
    entrances: boolean;
    roofEquipment: boolean;
    facadeMaterial: boolean;
    signage: boolean;
  };
  lod: "L0" | "L1" | "L2";
  reasonCodes: string[];
  confidence: number;
};
```

정책:

- `observed` 또는 high-confidence `inferred`만 facade detail 허용
- roof equipment는 observed/curated/landmark policy 없으면 false
- conflict entity는 `placeholder` 또는 `excluded`
- contextArea entity는 기본 `massing`
- coreArea high-confidence entity만 `structural_detail`

### 15.1 Confidence Scoring Policy

confidence는 0에서 1 사이의 수치다.

```text
high confidence   = confidence >= 0.80
medium confidence = 0.50 <= confidence < 0.80
low confidence    = confidence < 0.50
```

초기 threshold:

```ts
type ConfidenceThresholdPolicy = {
  structuralDetailMinEntityConfidence: 0.8;
  facadeDetailMinPropertyConfidence: 0.75;
  roofDetailMinPropertyConfidence: 0.85;
  landmarkAssetMinConfidence: 0.9;
  placeholderMaxAllowedRatioCore: 0.1;
};
```

계산 요소:

- source reliability weight
- recency weight
- geometric consistency weight
- cross-source agreement weight
- manual/curated approval status

규칙:

- facade detail은 property confidence `>= 0.75`일 때만 허용한다.
- roof detail은 property confidence `>= 0.85`일 때만 허용한다.
- landmark asset은 entity confidence `>= 0.90`이고 curated/manual policy를 통과해야 한다.
- confidence는 procedural visual detail 생성량으로 올릴 수 없다.

## 16. Reality Tier Resolution

Reality Tier는 한 번에 확정하지 않는다.

```text
initial tier candidate
  TwinSceneGraph 생성 직후 계산

provisional tier
  RenderIntentSet 생성 후 계산

final tier
  QA Gate 적용 후 확정
```

책임:

- TwinSceneGraph: observed/inferred/defaulted 비율과 core coverage로 candidate 계산
- RenderIntentSet: 실제 허용된 visual detail과 fallback 결과로 provisional 계산
- QA Gate: critical/major issue action 적용 후 final 계산

정책:

- QA major issue는 final tier를 downgrade할 수 있다.
- stripped detail은 final tier 계산에 반영한다.
- GLB artifact는 final tier와 QA summary를 metadata extras 또는 sidecar manifest에 기록한다.

## 17. Fallback Ladder

### 17.1 Building

```text
1. valid footprint + confident height
   -> building massing

2. valid footprint + inferred height
   -> low-confidence massing

3. invalid but recoverable footprint
   -> simplified convex hull massing + QA issue

4. unusable footprint
   -> placeholder marker or excluded

5. duplicate/conflict unresolved
   -> excluded + QA issue
```

### 17.2 Roof

```text
1. valid roof polygon + high confidence
   -> roof mesh

2. roof tag exists but geometry unsafe
   -> flat roof cap

3. inset failure
   -> strip roof detail

4. roof-shell collision
   -> fail or strip detail based on severity
```

### 17.3 Facade

```text
1. observed facade evidence
   -> facade material/detail allowed

2. OSM material/color tag
   -> simple material allowed

3. district inferred profile
   -> muted material only

4. no evidence
   -> neutral massing
```

## 18. MeshPlan

```ts
type MeshPlan = {
  sceneId: string;
  renderPolicyVersion: string;
  nodes: MeshPlanNode[];
  materials: MaterialPlan[];
  budgets: MeshBudget;
};
```

규칙:

- empty node는 자식이 있을 때만 생성
- parent node는 실제 pivot transform을 가진다
- node hierarchy는 Blender import 검수 가능해야 한다
- batch 가능한 shell은 batch 처리
- instance 가능한 반복 요소는 instance 처리
- building detail은 RenderIntent가 허용한 경우만 생성

## 19. GLB Compiler

사용 패키지:

- `@gltf-transform/core`
- `@gltf-transform/functions`
- `earcut`
- `meshoptimizer`

권장 패키지:

- `polygon-clipping` 또는 `martinez-polygon-clipping`
- `rbush` 또는 `flatbush`
- `zod`
- `three`

GLB Compiler 금지 사항:

- provider API 호출 금지
- provider raw schema import 금지
- confidence/provenance 생성 금지
- geometry correction 수행 금지
- QA issue 무시 금지

GLB Compiler 허용 사항:

- MeshPlan을 glTF node/mesh/material/accessor로 변환
- optimization
- compression
- artifact hash 생성
- DCC metadata extras 기록

### 19.1 GLB Validation Pipeline

GLB artifact는 저장 전후로 검증한다.

필수 검증:

- glTF validator 통과
- accessor min/max 유효성
- index buffer 범위 검증
- material/texture reference 유효성
- node transform NaN/Infinity 금지
- empty childless node 금지
- parent pivot policy 통과

권장 검증:

- Blender import smoke test
- Three.js viewer smoke test
- thumbnail render
- bounding box sanity check
- relationship line noise risk check

검증 실패 처리:

```text
validator critical error -> fail_build
DCC hierarchy error      -> fail_build
viewer smoke fail        -> quarantine + major issue
optimization warning     -> warn_only
```

GLB validation은 GLB compiler 내부에서 문제를 고치지 않는다.
문제가 발견되면 MeshPlan 또는 RenderIntent 단계로 되돌린다.

## 20. QA Severity & Gate Control

### 20.1 QaIssue

```ts
type QaIssue = {
  code: string;
  severity: "critical" | "major" | "minor" | "info";
  scope: "scene" | "entity" | "mesh" | "material" | "provider";
  entityId?: string;
  message: string;
  metric?: number;
  threshold?: number;
  action:
    | "fail_build"
    | "downgrade_tier"
    | "strip_detail"
    | "warn_only"
    | "record_only";
};
```

### 20.2 Gate Rules

```text
critical + fail_build
  -> build failed

major + downgrade_tier
  -> Reality Tier downgrade

major + strip_detail
  -> RenderIntent detail 제거 후 MeshPlan 재생성

minor
  -> warning

info
  -> diagnostics only
```

### 20.3 QA Categories

Provider QA:

- raw snapshot exists
- response hash exists
- mapper version exists
- replayable
- provider rate-limit captured

Spatial QA:

- WGS84 to ENU roundtrip
- scene extent
- coordinate NaN/Infinity
- outlier entity
- duplicate footprint
- road-building overlap
- terrain grounding gap

Geometry QA:

- self-intersection
- open shell
- non-manifold edge
- degenerate triangle
- roof-wall gap
- invalid inset
- z-fighting risk

Reality QA:

- observed ratio
- inferred ratio
- defaulted ratio
- observed facade coverage
- height confidence distribution
- material confidence distribution
- placeholder ratio
- procedural decoration ratio

GLB/DCC QA:

- GLB byte size
- triangle count
- node count
- mesh count
- material count
- empty node count
- parent pivot validity
- relationship line noise risk

Compliance QA:

- provider attribution summary exists
- provider retention policy respected
- cached payload type allowed
- OSM attribution present
- Google Places content retention risk
- manual/curated source artifact exists

Replay QA:

- manifest versions complete
- snapshotBundleId exists
- inputHashes complete
- stableId set deterministic
- core metric drift within tolerance

## 21. Cost & Performance Budget

초기 budget은 보수적으로 둔다.

```ts
type BuildBudget = {
  snapshotFetchMs: number;
  normalizationMs: number;
  graphBuildMs: number;
  renderIntentMs: number;
  meshPlanMs: number;
  glbBuildMs: number;
  qaMs: number;
  totalBuildMs: number;
  maxMemoryMb: number;
  maxGlbBytes: number;
  maxTriangleCount: number;
  maxNodeCount: number;
  maxCoreEntityCount: number;
  providerRequestBudget: Record<string, number>;
  maxSnapshotBytes: number;
};
```

MVP 기본 목표:

```text
totalBuildMs <= 30000
maxMemoryMb <= 2048
maxGlbBytes <= 30000000
maxNodeCount <= 1500
emptyNodeWithNoChildren = 0
```

Initial operational default:

- 이 수치는 현재 main의 대형 scene 경험을 기반으로 한 초기 운영 목표다.
- benchmark phase에서 실제 제품 FPS, 서버 사양, viewer 요구사항에 맞춰 calibration해야 한다.

### 21.1 Provider Budget Policy

provider 호출은 build budget의 일부다.

```ts
type ProviderBudgetPolicy = {
  provider: string;
  maxRequestsPerBuild: number;
  maxRetriesPerRequest: number;
  timeoutMs: number;
  backoffPolicy: "none" | "linear" | "exponential";
  cacheReuseWindowSec?: number;
  fallbackAllowed: boolean;
};
```

규칙:

- provider budget 초과는 preflight에서 먼저 감지한다.
- 초과 시 contextArea 축소, scene split, fail 중 하나를 선택한다.
- Google Places와 TomTom은 request budget을 명시적으로 제한한다.
- fallback이 허용되지 않는 provider가 실패하면 `SNAPSHOT_PARTIAL` 또는 build failure로 처리한다.

### 21.2 Build Supersession & Retention

동일 scene에는 여러 build가 존재할 수 있지만 active build는 하나다.

정책:

- 동일 scene의 최신 successful build만 active다.
- 더 최신 successful build가 생기면 이전 active build는 `SUPERSEDED`가 된다.
- quarantined artifact는 QA/운영자만 접근한다.
- superseded build는 manifest와 QA summary를 장기 보관하고, 대용량 artifact는 retention policy에 따라 삭제할 수 있다.
- compliance 위험이 있는 payload는 policy retention window가 지나면 삭제한다.

## 22. Benchmark & Golden Fixture Strategy

v2는 큰 scene부터 만들지 않는다.

먼저 작은 golden fixture로 계약을 고정한다.

### 22.1 Golden Fixtures

필수 fixture:

- `fixture-core-block`: 건물 3개, 도로 2개, POI 1개
- `fixture-duplicate-buildings`: 중복 footprint와 conflict 검증
- `fixture-sloped-terrain`: terrain grounding 검증
- `fixture-invalid-polygon`: polygon cleanup/fallback 검증
- `fixture-traffic-weather-state`: traffic/weather state layer 검증
- `fixture-provider-policy`: attribution/retention policy 검증

각 fixture는 다음 artifact를 가진다.

```text
snapshot bundle
normalized entity bundle
evidence graph
twin scene graph
render intent set
mesh plan
qa report
manifest
```

### 22.2 Regression Rules

- schema 변경 시 golden fixture를 모두 재생성하지 않는다. 먼저 migration 또는 version bump를 기록한다.
- mapper 변경은 normalized entity diff를 남긴다.
- render policy 변경은 RenderIntentSet diff를 남긴다.
- GLB compiler 변경은 MeshPlan이 동일할 때 artifact/validator diff를 남긴다.
- QA rule 변경은 issue code distribution diff를 남긴다.

### 22.3 Benchmark Gates

대형 scene은 golden fixture가 통과한 뒤에만 benchmark한다.

benchmark 대상:

- small core scene
- medium dense commercial scene
- high-rise downtown scene
- residential sloped terrain scene
- traffic-heavy intersection scene

통과 기준:

- critical issue = 0
- deterministic replay 기준 통과
- budget 초과 없음
- final Reality Tier가 기대 tier보다 높게 과장되지 않음

## 23. Acceptance Criteria

### 23.1 MVP 기능

- 장소 검색으로 scene build 요청 가능
- Google Places snapshot 저장
- Overpass snapshot 저장
- Open-Meteo snapshot 저장
- TomTom snapshot 저장
- SceneScope 생성
- TwinSceneGraph 생성
- RenderIntentSet 생성
- MeshPlan 생성
- GLB 생성
- QA report 생성
- BuildManifest 생성
- attribution summary 생성
- golden fixture 통과

### 23.2 MVP 품질

```text
coordinate roundtrip max error <= 0.05m
empty node with no children = 0
parent pivot missing count = 0
critical geometry issue = 0
critical DCC issue = 0
quality gate critical issue hidden as warn = 0
provider policy critical issue = 0
```

### 23.3 Deterministic Replay

동일 입력은 동일한 manifest-compatible 출력을 만들어야 한다.

```text
same snapshotBundleId
same SceneScope
same packageVersions
same mapperVersion
same normalizationVersion
same identityVersion
same renderPolicyVersion
same meshPolicyVersion
same qaVersion
same glbCompilerVersion
-> same inputHashes
-> same core QA metrics within tolerance
-> same artifactHashes when compiler output is byte-deterministic
```

byte-level artifact hash가 환경 차이로 달라질 수 있는 경우에도 다음은 같아야 한다.

- entity stableId set
- RenderIntentSet intent count and visualMode distribution
- MeshPlan node/material budget summary
- QA issue code distribution
- final Reality Tier

### 23.4 STRUCTURAL_TWIN 기준

```text
core building footprint coverage >= 0.8
core road coverage >= 0.8
terrain grounding pass
critical road-building overlap = 0
height provenance coverage >= 0.7
```

### 23.5 REALITY_TWIN 기준

```text
observed facade coverage >= 0.5
high-confidence landmark coverage >= 0.8
defaulted visual property ratio <= 0.2
visual evidence source exists
```

현재 API 조합만으로 `REALITY_TWIN`을 안정적으로 달성하기는 어렵다.

## 24. 비범위

v2 MVP에서 하지 않는다.

- 포토리얼 외관 보장
- 모든 건물 facade 정확도 보장
- 근거 없는 roof equipment 자동 생성
- weather로 geometry 변경
- traffic으로 road geometry 변경
- 대규모 도시 전체 실시간 생성
- unresolved conflict 자동 보정

## 25. 구현 순서

초기 구현은 API 연동이나 GLB 생성보다 `Schema + Fixtures`를 먼저 통과해야 한다.

### Phase 0: Foundation Docs

목표:

- 구현 전 팀/에이전트가 같은 기준을 보게 만든다.
- v1 복구/병행 논쟁을 종료한다.
- `docs/`를 single source of truth로 고정한다.

산출물:

- wiki index
- clean-slate ADR
- phase plan
- domain boundary 문서
- PRD v2.3
- QA issue namespace 규칙

### Phase 1: Schema Contracts

목표:

- 코드의 첫 번째 산출물은 runtime 로직이 아니라 타입 계약이다.

필수 계약:

- SceneScope
- SourceSnapshot
- SourceSnapshotPolicy
- EvidenceGraph
- TwinSceneGraph
- RenderIntentSet
- MeshPlan
- QaIssue
- QaIssueCode
- SceneBuildManifest
- SchemaVersionSet
- ProviderBudgetPolicy

완료 기준:

- 모든 계약이 typed schema로 존재한다.
- provider raw 타입은 contracts 밖에 머무른다.
- `QaIssueCode`는 namespace 기반 enum 또는 const registry로 고정된다.

### Phase 2: Fixtures First

목표:

- 큰 scene 금지.
- 깨지는 현실 입력부터 제어한다.

baseline fixture:

- clean core block
- basic road scene
- basic terrain scene

adversarial fixture:

- duplicated footprints
- self-intersecting polygon
- road-building overlap
- missing provider response
- partial snapshot failure
- coordinate outlier
- extreme terrain slope
- provider policy violation

완료 기준:

- fixture별 expected QA issue distribution이 고정된다.
- deterministic replay 기준을 통과한다.
- fixture 없이 provider/GLB 구현에 착수하지 않는다.

### Phase 3: Provider Snapshot MVP

목표:

- API 통합이 아니라 snapshot/replay/compliance 통합을 먼저 만든다.

구현 순서:

1. Google Places snapshot
2. Overpass snapshot
3. Open-Meteo snapshot
4. TomTom snapshot

완료 기준:

- 같은 snapshot bundle로 replay 가능하다.
- provider partial failure가 `SNAPSHOT_PARTIAL`로 표현된다.
- compliance QA가 critical issue를 만들 수 있다.

### Phase 4: Graph and Intent MVP

목표:

- GLB 없이도 scene 품질 판단이 가능해야 한다.

구현 순서:

1. normalized entity 생성
2. EvidenceGraph 생성
3. TwinSceneGraph 생성
4. initial Reality Tier candidate 계산
5. RenderIntentSet 생성
6. provisional Reality Tier 계산
7. QA Gate 적용

완료 기준:

- conflict entity가 정상 렌더 대상으로 넘어가지 않는다.
- contextArea entity는 기본 massing intent다.
- manual source alone으로 Reality Tier 상승이 불가능하다.
- major issue가 tier downgrade 또는 detail stripping을 유발한다.

### Phase 5: Minimal MeshPlan and GLB

목표:

- 화려한 GLB가 아니라 계약을 지키는 GLB를 만든다.

초기 지원:

- terrain plane 또는 simple terrain mesh
- building massing only
- road base
- walkway base
- POI marker
- no facade detail
- no roof equipment
- no signage detail

완료 기준:

- empty node with no children = 0
- parent pivot missing count = 0
- glTF validator critical error = 0
- Blender/Three.js smoke test 통과
- final Reality Tier가 과장되지 않는다

## 26. 공식 문서 근거

이 PRD는 다음 공식 문서의 역할 정의와 제약을 반영한다.

- Google Places API: 장소 검색, place details, place id, POI/location data 중심
  - https://developers.google.com/maps/documentation/places/web-service
  - https://developers.google.com/maps/documentation/places/web-service/text-search
- Google Maps Platform Policies: Places content caching, attribution, place ID 예외 등 provider compliance 기준
  - https://developers.google.com/maps/documentation/places/web-service/policies
- Overpass API: OpenStreetMap 데이터의 read-only query API
  - https://wiki.openstreetmap.org/wiki/Overpass_API
  - https://wiki.openstreetmap.org/wiki/OverpassQL
- OpenStreetMap Copyright and License: OSM attribution과 ODbL 조건
  - https://www.openstreetmap.org/copyright
- Open-Meteo Historical Weather API: WGS84 coordinate와 기간 기반 historical weather data
  - https://open-meteo.com/en/docs/historical-weather-api
- TomTom Traffic Flow Segment Data: 지정 좌표에 가까운 road fragment의 speed/travel time/confidence
  - https://developer.tomtom.com/traffic-api/documentation/tomtom-maps/traffic-flow/flow-segment-data
- glTF 2.0: node hierarchy, mesh, material, runtime delivery format
  - https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html
- glTF Transform: Node/Web에서 glTF 읽기, 편집, 쓰기, 최적화
  - https://gltf-transform.dev/
- glTF Validator: GLB/glTF artifact validation 기준
  - https://github.khronos.org/glTF-Validator/
- OGC 3D Tiles: 대규모 3D geospatial content streaming/rendering standard
  - https://www.ogc.org/standards/3DTiles/
