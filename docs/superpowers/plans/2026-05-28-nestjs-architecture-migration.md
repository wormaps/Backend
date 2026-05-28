# NestJS Architecture Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 전체 Bun factory 패턴 모듈을 NestJS DI 기반 `@Module()` + `@Injectable()` 아키텍처로 전환하고, `packages/`를 `src/shared/`로 통합, `reality/`→`twin/` 흡수, `qa/`→`build/` 흡수, SPA 제거.

**Architecture:**
- 6개 도메인 모듈 (glb, twin, normalization, providers, render, build)
- `packages/contracts` + `packages/core` → `src/shared/contracts` + `src/shared/core`
- NestJS DI가 모든 서비스 인스턴스화 담당, 수동 `new Service()` 완전 제거
- `RealityTierResolverService`는 `TwinModule`에 귀속 후 export — RenderModule·BuildModule에서 import

**Tech Stack:** NestJS 11, pnpm 10, Bun (runtime), TypeScript, Zod 4, `@nestjs/testing`

---

## File Structure

### 생성
- `src/shared/contracts/` — packages/contracts/* 이동
- `src/shared/core/` — packages/core/* 이동 (logger/ 제외 — 삭제)
- `src/api/api.module.ts` — HTTP 레이어 @Module (http/ 대체)
- `src/api/build.controller.ts` — src/http/build.controller.ts 이동
- `src/api/build.gateway.service.ts` — src/http/build.gateway.service.ts 이동
- `src/twin/application/reality-tier-resolver.service.ts` — src/reality/application/ 이동
- `src/build/application/qa-gate.service.ts` — src/qa/application/ 이동

### 수정
- `CLAUDE.md` — pnpm 커맨드로 업데이트
- `tsconfig.json` — emitDecoratorMetadata, experimentalDecorators 확인
- `src/main.ts` — AppModule 기반으로 재작성
- `src/app.module.ts` — 진짜 NestJS @Module로 재작성
- `src/glb/glb.module.ts` + 3개 서비스 — @Module/@Injectable 변환
- `src/normalization/normalization.module.ts` + 1개 서비스
- `src/twin/twin.module.ts` + 7개 서비스 (reality 포함)
- `src/render/render.module.ts` + 3개 서비스
- `src/providers/providers.module.ts` + 4개 서비스/어댑터
- `src/build/build.module.ts` + 3개 서비스 (qa 포함)
- `src/api/build.controller.ts` — SPA 라우트 제거
- `src/api/build.gateway.service.ts` — NestJS DI 주입으로 재작성
- 5개 테스트 파일 — NestJS Testing 모듈로 재작성

### 삭제
- `packages/` (전체)
- `src/index.html`
- `src/core/` (전체)
- `src/http/` (전체, api/로 대체)
- `src/qa/` (build/로 통합)
- `src/reality/` (twin/로 통합)

---

## Task 1: pnpm 마이그레이션 & CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`
- Verify: `pnpm-workspace.yaml`
- Verify: `tsconfig.json`

- [X] **Step 1: CLAUDE.md 패키지매니저 섹션 업데이트**

`CLAUDE.md`에서 bun 관련 패키지 명령어를 pnpm으로 교체:

```markdown
Default to using pnpm as package manager, Bun as runtime.

- Use `pnpm install` instead of `npm install`, `yarn install`, or `bun install`
- Use `pnpm run <script>` instead of `npm run` or `bun run`
- Use `pnpm test` instead of `npm test` (calls bun test internally)
- Use `pnpm add <package>` to add dependencies
- Use `pnpm dlx <package>` instead of `npx` or `bunx`
- Bun automatically loads .env, so don't use dotenv.
- Scripts still run via Bun (bun --hot, bun test) — pnpm is only the package manager.
```

기존 Bun install/run 설명 라인들 제거.

- [X] **Step 2: tsconfig.json NestJS 데코레이터 설정 확인**

`tsconfig.json` 열어서 `compilerOptions`에 다음이 있는지 확인:
```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "strict": true,
    "target": "ES2021",
    "module": "NodeNext",
    "moduleResolution": "NodeNext"
  }
}
```
없으면 추가. `emitDecoratorMetadata: true`는 NestJS DI 필수.

- [X] **Step 3: @nestjs/testing devDependency 추가**

```bash
pnpm add -D @nestjs/testing
```

- [X] **Step 4: pnpm-workspace.yaml 확인**

`packages/`가 삭제될 예정이므로 workspace에 packages 경로가 없어야 함:
```yaml
allowBuilds:
  '@nestjs/core': true
  sharp: true
```
패키지 경로 섹션(`packages:`) 없는 상태 유지.

- [ ] **Step 5: 커밋**

```bash
git add CLAUDE.md tsconfig.json pnpm-workspace.yaml package.json
git commit -m "chore: migrate package manager to pnpm, enable NestJS decorator metadata"
```

---

## Task 2: packages/ → src/shared/ 파일 이동

**Files:**
- Create: `src/shared/contracts/` (packages/contracts/* 전체)
- Create: `src/shared/core/` (packages/core/* — logger/ 제외)
- Modify: `src/shared/index.ts`

> 이 태스크는 **파일 이동만**. import 경로 업데이트는 Task 3에서.

- [X] **Step 1: src/shared/contracts/ 생성 및 파일 복사**

```bash
cp -r /Users/user/wormapb/packages/contracts/* /Users/user/wormapb/src/shared/contracts/
```

복사 후 구조 확인:
```
src/shared/contracts/
  evidence-graph/evidence-graph.schema.ts
  evidence-graph/index.ts
  manifest/index.ts
  manifest/manifest.schema.ts
  mesh-plan/index.ts
  mesh-plan/mesh-plan.schema.ts
  normalized-entity/index.ts
  normalized-entity/normalized-entity.schema.ts
  qa/index.ts
  qa/qa.schema.ts
  render-intent/index.ts
  render-intent/render-intent.schema.ts
  source-snapshot/index.ts
  source-snapshot/source-snapshot.schema.ts
  twin-scene-graph/index.ts
  twin-scene-graph/twin-scene-graph.schema.ts
  validate.ts
  index.ts
```

- [X] **Step 2: src/shared/core/ 생성 및 파일 복사 (logger/ 제외)**

```bash
mkdir -p /Users/user/wormapb/src/shared/core
cp -r /Users/user/wormapb/packages/core/coordinates /Users/user/wormapb/src/shared/core/
cp -r /Users/user/wormapb/packages/core/geometry /Users/user/wormapb/src/shared/core/
cp -r /Users/user/wormapb/packages/core/hashes /Users/user/wormapb/src/shared/core/
cp -r /Users/user/wormapb/packages/core/schemas /Users/user/wormapb/src/shared/core/
cp /Users/user/wormapb/packages/core/index.ts /Users/user/wormapb/src/shared/core/index.ts
```

`packages/core/index.ts`에서 logger 관련 re-export 있으면 제거:

```typescript
// src/shared/core/index.ts — logger export 줄 제거
export * from './coordinates';
export * from './geometry';
export * from './hashes';
export * from './schemas';
// export * from './logger';  ← 이 줄 있으면 제거
```

- [X] **Step 3: src/shared/index.ts 업데이트**

```typescript
// src/shared/index.ts
export * from './result/result';
```

contracts와 core는 서브경로로 직접 import (index에서 re-export하지 않음 — 순환 방지).

- [ ] **Step 4: 커밋**

```bash
git add src/shared/
git commit -m "feat: copy packages/contracts and packages/core into src/shared"
```

---

## Task 3: 전체 import 경로 업데이트 (packages/ → src/shared/)

**Files:**
- Modify: `src/` 하위 packages/ 참조하는 모든 파일
- Modify: `test/` 하위 packages/ 참조하는 모든 파일

> BunLogger import는 이 태스크에서 **제거만** (교체는 Task 4-9에서 모듈별로).

- [X] **Step 1: packages/ 참조 파일 목록 확인**

```bash
grep -r "from '.*packages/" /Users/user/wormapb/src --include="*.ts" -l
grep -r "from '.*packages/" /Users/user/wormapb/test --include="*.ts" -l
```

- [X] **Step 2: contracts import 경로 변환 규칙**

각 파일에서 `packages/contracts/X` 참조를 상대경로로 변환.
깊이별 변환 예시:

| 파일 위치 | 기존 | 변환 후 |
|---|---|---|
| `src/glb/application/*.ts` | `../../../packages/contracts/manifest` | `../../shared/contracts/manifest` |
| `src/build/application/*.ts` | `../../../packages/contracts/manifest` | `../../shared/contracts/manifest` |
| `src/twin/application/*.ts` | `../../../packages/contracts/twin-scene-graph` | `../../shared/contracts/twin-scene-graph` |

패턴: `src/<domain>/application/` 에서 `shared/`까지는 항상 `../../shared/`.

- [X] **Step 3: core import 경로 변환**

| 파일 위치 | 기존 | 변환 후 |
|---|---|---|
| `src/glb/application/*.ts` | `../../../packages/core/geometry` | `../../shared/core/geometry` |
| `src/render/application/*.ts` | `../../../packages/core/geometry` | `../../shared/core/geometry` |

- [X] **Step 4: BunLogger import 제거 (교체 없이 제거만)**

```bash
grep -r "BunLogger" /Users/user/wormapb/src --include="*.ts" -l
```

각 파일에서 다음 두 줄 제거 (교체 코드는 Task 4-9에서 각 모듈 변환 시):
```typescript
// 제거할 줄들:
import { BunLogger } from '../../../packages/core/logger';
// 또는
import { BunLogger } from '../../shared/core/logger';

private readonly logger = new BunLogger({ level: 'info', service: 'xxx' });
```

- [X] **Step 5: test/ 파일 contracts/core import 업데이트**

```typescript
// 기존 (test 파일에서)
import { ... } from '../../packages/contracts/manifest';
// 변환
import { ... } from '../../src/shared/contracts/manifest';
```

- [X] **Step 6: type-check 실행하여 누락 경로 확인**

```bash
pnpm run type-check 2>&1 | head -50
```

오류 있으면 해당 경로 수정.

- [ ] **Step 7: 커밋**

```bash
git add src/ test/
git commit -m "refactor: update all import paths from packages/ to src/shared/"
```

---

## Task 4: GlbModule → NestJS @Module()

**Files:**
- Modify: `src/glb/glb.module.ts`
- Modify: `src/glb/application/glb-compiler.service.ts`
- Modify: `src/glb/application/glb-validation.service.ts`
- Modify: `src/glb/application/gltf-metadata.factory.ts`

- [ ] **Step 1: glb-compiler.service.ts — @Injectable + NestJS Logger**

```typescript
// src/glb/application/glb-compiler.service.ts (상단 변경 부분)
import { Injectable, Logger } from '@nestjs/common';
// ... 기존 gltf-transform, earcut, shared/contracts import 유지 ...

@Injectable()
export class GlbCompilerService {
  private readonly logger = new Logger(GlbCompilerService.name);

  constructor(private readonly metadataFactory: GltfMetadataFactory) {}

  async compile(input: CompileGlbInput): Promise<GlbArtifact> {
    this.logger.log('GLB compile started');
    // ... 기존 구현 유지 ...
  }
}
```

`BunLogger` 사용 메서드 매핑:
- `this.logger.info(msg)` → `this.logger.log(msg)`
- `this.logger.warn(msg)` → `this.logger.warn(msg)` (그대로)
- `this.logger.error(msg)` → `this.logger.error(msg)` (그대로)
- `this.logger.debug(msg)` → `this.logger.debug(msg)` (그대로)

- [ ] **Step 2: glb-validation.service.ts — @Injectable + NestJS Logger**

```typescript
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class GlbValidationService {
  private readonly logger = new Logger(GlbValidationService.name);
  // 기존 구현 유지, logger 메서드만 위 매핑 적용
}
```

- [ ] **Step 3: gltf-metadata.factory.ts — @Injectable**

```typescript
import { Injectable } from '@nestjs/common';

@Injectable()
export class GltfMetadataFactory {
  // 기존 구현 유지
}
```

- [ ] **Step 4: glb.module.ts — @Module()으로 완전 재작성**

```typescript
// src/glb/glb.module.ts
import { Module } from '@nestjs/common';

import { GlbCompilerService } from './application/glb-compiler.service';
import { GlbValidationService } from './application/glb-validation.service';
import { GltfMetadataFactory } from './application/gltf-metadata.factory';

@Module({
  providers: [GlbCompilerService, GlbValidationService, GltfMetadataFactory],
  exports: [GlbCompilerService, GlbValidationService],
})
export class GlbModule {}
```

- [ ] **Step 5: type-check**

```bash
pnpm run type-check 2>&1 | grep "glb" | head -20
```

- [ ] **Step 6: 커밋**

```bash
git add src/glb/
git commit -m "refactor: convert GlbModule to NestJS @Module with DI"
```

---

## Task 5: NormalizationModule → NestJS @Module()

**Files:**
- Modify: `src/normalization/normalization.module.ts`
- Modify: `src/normalization/application/normalized-entity-builder.service.ts`

- [ ] **Step 1: normalized-entity-builder.service.ts — @Injectable + NestJS Logger**

```typescript
import { Injectable, Logger } from '@nestjs/common';
// 기존 import 유지

@Injectable()
export class NormalizedEntityBuilderService {
  private readonly logger = new Logger(NormalizedEntityBuilderService.name);
  // 기존 구현, logger 메서드 매핑 적용
}
```

BunLogger 없으면 Logger 추가만.

- [ ] **Step 2: normalization.module.ts — @Module() 재작성**

```typescript
// src/normalization/normalization.module.ts
import { Module } from '@nestjs/common';

import { NormalizedEntityBuilderService } from './application/normalized-entity-builder.service';

@Module({
  providers: [NormalizedEntityBuilderService],
  exports: [NormalizedEntityBuilderService],
})
export class NormalizationModule {}
```

- [ ] **Step 3: type-check**

```bash
pnpm run type-check 2>&1 | grep "normalization" | head -10
```

- [ ] **Step 4: 커밋**

```bash
git add src/normalization/
git commit -m "refactor: convert NormalizationModule to NestJS @Module with DI"
```

---

## Task 6: TwinModule → NestJS @Module() + reality/ 흡수

**Files:**
- Create: `src/twin/application/reality-tier-resolver.service.ts` (reality/에서 이동)
- Modify: `src/twin/twin.module.ts`
- Modify: `src/twin/application/` 하위 6개 서비스

현재 `twin.module.ts`에서 확인된 내부 의존성:
- `TwinGraphBuilderService` ← TwinEntityProjectionService, SceneRelationshipBuilderService, TwinGraphValidationService, TwinSceneGraphMetadataFactory
- `TwinSceneGraphMetadataFactory` ← RealityTierResolverService (reality에서 이동)

- [ ] **Step 1: reality-tier-resolver.service.ts 이동**

```bash
cp /Users/user/wormapb/src/reality/application/reality-tier-resolver.service.ts \
   /Users/user/wormapb/src/twin/application/reality-tier-resolver.service.ts
```

파일 열어서 `@Injectable()` 추가:
```typescript
import { Injectable } from '@nestjs/common';

@Injectable()
export class RealityTierResolverService {
  // 기존 구현 유지
}
```

- [ ] **Step 2: twin 하위 서비스 5개 @Injectable 추가**

아래 5개 파일 각각에 `@Injectable()` 데코레이터 추가, NestJS Logger 추가:
- `src/twin/application/evidence-graph-builder.service.ts`
- `src/twin/application/scene-relationship-builder.service.ts`
- `src/twin/application/twin-entity-projection.service.ts`
- `src/twin/application/twin-graph-validation.service.ts`
- `src/twin/application/twin-scene-graph-metadata.factory.ts`

패턴 (각 파일):
```typescript
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class <ServiceClass> {
  private readonly logger = new Logger(<ServiceClass>.name);
  // 기존 구현 유지
}
```

- [ ] **Step 3: twin-graph-builder.service.ts — @Injectable + 생성자 주입 타입 변경**

현재 `new TwinGraphBuilderService(projection, relationship, validation, factory)` 형태.
NestJS DI에서는 constructor 타입으로 자동 주입 — `import type` → `import`로 변경:

```typescript
import { Injectable, Logger } from '@nestjs/common';
// import type → import (DI 리플렉션 필수)
import { TwinEntityProjectionService } from './twin-entity-projection.service';
import { SceneRelationshipBuilderService } from './scene-relationship-builder.service';
import { TwinGraphValidationService } from './twin-graph-validation.service';
import { TwinSceneGraphMetadataFactory } from './twin-scene-graph-metadata.factory';

@Injectable()
export class TwinGraphBuilderService {
  private readonly logger = new Logger(TwinGraphBuilderService.name);

  constructor(
    private readonly twinEntityProjection: TwinEntityProjectionService,
    private readonly sceneRelationshipBuilder: SceneRelationshipBuilderService,
    private readonly twinGraphValidation: TwinGraphValidationService,
    private readonly twinSceneGraphMetadata: TwinSceneGraphMetadataFactory,
  ) {}
  // 기존 구현 유지
}
```

- [ ] **Step 4: twin-scene-graph-metadata.factory.ts — RealityTierResolver 주입**

```typescript
import { Injectable } from '@nestjs/common';
import { RealityTierResolverService } from './reality-tier-resolver.service';

@Injectable()
export class TwinSceneGraphMetadataFactory {
  constructor(
    private readonly realityTierResolver: RealityTierResolverService,
  ) {}
  // 기존 구현 유지
}
```

- [ ] **Step 5: twin.module.ts — @Module() 재작성**

```typescript
// src/twin/twin.module.ts
import { Module } from '@nestjs/common';

import { EvidenceGraphBuilderService } from './application/evidence-graph-builder.service';
import { SceneRelationshipBuilderService } from './application/scene-relationship-builder.service';
import { TwinEntityProjectionService } from './application/twin-entity-projection.service';
import { TwinGraphBuilderService } from './application/twin-graph-builder.service';
import { TwinGraphValidationService } from './application/twin-graph-validation.service';
import { TwinSceneGraphMetadataFactory } from './application/twin-scene-graph-metadata.factory';
import { RealityTierResolverService } from './application/reality-tier-resolver.service';

@Module({
  providers: [
    EvidenceGraphBuilderService,
    SceneRelationshipBuilderService,
    TwinEntityProjectionService,
    TwinGraphBuilderService,
    TwinGraphValidationService,
    TwinSceneGraphMetadataFactory,
    RealityTierResolverService,
  ],
  exports: [
    EvidenceGraphBuilderService,
    TwinGraphBuilderService,
    RealityTierResolverService, // RenderModule, BuildModule에서 사용
  ],
})
export class TwinModule {}
```

- [ ] **Step 6: type-check**

```bash
pnpm run type-check 2>&1 | grep "twin\|reality" | head -20
```

- [ ] **Step 7: 커밋**

```bash
git add src/twin/
git commit -m "refactor: convert TwinModule to NestJS @Module, absorb RealityTierResolver"
```

---

## Task 7: RenderModule → NestJS @Module()

**Files:**
- Modify: `src/render/render.module.ts`
- Modify: `src/render/application/mesh-plan-builder.service.ts`
- Modify: `src/render/application/render-intent-policy.service.ts`
- Modify: `src/render/application/render-intent-resolver.service.ts`

현재 `renderModule`은 `realityModule.services.realityTierResolver`를 직접 사용.
새 구조: `TwinModule` import → NestJS가 `RealityTierResolverService` 주입.

- [ ] **Step 1: mesh-plan-builder.service.ts — @Injectable**

```typescript
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class MeshPlanBuilderService {
  private readonly logger = new Logger(MeshPlanBuilderService.name);
  // 기존 구현 유지
}
```

- [ ] **Step 2: render-intent-policy.service.ts — @Injectable**

```typescript
import { Injectable } from '@nestjs/common';

@Injectable()
export class RenderIntentPolicyService {
  // 기존 구현 유지
}
```

- [ ] **Step 3: render-intent-resolver.service.ts — @Injectable + 주입 타입 변경**

현재: `new RenderIntentResolverService(renderIntentPolicy, realityTierResolver)`.
```typescript
import { Injectable, Logger } from '@nestjs/common';
import { RenderIntentPolicyService } from './render-intent-policy.service';
import { RealityTierResolverService } from '../../twin/application/reality-tier-resolver.service';

@Injectable()
export class RenderIntentResolverService {
  private readonly logger = new Logger(RenderIntentResolverService.name);

  constructor(
    private readonly policy: RenderIntentPolicyService,
    private readonly realityTierResolver: RealityTierResolverService,
  ) {}
  // 기존 구현 유지
}
```

- [ ] **Step 4: render.module.ts — @Module() 재작성 (TwinModule import)**

```typescript
// src/render/render.module.ts
import { Module } from '@nestjs/common';

import { TwinModule } from '../twin/twin.module';
import { MeshPlanBuilderService } from './application/mesh-plan-builder.service';
import { RenderIntentPolicyService } from './application/render-intent-policy.service';
import { RenderIntentResolverService } from './application/render-intent-resolver.service';

@Module({
  imports: [TwinModule],
  providers: [MeshPlanBuilderService, RenderIntentPolicyService, RenderIntentResolverService],
  exports: [MeshPlanBuilderService, RenderIntentResolverService],
})
export class RenderModule {}
```

- [ ] **Step 5: type-check**

```bash
pnpm run type-check 2>&1 | grep "render" | head -20
```

- [ ] **Step 6: 커밋**

```bash
git add src/render/
git commit -m "refactor: convert RenderModule to NestJS @Module, inject RealityTierResolver from TwinModule"
```

---

## Task 8: ProvidersModule → NestJS @Module()

**Files:**
- Modify: `src/providers/providers.module.ts`
- Modify: `src/providers/application/snapshot-collector.service.ts`
- Modify: `src/providers/application/osm-scene-build.service.ts`
- Modify: `src/providers/infrastructure/overpass.adapter.ts`
- Modify: `src/providers/infrastructure/mapbox-dem.adapter.ts`

- [ ] **Step 1: 4개 서비스/어댑터 @Injectable 추가**

각 파일:
```typescript
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class <ServiceOrAdapterClass> {
  private readonly logger = new Logger(<ServiceOrAdapterClass>.name);
  // 기존 구현 유지
}
```

해당 파일들:
- `overpass.adapter.ts` — OverpassAdapter
- `mapbox-dem.adapter.ts` — MapboxDemAdapter
- `snapshot-collector.service.ts` — SnapshotCollectorService

- [ ] **Step 2: snapshot-collector.service.ts — 어댑터 생성자 주입**

현재 SnapshotCollectorService가 내부적으로 어댑터를 `new`로 생성하고 있으면, 생성자 주입으로 변경:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { OverpassAdapter } from '../infrastructure/overpass.adapter';
import { MapboxDemAdapter } from '../infrastructure/mapbox-dem.adapter';

@Injectable()
export class SnapshotCollectorService {
  private readonly logger = new Logger(SnapshotCollectorService.name);

  constructor(
    private readonly overpass: OverpassAdapter,
    private readonly mapboxDem: MapboxDemAdapter,
  ) {}
  // 기존 구현 유지
}
```

- [ ] **Step 3: osm-scene-build.service.ts — @Injectable**

```typescript
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class OsmSceneBuildService {
  private readonly logger = new Logger(OsmSceneBuildService.name);
  // 기존 구현 유지
  // setOrchestrator()가 있다면 유지
}
```

- [ ] **Step 4: providers.module.ts — @Module() 재작성**

`validateProviderApiKeys`는 plain function으로 유지 (main.ts에서 호출):

```typescript
// src/providers/providers.module.ts
import { Module } from '@nestjs/common';

import { SnapshotCollectorService } from './application/snapshot-collector.service';
import { OsmSceneBuildService } from './application/osm-scene-build.service';
import { OverpassAdapter } from './infrastructure/overpass.adapter';
import { MapboxDemAdapter } from './infrastructure/mapbox-dem.adapter';

@Module({
  providers: [SnapshotCollectorService, OsmSceneBuildService, OverpassAdapter, MapboxDemAdapter],
  exports: [SnapshotCollectorService],
})
export class ProvidersModule {}

// 스타트업 API 키 검증 (main.ts에서 호출)
export function validateProviderApiKeys(options: { strict: boolean }): void {
  // 기존 구현 유지
}
```

- [ ] **Step 5: type-check**

```bash
pnpm run type-check 2>&1 | grep "provider" | head -20
```

- [ ] **Step 6: 커밋**

```bash
git add src/providers/
git commit -m "refactor: convert ProvidersModule to NestJS @Module with DI"
```

---

## Task 9: BuildModule → NestJS @Module() + qa/ 흡수

**Files:**
- Create: `src/build/application/qa-gate.service.ts` (qa/에서 이동)
- Modify: `src/build/build.module.ts`
- Modify: `src/build/application/scene-build-orchestrator.service.ts`
- Modify: `src/build/application/build-manifest.factory.ts`
- Modify: `src/build/domain/scene-build.aggregate.ts`

현재 `SceneBuildOrchestratorService` 생성자:
```typescript
constructor(
  snapshotCollector, normalizedEntityBuilder, evidenceGraphBuilder,
  twinGraphBuilder, renderIntentResolver, meshPlanBuilder,
  qaGate, glbCompiler, glbValidation, manifestFactory
)
```
모두 NestJS가 자동 주입 — 기존 수동 파라미터 제거, `import type` → `import`.

- [ ] **Step 1: qa-gate.service.ts 이동 + @Injectable**

```bash
cp /Users/user/wormapb/src/qa/application/qa-gate.service.ts \
   /Users/user/wormapb/src/build/application/qa-gate.service.ts
```

파일 열어서 수정:
```typescript
import { Injectable, Logger } from '@nestjs/common';
import { RealityTierResolverService } from '../../twin/application/reality-tier-resolver.service';

@Injectable()
export class QaGateService {
  private readonly logger = new Logger(QaGateService.name);

  constructor(
    private readonly realityTierResolver: RealityTierResolverService,
  ) {}
  // 기존 구현 유지
}
```

- [ ] **Step 2: build-manifest.factory.ts — @Injectable**

```typescript
import { Injectable } from '@nestjs/common';

@Injectable()
export class BuildManifestFactory {
  // 기존 구현 유지
}
```

- [ ] **Step 3: scene-build.aggregate.ts 확인**

도메인 aggregate는 `@Injectable()` 불필요 (NestJS DI 대상 아님 — 순수 도메인 로직).
파일 내용 확인 후 변경 불필요하면 그대로 유지.

- [ ] **Step 4: scene-build-orchestrator.service.ts — @Injectable + import type 제거**

```typescript
import { Injectable, Logger } from '@nestjs/common';
// import type → import (NestJS DI 리플렉션 필수)
import { GlbCompilerService } from '../../glb/application/glb-compiler.service';
import { GlbValidationService } from '../../glb/application/glb-validation.service';
import { NormalizedEntityBuilderService } from '../../normalization/application/normalized-entity-builder.service';
import { SnapshotCollectorService } from '../../providers/application/snapshot-collector.service';
import { QaGateService } from './qa-gate.service';
import { MeshPlanBuilderService } from '../../render/application/mesh-plan-builder.service';
import { RenderIntentResolverService } from '../../render/application/render-intent-resolver.service';
import { EvidenceGraphBuilderService } from '../../twin/application/evidence-graph-builder.service';
import { TwinGraphBuilderService } from '../../twin/application/twin-graph-builder.service';
import { BuildManifestFactory } from './build-manifest.factory';
// contracts import는 src/shared/... 경로 사용

@Injectable()
export class SceneBuildOrchestratorService {
  private readonly logger = new Logger(SceneBuildOrchestratorService.name);

  constructor(
    private readonly snapshotCollector: SnapshotCollectorService,
    private readonly normalizedEntityBuilder: NormalizedEntityBuilderService,
    private readonly evidenceGraphBuilder: EvidenceGraphBuilderService,
    private readonly twinGraphBuilder: TwinGraphBuilderService,
    private readonly renderIntentResolver: RenderIntentResolverService,
    private readonly meshPlanBuilder: MeshPlanBuilderService,
    private readonly qaGate: QaGateService,
    private readonly glbCompiler: GlbCompilerService,
    private readonly glbValidation: GlbValidationService,
    private readonly manifestFactory: BuildManifestFactory,
  ) {}
  // 기존 run() 구현 유지
}
```

- [ ] **Step 5: build.module.ts — @Module() 재작성**

```typescript
// src/build/build.module.ts
import { Module } from '@nestjs/common';

import { GlbModule } from '../glb/glb.module';
import { TwinModule } from '../twin/twin.module';
import { NormalizationModule } from '../normalization/normalization.module';
import { ProvidersModule } from '../providers/providers.module';
import { RenderModule } from '../render/render.module';
import { SceneBuildOrchestratorService } from './application/scene-build-orchestrator.service';
import { BuildManifestFactory } from './application/build-manifest.factory';
import { QaGateService } from './application/qa-gate.service';

@Module({
  imports: [GlbModule, TwinModule, NormalizationModule, ProvidersModule, RenderModule],
  providers: [SceneBuildOrchestratorService, BuildManifestFactory, QaGateService],
  exports: [SceneBuildOrchestratorService],
})
export class BuildModule {}
```

- [ ] **Step 6: type-check**

```bash
pnpm run type-check 2>&1 | grep "build\|qa" | head -30
```

- [ ] **Step 7: 커밋**

```bash
git add src/build/
git commit -m "refactor: convert BuildModule to NestJS @Module, absorb QaGateService"
```

---

## Task 10: ApiModule — http/ → api/ 이동 + SPA 제거

**Files:**
- Create: `src/api/api.module.ts`
- Create: `src/api/build.controller.ts` (src/http/에서 이동)
- Create: `src/api/build.gateway.service.ts` (src/http/에서 이동)
- Delete: `src/index.html`

- [ ] **Step 1: src/api/ 디렉토리 생성 및 파일 이동**

```bash
mkdir /Users/user/wormapb/src/api
cp /Users/user/wormapb/src/http/build.controller.ts /Users/user/wormapb/src/api/build.controller.ts
cp /Users/user/wormapb/src/http/build.gateway.service.ts /Users/user/wormapb/src/api/build.gateway.service.ts
```

- [ ] **Step 2: build.gateway.service.ts — NestJS DI로 재작성**

현재 `appModule.services.sceneBuildOrchestrator` 수동 참조를 생성자 주입으로 교체:

```typescript
// src/api/build.gateway.service.ts
import { Injectable } from '@nestjs/common';

import { SceneBuildOrchestratorService } from '../build/application/scene-build-orchestrator.service';
import type { GlbArtifact } from '../glb/application/glb-compiler.service';
import type { SceneBuildRunResult } from '../build/application/scene-build-run-result';

@Injectable()
export class BuildGatewayService {
  private latestGlb: GlbArtifact | null = null;

  constructor(
    private readonly orchestrator: SceneBuildOrchestratorService,
  ) {}

  async build(params: {
    sceneId: string;
    lat: number;
    lng: number;
    radius: number;
  }): Promise<SceneBuildRunResult> {
    // 기존 build() 내부 로직 유지
    // appModule.services.sceneBuildOrchestrator.run() → this.orchestrator.run()
    const result = await this.orchestrator.run(/* 기존 파라미터 구성 그대로 */);
    if (result.kind === 'completed') {
      this.latestGlb = result.glbArtifact;
    }
    return result;
  }

  getLatestGlb(): GlbArtifact | null {
    return this.latestGlb;
  }
}
```

> 주의: `this.orchestrator.run()`에 전달하는 `SceneBuildMvpInput` 구성 로직은 기존 gateway에서 그대로 복사. lat/lng/radius → scope 변환 로직 유지.

- [ ] **Step 3: build.controller.ts — SPA 라우트 제거 + import 경로 수정**

```typescript
// src/api/build.controller.ts
import { Body, Controller, Get, HttpCode, InternalServerErrorException, Post, Res } from '@nestjs/common';
import type { Response } from 'express';

