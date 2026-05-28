# WorMap Phase 2 — Window Mesh & Per-Building DEM Elevation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add procedural window mesh to buildings and replace single-point DEM sampling with per-building centroid sampling using one tile fetch per scene.

**Architecture:** Three independent improvements layered onto the Phase 1 pipeline. (1) pngjs install makes the DEM adapter functional. (2) `MapboxDemAdapter.getElevationsForPoints` downloads one tile and samples all building centroids — O(1) HTTP calls per scene regardless of building count. (3) Window nodes are emitted as GLB children of each building node using a new `building_windows` primitive and shared dark-glass material.

**Tech Stack:** Bun, gltf-transform, pngjs (new), Mapbox Terrain-RGB tiles, earcut (existing)

---

## Affected Files

| File | Change |
|------|--------|
| `packages/contracts/mesh-plan/index.ts` | add `'building_windows'` primitive + `'window'` role |
| `packages/contracts/mesh-plan/mesh-plan.schema.ts` | same for Zod schema |
| `src/providers/infrastructure/mapbox-dem.adapter.ts` | add `getElevationsForPoints`, keep `getElevation` as wrapper |
| `src/providers/application/osm-scene-build.service.ts` | per-building centroid sampling |
| `src/render/application/mesh-plan-builder.service.ts` | emit window child node for each building |
| `src/glb/application/glb-compiler.service.ts` | `createWindowPositions`, window material PBR, placeholder for `building_windows` |

---

## Task 1: Install pngjs

**Files:**
- Modify: `package.json` (via bun add)

- [ ] **Step 1: Install pngjs**

```bash
bun add pngjs
bun add -d @types/pngjs
```

Expected output: `+ pngjs@X.Y.Z` and `+ @types/pngjs@X.Y.Z`

- [ ] **Step 2: Run type check**

```bash
bun run type-check
```

Expected: zero errors (the `@ts-expect-error` in `mapbox-dem.adapter.ts` line 27 will now warn — fix it in Step 3)

- [ ] **Step 3: Remove `@ts-expect-error` now that pngjs types are installed**

In `src/providers/infrastructure/mapbox-dem.adapter.ts`, replace the `decodePng` method:

```ts
private async decodePng(bytes: Uint8Array): Promise<Uint8Array> {
  // pngjs is now a real dependency — no need for ts-expect-error.
  // Throws on failure so callers (enrichElevation) fall back to baseY=0.
  const { PNG } = await import('pngjs');
  const png = PNG.sync.read(Buffer.from(bytes));
  const buf = png.data as Buffer;
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
}
```

- [ ] **Step 4: Run type check again**

```bash
bun run type-check
```

Expected: zero errors

- [ ] **Step 5: Run tests**

```bash
bun test
```

Expected: 84 pass, 0 fail

- [ ] **Step 6: Commit**

```bash
git add package.json bun.lock src/providers/infrastructure/mapbox-dem.adapter.ts
git commit -m "feat: install pngjs for real Mapbox DEM PNG decoding"
```

---

## Task 2: Batch Per-Building DEM Sampling (one tile fetch per scene)

**Files:**
- Modify: `src/providers/infrastructure/mapbox-dem.adapter.ts`
- Modify: `src/providers/application/osm-scene-build.service.ts`

**Context:** At Mapbox zoom=12 a tile covers ~9.77 km. A 300m-radius scene fits within one tile. Current code calls `getElevation(origin)` once and applies the same `baseY` to every building. This task: fetch the tile once, sample each building's footprint centroid pixel → true per-building elevation variation.

### 2a — Add `getElevationsForPoints` to adapter

- [ ] **Step 1: Rewrite `mapbox-dem.adapter.ts`**

Replace the entire file:

