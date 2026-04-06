# Oversized File Modularization Notes

## 목적

대형 파일 분해 작업에서 **동작 유지(behavior parity)**를 보장하면서,
각 파일을 500 LOC 이하로 유지 가능한 구조로 재편한 내용을 정리한다.

이번 문서는 특히 다음 두 축을 중심으로 한다.

- `src/assets/compiler/building-mesh.builder.ts`
- `src/places/clients/overpass.client.ts`

또한 동일 캠페인에서 함께 정리된 타깃 파일 상태도 함께 기록한다.

---

## 결과 요약

### 타깃 파일 LOC (최종)

- `src/assets/compiler/building-mesh.builder.ts`: **14**
- `src/places/clients/overpass.client.ts`: **206**
- `src/assets/compiler/street-furniture-mesh.builder.ts`: **145**
- `src/assets/compiler/road-mesh.builder.ts`: **356**
- `src/assets/compiler/glb-material-factory.ts`: **2**
- `src/docs/swagger.dto.ts`: **5**
- `src/scene/scene.service.spec.ts`: **259**

요청 대상 파일은 모두 500 LOC 이하를 만족한다.

---

## 1) Building Mesh 분해

### 엔트리 포인트 전략

- 기존 import 호환성을 위해 `src/assets/compiler/building-mesh.builder.ts`를 유지한다.
- 이 파일은 이제 구현이 아닌 **명시적 re-export 배럴** 역할만 수행한다.

### 모듈 구성

- `src/assets/compiler/building-mesh.shell.builder.ts`
  - 쉘 매싱 생성
  - strategy 분기(`simple_extrude`, `podium_tower`, `stepped_tower`, `gable_lowrise`, `courtyard_block`, `fallback_massing`)
  - `pushExtrudedPolygon`, `insetRing` 등 질량(매싱) 핵심

- `src/assets/compiler/building-mesh.panels.builder.ts`
  - 파사드 힌트 기반 패널 생성
  - preset/facadeSpec 분기 조립

- `src/assets/compiler/building-mesh.roof-surface.builder.ts`
  - roof surface 전용 지오메트리 생성
  - 톤 필터링 + roof inset slab

- `src/assets/compiler/building-mesh.hero.builder.ts`
  - hero canopy / roof units / billboard planes
  - standalone billboards / landmark extras

- `src/assets/compiler/building-mesh.window.builder.ts`
  - 창호 패턴/프레임/실 생성

- `src/assets/compiler/building-mesh.entrance.builder.ts`
  - 출입구 recess/canopy/door 조립

- `src/assets/compiler/building-mesh.roof-equipment.builder.ts`
  - 옥상 설비(AC/antenna/mixed) 배치

- `src/assets/compiler/building-mesh.facade-frame.utils.ts`
  - facade frame 계산/분할
  - backing/slab/mullion volume 등 파사드 기반 유틸

- `src/assets/compiler/building-mesh.facade-band.utils.ts`
  - 수평 밴드/사인 밴드/빌보드 존/캐노피 밴드 조립

- `src/assets/compiler/building-mesh.geometry-primitives.ts`
  - `pushBox`, `pushQuad`, `pushTriangle`

- `src/assets/compiler/building-mesh.tone.utils.ts`
  - `resolveAccentTone`

### 호환성 포인트

- 외부 소비자(예: `glb-build-building-hero.stage.ts`, builder spec)는
  기존 경로 `../compiler/building-mesh.builder`를 그대로 사용한다.
- 공개 함수 이름/시그니처를 유지하고, 내부 구현만 파일 단위로 이동했다.

---

## 2) Overpass Client 분해

### 엔트리 포인트 전략

- 기존 경로/DI 호환을 위해 `src/places/clients/overpass.client.ts` 유지
- 해당 파일은 Nest Injectable façade + orchestration에 집중

### 모듈 구성

- `src/places/clients/overpass/overpass.types.ts`
  - Overpass 응답/엘리먼트 타입
  - `BuildPlacePackageOptions` 및 context 타입

- `src/places/clients/overpass/overpass.query.ts`
  - scope별 Overpass query 생성

- `src/places/clients/overpass/overpass.transport.ts`
  - endpoint fallback
  - scale fallback (`[1, 0.82, 0.64]`)
  - retry/backoff + 로깅

- `src/places/clients/overpass/overpass.partitions.ts`
  - 응답 dedupe
  - building/road/walkway/crossing/poi/furniture/vegetation/landCover/linearFeature 파티셔닝

- `src/places/clients/overpass/overpass.mapper.ts`
  - OSM element -> domain data 매핑
  - relation multipolygon 처리, ring/path sanitize, orientation normalize

- `src/places/clients/overpass/overpass.resolve.utils.ts`
  - lane/width/height/usage 해석 유틸
  - mapper LOC 500 초과 방지 목적 분리

### 호환성 포인트

- `OverpassClient` 클래스와 `withFetcher`, `buildPlacePackage` 공개 API 유지
- `BuildPlacePackageOptions`는 기존 파일 경로에서 re-export 유지
- `buildPlacePackage` 반환 타입은 `Promise<PlacePackage>`로 명시해 기존 타입 기대치를 유지

---

## 3) 검증 기록

분해 이후 다음 검증을 통과했다.

- `bun run type-check`
- `bun test src/assets/compiler/building-mesh.builder.spec.ts`
- `bun test src/places/clients/overpass.client.spec.ts`
- `bun run build`

---

## 4) 유지보수 가이드

1. 배럴/퍼사드 파일(`building-mesh.builder.ts`, `overpass.client.ts`)에는
   가능한 구현을 넣지 않고 orchestration/re-export만 유지한다.

2. 신규 로직 추가 시 우선 기존 책임에 맞는 모듈에 배치한다.
   - geometry primitive 변경: `building-mesh.geometry-primitives.ts`
   - overpass query 변경: `overpass.query.ts`
   - overpass retry/fallback 변경: `overpass.transport.ts`

3. 파일이 500 LOC에 근접하면 즉시 helper/util 모듈로 재분리한다.

4. 동작 변경이 우려되는 경우, 최소 다음 검증을 항상 수행한다.
   - type-check
   - 관련 unit spec
   - build