import { BuildGatewayService } from './build.gateway.service';
// readFileSync, join 제거 (SPA 라우트 없어짐)

type BuildRequestDto = {
  sceneId?: string;
  lat?: number;
  lng?: number;
  radius?: number;
};

@Controller()
export class BuildController {
  constructor(private readonly gateway: BuildGatewayService) {}

  @Get('/health')
  health() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('/api')
  apiDocs() {
    // 기존 구현 유지
  }

  @Post('/api/build')
  @HttpCode(200)
  async build(@Body() body: BuildRequestDto, @Res() res: Response) {
    // 기존 구현 유지
  }

  @Get('/api/build/download')
  async download(@Res() res: Response) {
    // 기존 구현 유지
  }

  // @Get('/') root() { ... } ← 이 라우트 완전 제거
}
```

- [ ] **Step 4: api.module.ts 생성**

```typescript
// src/api/api.module.ts
import { Module } from '@nestjs/common';

import { BuildModule } from '../build/build.module';
import { BuildController } from './build.controller';
import { BuildGatewayService } from './build.gateway.service';

@Module({
  imports: [BuildModule],
  controllers: [BuildController],
  providers: [BuildGatewayService],
})
export class ApiModule {}
```

- [ ] **Step 5: src/index.html 삭제**

```bash
rm /Users/user/wormapb/src/index.html
```

- [ ] **Step 6: type-check**

```bash
pnpm run type-check 2>&1 | grep "api\|http\|gateway\|controller" | head -30
```

- [ ] **Step 7: 커밋**

```bash
git add src/api/ src/
git commit -m "refactor: rename http/ to api/, convert to NestJS @Module, remove SPA"
```

---

## Task 11: AppModule + main.ts 재작성

**Files:**
- Modify: `src/app.module.ts`
- Modify: `src/main.ts`
- Delete: `src/core/create-wormap-app.ts` (Bun factory 잔재)

- [ ] **Step 1: app.module.ts 완전 재작성**

```typescript
// src/app.module.ts
import { Module } from '@nestjs/common';