```ts
export class MapboxDemAdapter {
  constructor(private readonly token: string) {}

  /** Convenience wrapper — single point. */
  async getElevation(lat: number, lng: number): Promise<number> {
    const [elev] = await this.getElevationsForPoints({ lat, lng }, [{ lat, lng }]);
    return elev ?? 0;
  }

  /**
   * Fetch ONE tile (zoom 12) and sample elevation for every point.
   * All points are expected to fall within the same tile as `origin`.
   * One HTTP call regardless of point count.
   */
  async getElevationsForPoints(
    origin: { lat: number; lng: number },
    points: Array<{ lat: number; lng: number }>,
  ): Promise<number[]> {
    if (points.length === 0) return [];
    const zoom = 12;
    const { tileX, tileY } = this.latLngToTilePixel(origin.lat, origin.lng, zoom);
    const rgba = await this.fetchTile(zoom, tileX, tileY);

    return points.map(({ lat, lng }) => {
      const { pixelX, pixelY } = this.latLngToTilePixel(lat, lng, zoom);
      const offset = (pixelY * 256 + pixelX) * 4;
      const r = rgba[offset] ?? 0;
      const g = rgba[offset + 1] ?? 0;
      const b = rgba[offset + 2] ?? 0;
      return -10000 + (r * 65536 + g * 256 + b) * 0.1;
    });
  }

  private async fetchTile(zoom: number, tileX: number, tileY: number): Promise<Uint8Array> {
    const url = `https://api.mapbox.com/v4/mapbox.terrain-rgb/${zoom}/${tileX}/${tileY}.pngraw?access_token=${this.token}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Mapbox DEM fetch failed: ${response.status} ${response.statusText}`);
    }
    return this.decodePng(new Uint8Array(await response.arrayBuffer()));
  }

  private async decodePng(bytes: Uint8Array): Promise<Uint8Array> {
    const { PNG } = await import('pngjs');
    const png = PNG.sync.read(Buffer.from(bytes));
    const buf = png.data as Buffer;
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  }

  private latLngToTilePixel(
    lat: number,
    lng: number,
    zoom: number,
  ): { tileX: number; tileY: number; pixelX: number; pixelY: number } {
    const n = Math.pow(2, zoom);
    const tileXFrac = ((lng + 180) / 360) * n;
    const latRad = (lat * Math.PI) / 180;
    const tileYFrac =
      ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
    const tileX = Math.floor(tileXFrac);
    const tileY = Math.floor(tileYFrac);
    const pixelX = Math.min(255, Math.max(0, Math.floor((tileXFrac - tileX) * 256)));
    const pixelY = Math.min(255, Math.max(0, Math.floor((tileYFrac - tileY) * 256)));
    return { tileX, tileY, pixelX, pixelY };
  }
}
```

### 2b — Per-building centroid sampling in OsmSceneBuildService

- [ ] **Step 2: Rewrite `enrichElevation` and add `buildingCentroid` helper in `osm-scene-build.service.ts`**

Replace the `enrichElevation` method (lines 106–122):

```ts
private async enrichElevation(
  entities: OSMEntityData[],
  origin: { lat: number; lng: number },
): Promise<void> {
  if (!this.dem) return;
  try {
    const buildings = entities.filter((e) => e.entityType === 'building');
    if (buildings.length === 0) return;

    const centroids = buildings.map((b) => this.buildingCentroid(b, origin));
    const elevations = await this.dem.getElevationsForPoints(origin, centroids);

    for (let i = 0; i < buildings.length; i++) {
      const building = buildings[i]!;
      const elevation = elevations[i] ?? 0;
      (building.geometry as { baseY?: number }).baseY = elevation;
    }

    this.logger.info('Per-building elevation applied', { buildingCount: buildings.length });
  } catch (err) {
    this.logger.warn('Elevation enrichment failed; using baseY=0', { error: String(err) });
  }
}

/**
 * Compute approximate lat/lng for a building's footprint centroid.
 * Local coordinate system: x = East metres, z = North metres (from wgs84ToEnu).
 */
private buildingCentroid(
  entity: OSMEntityData,
  origin: { lat: number; lng: number },
): { lat: number; lng: number } {
  const outer =
    (entity.geometry as { footprint?: { outer: Array<{ x: number; z: number }> } }).footprint
      ?.outer ?? [];
  if (outer.length === 0) return origin;

  const cx = outer.reduce((s, p) => s + p.x, 0) / outer.length;
  const cz = outer.reduce((s, p) => s + p.z, 0) / outer.length;

  const EARTH_RADIUS = 6_371_000;
  const latRad = (origin.lat * Math.PI) / 180;
  const deltaLat = (cz / EARTH_RADIUS) * (180 / Math.PI); // z = North metres
  const deltaLng = (cx / (EARTH_RADIUS * Math.cos(latRad))) * (180 / Math.PI); // x = East metres

  return { lat: origin.lat + deltaLat, lng: origin.lng + deltaLng };
}
```

- [ ] **Step 3: Run type check**

```bash
bun run type-check
```

Expected: zero errors

- [ ] **Step 4: Run tests**

```bash
bun test
```

Expected: 84 pass, 0 fail

- [ ] **Step 5: Commit**

```bash
git add src/providers/infrastructure/mapbox-dem.adapter.ts \
        src/providers/application/osm-scene-build.service.ts
git commit -m "feat: batch DEM sampling — one tile fetch, per-building centroid elevation"
```

---

## Task 3: Window Mesh with Glass Material

**Files:**
- Modify: `packages/contracts/mesh-plan/index.ts`
- Modify: `packages/contracts/mesh-plan/mesh-plan.schema.ts`
- Modify: `src/render/application/mesh-plan-builder.service.ts`
- Modify: `src/glb/application/glb-compiler.service.ts`

**Algorithm overview:**

For each building, `MeshPlanBuilderService` emits a second node (`building_windows`) as a child of the body node. The GLB compiler's `createWindowPositions` iterates each wall edge, computes how many windows fit, and emits inset quad pairs (2 triangles per window). The window material is a shared dark-glass PBR material (not per-building).

Window grid constants:
- `INSET = 0.08` m — window recessed into wall plane
- `SIDE_MARGIN = 0.6` m — clearance from wall edges
- `WIN_SPACING = 2.5` m — centre-to-centre spacing
- `WIN_WIDTH = 1.2` m — window width
- `WIN_HEIGHT = 1.4` m — window height
- `BOTTOM_MARGIN = 0.8` m — sill height above floor

### 3a — Extend contracts

- [ ] **Step 1: Add `building_windows` primitive and `window` role to `packages/contracts/mesh-plan/index.ts`**

Replace the `MeshPlanNode` and `MaterialPlan` types:

```ts
export type MeshPlanNode = {
  id: string;
  entityId: string;
  parentId?: string;
  name: string;
  primitive: 'terrain' | 'road' | 'walkway' | 'building_massing' | 'building_windows' | 'poi_marker';
  pivot: { x: number; y: number; z: number };
  materialId: string;
  /** Entity geometry for GLB mesh generation. Falls back to placeholder when undefined. */
  geometry?: MeshGeometry;
};

export type MaterialPlan = {
  id: string;
  name: string;
  role: 'terrain' | 'road' | 'building' | 'window' | 'poi' | 'debug';
  baseColor?: [number, number, number]; // linear RGB 0–1
};
```

- [ ] **Step 2: Add `building_windows` primitive and `window` role to `packages/contracts/mesh-plan/mesh-plan.schema.ts`**

Replace the `MeshPlanNodeSchema` primitive enum and `MaterialPlanSchema` role enum:

```ts
export const MeshPlanNodeSchema = z.object({
  id: z.string(),
  entityId: z.string(),
  parentId: z.string().optional(),
  name: z.string(),
  primitive: z.enum([
    'terrain',
    'road',
    'walkway',
    'building_massing',
    'building_windows',
    'poi_marker',
  ]),
  pivot: z.object({
    x: z.number(),
    y: z.number(),
    z: z.number(),
  }),
  materialId: z.string(),
  geometry: MeshGeometrySchema.optional(),
});
export type MeshPlanNode = z.infer<typeof MeshPlanNodeSchema>;