import { ApiModule } from './api/api.module';

@Module({
  imports: [ApiModule],
})
export class AppModule {}
```

- [ ] **Step 2: main.ts 재작성**

```typescript
// src/main.ts
import 'reflect-metadata';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { validateProviderApiKeys } from './providers/providers.module';

const logger = new Logger('bootstrap');

async function bootstrap(): Promise<void> {
  validateProviderApiKeys({ strict: process.env.NODE_ENV === 'production' });
  const app = await NestFactory.create(AppModule);
  const port = Number.parseInt(process.env.PORT ?? '8080', 10);
  await app.listen(port);
  logger.log(`WorMap v2 running at http://localhost:${port}`);
  logger.log(`API docs at http://localhost:${port}/api`);
}

void bootstrap();
```

- [ ] **Step 3: src/core/ 삭제**

```bash
rm -rf /Users/user/wormapb/src/core
```

- [ ] **Step 4: 전체 type-check**

```bash
pnpm run type-check 2>&1 | head -50
```

오류 없어야 함.

- [ ] **Step 5: 커밋**

```bash
git add src/app.module.ts src/main.ts
git commit -m "refactor: wire AppModule as NestJS root, remove Bun factory app wiring"
```

---

## Task 12: 테스트 재작성

**Files:**
- Modify: `test/contracts/schema-validation.test.ts`
- Modify: `test/fixtures/phase2-fixtures.test.ts`
- Modify: `test/scripts/glb-smoke.test.ts`
- Modify: `test/src/glb-validation.service.test.ts`
- Modify: `test/src/scene-build-validation-failure.test.ts`

### 패턴: Bun factory → NestJS Testing

기존 패턴:
```typescript
import { glbModule } from '../../src/glb/glb.module';
const glbCompiler = glbModule.services.glbCompiler;
```

새 패턴:
```typescript
import { Test } from '@nestjs/testing';
import { GlbModule } from '../../src/glb/glb.module';
import { GlbCompilerService } from '../../src/glb/application/glb-compiler.service';