export const MaterialPlanSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.enum(['terrain', 'road', 'building', 'window', 'poi', 'debug']),
  baseColor: z.tuple([z.number(), z.number(), z.number()]).optional(),
});
export type MaterialPlan = z.infer<typeof MaterialPlanSchema>;
```

### 3b — Emit window child nodes in MeshPlanBuilder

- [ ] **Step 3: Add window node emission in `src/render/application/mesh-plan-builder.service.ts`**

Change the main `build` loop and add `resolveNodes` method. Replace the loop body in `build`:

```ts
for (const intent of intentSet.intents) {
  const entity = entityById.get(intent.entityId);
  if (entity === undefined) continue;
  nodes.push(...this.resolveNodes(entity, intent, materials));
}
```

Add new method `resolveNodes` (replace the old inline node push logic):

```ts
private resolveNodes(
  entity: TwinEntity,
  intent: RenderIntentSet['intents'][number],
  materials: Map<string, MaterialPlan>,
): MeshPlanNode[] {
  const nodeSpec = this.resolveNodeSpec(entity, intent.visualMode);
  if (nodeSpec === null) return [];

  const material = this.ensureMaterial(materials, nodeSpec.materialRole, entity);
  const bodyId = `node:${entity.id}`;
  const bodyNode: MeshPlanNode = {
    id: bodyId,
    entityId: entity.id,
    name: `${entity.type}:${intent.visualMode}`,
    primitive: nodeSpec.primitive,
    pivot: this.resolvePivot(entity),
    materialId: material.id,
    geometry: this.resolveGeometry(entity),
  };

  const result: MeshPlanNode[] = [bodyNode];

  // Add glass window node as child of building body node.
  if (entity.type === 'building' && nodeSpec.primitive === 'building_massing') {
    const windowMaterial = this.ensureMaterial(materials, 'window', entity);
    result.push({
      id: `window:${entity.id}`,
      entityId: entity.id,
      parentId: bodyId,
      name: `building:windows:${entity.id.slice(-6)}`,
      primitive: 'building_windows',
      pivot: this.resolvePivot(entity),
      materialId: windowMaterial.id,
      geometry: this.resolveGeometry(entity),
    });
  }

  return result;
}
```

Also update `ensureMaterial` — the `window` role is shared (not per-building), so the existing `role:${role}` key path already handles it correctly. No change needed there.

### 3c — Window geometry in GLB compiler

- [ ] **Step 4: Add window material PBR handling in `glb-compiler.service.ts` (in the material creation loop)**

After the existing `if (materialPlan.baseColor !== undefined)` block, add:

```ts
if (materialPlan.role === 'window') {
  material.setDoubleSided(true);
  material.setBaseColorFactor([0.06, 0.09, 0.14, 1.0]); // dark steel blue, linear sRGB
  material.setMetallicFactor(0.85);
  material.setRoughnessFactor(0.08);
}
```

- [ ] **Step 5: Add placeholder for `building_windows` in `createPlaceholderPositions`**

In the `switch (primitive)` inside `createPlaceholderPositions`, add `building_windows` to the `building_massing` case:

```ts
case 'building_massing':
case 'building_windows':
  positions = new Float32Array([
    x, y, z, x + 1, y, z, x + 1, y, z + 1,
    x, y, z, x + 1, y, z + 1, x, y, z + 1,
  ]);
  break;