let glbCompiler: GlbCompilerService;
beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({
    imports: [GlbModule],
  }).compile();
  glbCompiler = moduleRef.get(GlbCompilerService);
});
```

- [ ] **Step 1: test/contracts/schema-validation.test.ts 업데이트**

contracts import만 경로 변경 (NestJS testing 불필요):
```typescript
// 기존
import { ... } from '../../packages/contracts/manifest';
// 변경
import { ... } from '../../src/shared/contracts/manifest';
```

- [X] **Step 2: test/fixtures/phase2-fixtures.test.ts 업데이트**

fixtures 경로 변경:
```typescript
// 기존
import { ... } from '../../fixtures/phase2';
// 변경
import { ... } from '../../fixtures';
```

- [ ] **Step 3: test/scripts/glb-smoke.test.ts — NestJS 앱으로 재작성**

기존: `createWorMapMvpApp()` 사용.
```typescript
// test/scripts/glb-smoke.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { SceneBuildOrchestratorService } from '../../src/build/application/scene-build-orchestrator.service';
import { baselineFixtures } from '../../fixtures';

let app: INestApplication;
let orchestrator: SceneBuildOrchestratorService;

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  app = moduleRef.createNestApplication();
  await app.init();
  orchestrator = moduleRef.get(SceneBuildOrchestratorService);
});

afterAll(async () => {
  await app.close();
});

describe('GLB smoke test', () => {
  it('builds a GLB from baseline fixture', async () => {
    const fixture = baselineFixtures[0];
    if (!fixture) throw new Error('No baseline fixture');
    const result = await orchestrator.run(fixture);
    expect(result.kind).toBe('completed');
    if (result.kind === 'completed') {
      expect(result.glbArtifact.bytes.byteLength).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 4: test/src/glb-validation.service.test.ts — NestJS Testing으로 재작성**

기존: `glbModule.services.glbCompiler`, `glbModule.services.glbValidation` 직접 접근.

```typescript
// test/src/glb-validation.service.test.ts
import { describe, it, expect, beforeAll } from 'bun:test';
import { Test } from '@nestjs/testing';
import { GlbModule } from '../../src/glb/glb.module';
import { GlbCompilerService } from '../../src/glb/application/glb-compiler.service';
import { GlbValidationService } from '../../src/glb/application/glb-validation.service';
import { baselineFixtures } from '../../fixtures';
// 기존 테스트 내용에 맞게 추가 import

let glbCompiler: GlbCompilerService;
let glbValidation: GlbValidationService;

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({
    imports: [GlbModule],
  }).compile();
  glbCompiler = moduleRef.get(GlbCompilerService);
  glbValidation = moduleRef.get(GlbValidationService);
});

// 기존 test() 케이스들 유지, glbModule.services.xxx → glbCompiler/glbValidation 변수로 교체
```

- [ ] **Step 5: test/src/scene-build-validation-failure.test.ts — Mock 오버라이드 패턴**

기존: 수동으로 `RejectingGlbValidationService` 생성 후 orchestrator에 주입.

```typescript
// test/src/scene-build-validation-failure.test.ts
import { describe, it, expect, beforeAll } from 'bun:test';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { SceneBuildOrchestratorService } from '../../src/build/application/scene-build-orchestrator.service';
import { GlbValidationService, type GlbValidationResult } from '../../src/glb/application/glb-validation.service';
import { baselineFixtures } from '../../fixtures';

class RejectingGlbValidationService extends GlbValidationService {
  override async validate(): Promise<GlbValidationResult> {
    return {
      passed: false,
      issues: [{ code: 'TEST_REJECT', message: 'forced rejection', severity: 'Error' }],
    };
  }
}

let orchestrator: SceneBuildOrchestratorService;

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(GlbValidationService)
    .useClass(RejectingGlbValidationService)
    .compile();

  orchestrator = moduleRef.get(SceneBuildOrchestratorService);
});

describe('scene build — validation failure', () => {
  it('returns glb_validation_failure when validation rejects', async () => {
    const fixture = baselineFixtures[0];
    if (!fixture) throw new Error('No fixture');
    const result = await orchestrator.run(fixture);
    expect(result.kind).toBe('glb_validation_failure');
  });
});
```

- [X] **Step 6: 테스트 실행**

```bash
pnpm test 2>&1 | tail -30
```

실패하는 테스트 확인, import 경로/타입 오류 수정.

- [ ] **Step 7: 커밋**

```bash
git add test/
git commit -m "test: rewrite tests for NestJS DI testing module pattern"
```

---

## Task 13: 정리 & 최종 검증

**Files:**
- Delete: `packages/` (전체)
- Delete: `src/http/` (api/로 대체됨)
- Delete: `src/qa/` (build/로 통합)
- Delete: `src/reality/` (twin/로 통합)

- [ ] **Step 1: 사용하지 않는 디렉토리 삭제**

```bash
rm -rf /Users/user/wormapb/packages
rm -rf /Users/user/wormapb/src/http
rm -rf /Users/user/wormapb/src/qa
rm -rf /Users/user/wormapb/src/reality
```

- [ ] **Step 2: 남은 BunLogger 참조 없는지 확인**

```bash
grep -r "BunLogger\|packages/core/logger" /Users/user/wormapb/src --include="*.ts"
```

결과 없어야 함.

- [ ] **Step 3: packages/ 참조 없는지 확인**

```bash
grep -r "from '.*packages/" /Users/user/wormapb/src --include="*.ts"
grep -r "from '.*packages/" /Users/user/wormapb/test --include="*.ts"
```

결과 없어야 함.

- [X] **Step 4: 전체 type-check**

```bash
pnpm run type-check
```

오류 없어야 함.

- [X] **Step 5: 전체 테스트 실행**

```bash
pnpm test
```

모든 테스트 통과 확인.

- [ ] **Step 6: 앱 기동 확인**

```bash
pnpm run start &
sleep 3
curl http://localhost:8080/health
curl -X POST http://localhost:8080/api/build \
  -H "Content-Type: application/json" \
  -d '{"sceneId":"test","lat":37.498,"lng":127.0277,"radius":150}'
kill %1
```

Expected `/health` response: `{"status":"ok","timestamp":"..."}`

- [ ] **Step 7: 최종 커밋**

```bash
git add -A
git commit -m "refactor: complete NestJS DI architecture migration — remove packages/, Bun factory modules, SPA"
```

---

## 모듈 의존성 최종 구조

```
AppModule
  └── ApiModule
        ├── BuildController
        ├── BuildGatewayService
        └── BuildModule (import)
              ├── GlbModule        → GlbCompilerService, GlbValidationService
              ├── TwinModule       → EvidenceGraphBuilderService, TwinGraphBuilderService, RealityTierResolverService
              ├── NormalizationModule → NormalizedEntityBuilderService
              ├── ProvidersModule  → SnapshotCollectorService
              └── RenderModule     → MeshPlanBuilderService, RenderIntentResolverService
                    └── TwinModule (import, for RealityTierResolverService)
```

> RenderModule과 BuildModule 양쪽이 TwinModule을 import하지만, NestJS는 싱글톤 컨테이너이므로 `RealityTierResolverService` 인스턴스는 하나만 생성됨.