```

- [ ] **Step 6: Add `createWindowPositions` method in `glb-compiler.service.ts`**

Add after the `createBuildingPositions` method:

```ts
private createWindowPositions(
  document: Document,
  buffer: Buffer,
  geometry: BuildingMeshGeometry,
): Accessor {
  const outer = geometry.footprint.outer;
  const baseY = geometry.baseY ?? 0;
  const height = geometry.height ?? 5;
  const floors = Math.max(1, Math.floor(height / 3.0));
  const floorH = height / floors;

  const INSET = 0.08;
  const SIDE_MARGIN = 0.6;
  const WIN_SPACING = 2.5;
  const WIN_WIDTH = 1.2;
  const WIN_HEIGHT = 1.4;
  const BOTTOM_MARGIN = 0.8;
  const MIN_WALL_LEN = 2.5;

  const positions: number[] = [];
  const n = outer.length;

  for (let j = 0; j < n; j++) {
    const p0 = outer[j]!;
    const p1 = outer[(j + 1) % n]!;
    const dx = p1.x - p0.x;
    const dz = p1.z - p0.z;
    const L = Math.sqrt(dx * dx + dz * dz);

    if (L < MIN_WALL_LEN) continue;

    // Inward normal for CCW polygon: outward = (dz/L, 0, -dx/L), inward flips sign
    const inX = (-dz / L) * INSET;
    const inZ = (dx / L) * INSET;

    const usableLen = L - 2 * SIDE_MARGIN;
    if (usableLen < WIN_WIDTH) continue;

    const winsPerFloor = Math.max(1, Math.floor(usableLen / WIN_SPACING));
    const actualSpacing = usableLen / winsPerFloor;
    const halfW = Math.min(WIN_WIDTH / 2, actualSpacing * 0.4);

    for (let floor = 0; floor < floors; floor++) {
      const winBottomY = baseY + floor * floorH + BOTTOM_MARGIN;
      const winTopY = winBottomY + WIN_HEIGHT;
      if (winTopY > baseY + height - 0.3) continue;

      for (let w = 0; w < winsPerFloor; w++) {
        const tCenter = (SIDE_MARGIN + actualSpacing * (w + 0.5)) / L;
        const t0 = tCenter - halfW / L;
        const t1 = tCenter + halfW / L;

        const x0 = p0.x + t0 * dx + inX;
        const z0 = p0.z + t0 * dz + inZ;
        const x1 = p0.x + t1 * dx + inX;
        const z1 = p0.z + t1 * dz + inZ;

        // Triangle 1: BL BR TR
        positions.push(x0, winBottomY, z0, x1, winBottomY, z1, x1, winTopY, z1);
        // Triangle 2: BL TR TL
        positions.push(x0, winBottomY, z0, x1, winTopY, z1, x0, winTopY, z0);
      }
    }
  }

  if (positions.length === 0) {
    // No valid windows — return placeholder (avoids empty accessor)
    return this.createPlaceholderPositions(document, buffer, 'building_windows', {
      x: outer[0]?.x ?? 0,
      y: baseY,
      z: outer[0]?.z ?? 0,
    });
  }

  return document
    .createAccessor('window-positions')
    .setArray(new Float32Array(positions) as TypedArray)
    .setType('VEC3')
    .setBuffer(buffer);
}
```

- [ ] **Step 7: Wire `building_windows` in `createPositionsFromGeometry`**

In the `switch (geometry.kind)` inside `createPositionsFromGeometry`, replace the `'building'` case:

```ts
case 'building':
  if (type === 'building_windows') {
    return this.createWindowPositions(document, buffer, geometry);
  }
  return this.createBuildingPositions(document, buffer, geometry);
```

- [ ] **Step 8: Run type check**

```bash
bun run type-check
```

Expected: zero errors

- [ ] **Step 9: Run tests**

```bash
bun test
```

Expected: 84 pass, 0 fail (window nodes are additive — no existing test breaks)

> Note: If any fixture test checks exact `materialCount` or `nodeCount`, it may need updating. Check failure output and update the expectation to include the new window material + doubled building node count.

- [ ] **Step 10: Commit**

```bash
git add packages/contracts/mesh-plan/index.ts \
        packages/contracts/mesh-plan/mesh-plan.schema.ts \
        src/render/application/mesh-plan-builder.service.ts \
        src/glb/application/glb-compiler.service.ts
git commit -m "feat: procedural window mesh — glass child node per building with floor-grid quads"
```

---

## Self-Review

**Spec coverage:**
- [x] pngjs install → DEM real decode (Task 1)
- [x] Per-building centroid DEM (Task 2) — one tile fetch, all centroids sampled
- [x] Window mesh (Task 3) — floor×wall grid, inset 0.08m, dark glass PBR material
- [x] `building_windows` primitive contract extended in both index.ts and schema
- [x] `window` material role added to both index.ts and schema

**Placeholder scan:** None found — all steps have exact code.

**Type consistency:**
- `MeshPlanNode.primitive` updated in both `index.ts` and `mesh-plan.schema.ts` ✓
- `MaterialPlan.role` updated in both `index.ts` and `mesh-plan.schema.ts` ✓
- `createWindowPositions` return type `Accessor` matches `createBuildingPositions` ✓
- `resolveNodes` returns `MeshPlanNode[]` matching the contract type ✓
- `getElevationsForPoints` signature `(origin, points) => Promise<number[]>` consistent across adapter and service ✓

**Known gap (Phase 3):**
- Roof shape variation (flat/gabled/hipped from OSM `roof:shape` tag)
- Intra-scene terrain slope on road/walkway vertices
