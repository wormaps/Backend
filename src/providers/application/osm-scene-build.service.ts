import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { OverpassAdapter, VWorldBuildingAdapter, MapboxBuildingsAdapter, MapboxSatelliteAdapter, Google3dTilesAdapter, type OSMEntityData, type GooglePhotorealTile } from '../infrastructure';
import { MapboxDemAdapter } from '../infrastructure';
import type { SceneBuildRunResult } from '../../build/application';
import type { GroundHeightfield } from '../../pipeline/glb/application';
import type { SceneScope } from '../../shared/contracts';
import type { SourceSnapshot, SourceProvider } from '../../shared/contracts';
import { createHash } from 'node:crypto';

// ---------------------------------------------------------------------------
// Attribution metadata per provider
// ---------------------------------------------------------------------------

type ComplianceInfo = SourceSnapshot['compliance'];
const PROVIDER_COMPLIANCE = {
  osm: {
    provider: 'osm',
    attributionRequired: true,
    attributionText: 'OpenStreetMap contributors',
    retentionPolicy: 'cache_allowed',
    policyVersion: '1.0.0',
  },
  vworld: {
    provider: 'vworld',
    attributionRequired: true,
    attributionText: '국토교통부 V-World (공간정보 오픈플랫폼)',
    retentionPolicy: 'cache_allowed',
    policyVersion: '1.0.0',
  },
  mapbox: {
    provider: 'mapbox',
    attributionRequired: true,
    attributionText: '© Mapbox',
    retentionPolicy: 'ephemeral',
    policyVersion: '1.0.0',
  },
  google_3dtiles: {
    provider: 'google_3dtiles',
    attributionRequired: true,
    attributionText: 'Google Photorealistic 3D Tiles',
    retentionPolicy: 'ephemeral',
    policyVersion: '1.0.0',
  },
} satisfies Record<'osm' | 'vworld' | 'mapbox' | 'google_3dtiles', ComplianceInfo>;

// Injection token — avoids circular import with build/application.
export const SCENE_BUILD_ORCHESTRATOR = Symbol('SCENE_BUILD_ORCHESTRATOR');
type SceneBuildOrchestrator = {
  run(input: {
    sceneId: string;
    buildId: string;
    snapshotBundleId: string;
    scope: SceneScope;
    snapshots: SourceSnapshot[];
    groundHeightfield?: GroundHeightfield;
  }): Promise<SceneBuildRunResult>;
};

const KOREA_BOUNDS = { minLat: 33.0, maxLat: 38.9, minLng: 124.0, maxLng: 132.0 };
const OVERPASS_RATE_LIMIT_MS = 200;

/** Approximate bounding box for South Korea. */
function isKorea(lat: number, lng: number): boolean {
  return (
    lat >= KOREA_BOUNDS.minLat && lat <= KOREA_BOUNDS.maxLat &&
    lng >= KOREA_BOUNDS.minLng && lng <= KOREA_BOUNDS.maxLng
  );
}

export type OsmSceneBuildInput = {
  sceneId: string;
  buildId: string;
  snapshotBundleId: string;
  scope: SceneScope;
};

@Injectable()
export class OsmSceneBuildService {
  private readonly logger = new Logger(OsmSceneBuildService.name);

  constructor(
    private readonly overpass: OverpassAdapter,
    @Optional() private readonly dem: MapboxDemAdapter | undefined,
    @Optional() private readonly satellite: MapboxSatelliteAdapter | undefined,
    @Optional() private readonly vworld: VWorldBuildingAdapter | undefined,
    @Optional() private readonly mapboxBuildings: MapboxBuildingsAdapter | undefined,
    @Optional() private readonly google3dTiles: Google3dTilesAdapter | undefined,
    @Inject(SCENE_BUILD_ORCHESTRATOR)
    private readonly orchestrator: SceneBuildOrchestrator,
  ) {}

  async run(input: OsmSceneBuildInput): Promise<SceneBuildRunResult> {
    // Select building provider based on region.
    const { lat, lng } = input.scope.center;
    const buildings = await this.queryBuildings(input.scope, lat, lng);
    await this.delay(OVERPASS_RATE_LIMIT_MS);
    const buildingParts = await this.overpass.queryBuildingParts(input.scope);
    await this.delay(OVERPASS_RATE_LIMIT_MS);
    const roads = await this.overpass.queryRoads(input.scope);
    await this.delay(OVERPASS_RATE_LIMIT_MS);
    const walkways = await this.overpass.queryWalkways(input.scope);
    await this.delay(OVERPASS_RATE_LIMIT_MS);
    const terrain = await this.overpass.queryTerrain(input.scope);
    await this.delay(OVERPASS_RATE_LIMIT_MS);
    const trees = await this.overpass.queryTrees(input.scope);

    // Suppress parent buildings whose footprint is covered by building:parts.
    const filteredBuildings = this.suppressParentsWithParts(buildings, buildingParts);
    const allBuildingEntities = [...filteredBuildings, ...buildingParts];

    // Enrich all geometry with DEM elevation in one batch (single tile fetch).
    // buildingParts enriched separately — their baseY is architectural offset, DEM adds on top.
    const groundHeightfield = await this.enrichElevation(
      allBuildingEntities,
      roads,
      walkways,
      terrain,
      input.scope.center,
      (input.scope.radiusMeters ?? 150) * 2.5,
      trees,
    );

    // Sample building colors from satellite imagery (only for entities without explicit colour tag).
    await this.enrichBuildingColorsFromSatellite(allBuildingEntities, input.scope.center);

    const snapshots: SourceSnapshot[] = [];
    let photorealTiles: GooglePhotorealTile[] = [];

    if (allBuildingEntities.length > 0) {
      snapshots.push(this.makeSnapshot(input, 'building', allBuildingEntities));
    }
    if (roads.length > 0) {
      snapshots.push(this.makeSnapshot(input, 'road', roads));
    }
    if (walkways.length > 0) {
      snapshots.push(this.makeSnapshot(input, 'walkway', walkways));
    }
    if (terrain.length > 0) {
      snapshots.push(this.makeSnapshot(input, 'terrain', terrain));
    }
    if (trees.length > 0) {
      snapshots.push(this.makeSnapshot(input, 'poi', trees));
    }
    if (this.google3dTiles) {
      try {
        photorealTiles = await this.google3dTiles.fetchPhotorealTiles({
          scope: input.scope,
          maxGeometricError: this.resolvePhotorealGeometricError(input.scope.radiusMeters ?? 150),
          maxTiles: 96,
          maxDepth: 18,
        });
        if (photorealTiles.length > 0) {
          snapshots.push(this.makeGoogleTilesSnapshot(input, photorealTiles));
        }
      } catch (err) {
        this.logger.warn(`Google 3D Tiles skipped: ${String(err)}`);
      }
    }

    this.logger.log(`OSM Build: buildings=${filteredBuildings.length}+${buildingParts.length}parts roads=${roads.length} walkways=${walkways.length} terrain=${terrain.length} trees=${trees.length} snapshots=${snapshots.length}`);

    const buildInput = {
      sceneId: input.sceneId,
      buildId: input.buildId,
      snapshotBundleId: input.snapshotBundleId,
      scope: input.scope,
      snapshots,
      groundHeightfield,
      photorealTiles,
    };

    const result = await this.orchestrator.run(buildInput);
    return result;
  }

  private async queryBuildings(
    scope: SceneScope,
    lat: number,
    lng: number,
  ): Promise<OSMEntityData[]> {
    if (isKorea(lat, lng) && this.vworld) {
      try {
        const buildings = await this.vworld.queryBuildings(scope);
        if (buildings.length > 0) {
          this.logger.log(`V World buildings loaded count=${buildings.length}`);
          return buildings;
        }
        this.logger.warn('V World returned 0 buildings — falling back to OSM');
      } catch (err) {
        this.logger.warn(`V World failed, falling back to OSM: ${String(err)}`);
      }
    }

    if (!isKorea(lat, lng) && this.mapboxBuildings) {
      try {
        const buildings = await this.mapboxBuildings.queryBuildings(scope);
        if (buildings.length > 0) {
          this.logger.log(`Mapbox buildings loaded count=${buildings.length}`);
          return buildings;
        }
        this.logger.warn('Mapbox returned 0 buildings — falling back to OSM');
      } catch (err) {
        this.logger.warn(`Mapbox buildings failed, falling back to OSM: ${String(err)}`);
      }
    }

    return this.overpass.queryBuildings(scope);
  }

  private makeSnapshot(
    input: OsmSceneBuildInput,
    entityType: string,
    entities: OSMEntityData[],
  ): SourceSnapshot {
    // Detect actual provider from entities (V World / Mapbox / OSM).
    const uniqueProviders = new Set(entities.map((e) => e.provider));
    if (uniqueProviders.size > 1) {
      this.logger.warn(`Mixed providers in ${entityType} snapshot: ${[...uniqueProviders].join(', ')}`);
    }
    const rawProvider = entities[0]?.provider;
    const provider: SourceProvider =
      rawProvider === 'osm' || rawProvider === 'vworld' || rawProvider === 'mapbox'
        ? rawProvider
        : 'osm';
    const rawJson = JSON.stringify(entities);
    const responseHash = `sha256:${createHash('sha256').update(rawJson).digest('hex')}`;
    return {
      id: `snapshot:${provider}:${entityType}:${input.snapshotBundleId}`,
      provider,
      sceneId: input.sceneId,
      requestedAt: new Date().toISOString(),
      queryHash: `sha256:${createHash('sha256').update(`${provider}:${entityType}:${input.scope.center.lat}:${input.scope.center.lng}:${input.scope.radiusMeters ?? 150}`).digest('hex')}`,
      responseHash,
      storageMode: 'ephemeral_payload',
      payloadRef: rawJson,
      payloadSchemaVersion: 'osm-entity.v1',
      status: 'success',
      compliance: PROVIDER_COMPLIANCE[provider] ?? PROVIDER_COMPLIANCE['osm']!,
    };
  }

  private makeGoogleTilesSnapshot(
    input: OsmSceneBuildInput,
    tiles: GooglePhotorealTile[],
  ): SourceSnapshot {
    const payload = JSON.stringify({
      tileCount: tiles.length,
      uris: tiles.slice(0, 32).map((t) => t.uri),
      geometricErrorRange: {
        min: Math.min(...tiles.map((t) => t.geometricError)),
        max: Math.max(...tiles.map((t) => t.geometricError)),
      },
    });
    const responseHash = `sha256:${createHash('sha256').update(payload).digest('hex')}`;
    return {
      id: `snapshot:google_3dtiles:photoreal:${input.snapshotBundleId}`,
      provider: 'google_3dtiles',
      sceneId: input.sceneId,
      requestedAt: new Date().toISOString(),
      queryHash: `sha256:${createHash('sha256').update(`google_3dtiles:${input.scope.center.lat}:${input.scope.center.lng}:${input.scope.radiusMeters ?? 150}`).digest('hex')}`,
      responseHash,
      storageMode: 'metadata_only',
      payloadRef: payload,
      payloadSchemaVersion: 'google-3dtiles.v1',
      status: 'success',
      compliance: PROVIDER_COMPLIANCE.google_3dtiles,
    };
  }

  private resolvePhotorealGeometricError(radiusMeters: number): number {
    if (radiusMeters <= 120) return 8;
    if (radiusMeters <= 250) return 16;
    if (radiusMeters <= 500) return 28;
    return 40;
  }

  private async enrichBuildingColorsFromSatellite(
    buildings: OSMEntityData[],
    origin: { lat: number; lng: number },
  ): Promise<void> {
    if (!this.satellite || buildings.length === 0) return;
    try {
      // Multiple inset samples per building → median → robust against rooftop
      // fixtures (AC units, skylights) that a single centroid pixel may hit.
      // Walls are darkened slightly vs the roof-derived colour.
      const FACADE_DARKEN = 0.82;
      const INSET_FRAC = 0.55; // pull perimeter samples toward centroid, stay on roof
      const MAX_SAMPLES = 5;

      const points: Array<{ lat: number; lng: number }> = [];
      const groups: Array<{ index: number; start: number; count: number }> = [];

      for (let i = 0; i < buildings.length; i++) {
        const b = buildings[i]!;
        if (b.tags['building:colour']) continue; // respect explicit OSM tag
        const outer =
          (b.geometry as { footprint?: { outer: Array<{ x: number; z: number }> } })
            .footprint?.outer ?? [];
        if (outer.length === 0) continue;

        const cx = outer.reduce((s, p) => s + p.x, 0) / outer.length;
        const cz = outer.reduce((s, p) => s + p.z, 0) / outer.length;

        const start = points.length;
        points.push(this.enuToLatLng(cx, cz, origin));

        const step = Math.max(1, Math.floor(outer.length / (MAX_SAMPLES - 1)));
        for (let v = 0; v < outer.length && points.length - start < MAX_SAMPLES; v += step) {
          const p = outer[v]!;
          const ix = cx + (p.x - cx) * INSET_FRAC;
          const iz = cz + (p.z - cz) * INSET_FRAC;
          points.push(this.enuToLatLng(ix, iz, origin));
        }

        groups.push({ index: i, start, count: points.length - start });
      }

      if (points.length === 0) return;

      const colors = await this.satellite.sampleColors(points);

      const median = (vals: number[]): number => {
        const sorted = [...vals].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 === 0
          ? Math.round((sorted[mid - 1]! + sorted[mid]!) / 2)
          : sorted[mid]!;
      };

      for (const { index, start, count } of groups) {
        const rs: number[] = [];
        const gs: number[] = [];
        const bs: number[] = [];
        for (let k = 0; k < count; k++) {
          const [r, g, b] = colors[start + k] ?? [128, 128, 128];
          rs.push(r!);
          gs.push(g!);
          bs.push(b!);
        }
        const r = Math.round(median(rs) * FACADE_DARKEN);
        const g = Math.round(median(gs) * FACADE_DARKEN);
        const b = Math.round(median(bs) * FACADE_DARKEN);
        const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
        buildings[index]!.tags['building:colour'] = hex;
      }

      this.logger.log(`Satellite colors sampled: ${groups.length} buildings (${points.length} pts)`);
    } catch (err) {
      this.logger.warn(`Satellite color enrichment failed: ${String(err)}`);
    }
  }

  private suppressParentsWithParts(
    parents: OSMEntityData[],
    parts: OSMEntityData[],
  ): OSMEntityData[] {
    if (parts.length === 0) return parents;
    type XZ = { x: number; z: number };
    const partCentroids: XZ[] = parts.flatMap((p) => {
      const outer = (p.geometry as { footprint?: { outer: XZ[] } }).footprint?.outer ?? [];
      if (outer.length === 0) return [];
      const cx = outer.reduce((s, v) => s + v.x, 0) / outer.length;
      const cz = outer.reduce((s, v) => s + v.z, 0) / outer.length;
      return [{ x: cx, z: cz }];
    });
    return parents.filter((parent) => {
      const outer = (parent.geometry as { footprint?: { outer: XZ[] } }).footprint?.outer ?? [];
      if (outer.length < 3) return true;
      const minX = outer.reduce((m, v) => Math.min(m, v.x), Infinity);
      const maxX = outer.reduce((m, v) => Math.max(m, v.x), -Infinity);
      const minZ = outer.reduce((m, v) => Math.min(m, v.z), Infinity);
      const maxZ = outer.reduce((m, v) => Math.max(m, v.z), -Infinity);
      return !partCentroids.some((c) => c.x >= minX && c.x <= maxX && c.z >= minZ && c.z <= maxZ);
    });
  }

  /**
   * Apply DEM elevation to all entities in one batched fetch (multi-tile aware).
   * - Buildings: centroid elevation → baseY (relative to scene centre).
   *   Buildings with empty footprints are skipped (baseY stays undefined → y=0 fallback).
   * - Roads / walkways: every centerline vertex.y → relative elevation.
   * - Terrain: every sample point.y → relative elevation.
   *
   * Uses index-based mapping (no per-point closures) to reduce GC pressure.
   * The DEM adapter handles tile boundaries automatically.
   */
  private async enrichElevation(
    buildings: OSMEntityData[],
    roads: OSMEntityData[],
    walkways: OSMEntityData[],
    terrain: OSMEntityData[],
    origin: { lat: number; lng: number },
    groundHalfSize: number,
    trees: OSMEntityData[] = [],
  ): Promise<GroundHeightfield | undefined> {
    if (!this.dem) return undefined;
    try {
      // -----------------------------------------------------------------------
      // Phase 1: collect all query points as flat lat/lng array.
      // Track how to map result indices back to entities via offset table.
      // -----------------------------------------------------------------------

      // Index 0 = scene centre (used to compute centerElevation).
      const latLngs: Array<{ lat: number; lng: number }> = [origin];

      // buildingOffsets[i] = index in latLngs for buildings[i] centroid, or -1 to skip.
      const buildingOffsets: number[] = [];
      for (const b of buildings) {
        const outer =
          (b.geometry as { footprint?: { outer: Array<{ x: number; z: number }> } })
            .footprint?.outer ?? [];
        if (outer.length === 0) {
          buildingOffsets.push(-1); // skip — no footprint, keep baseY undefined
          continue;
        }
        buildingOffsets.push(latLngs.length);
        const cx = outer.reduce((s, p) => s + p.x, 0) / outer.length;
        const cz = outer.reduce((s, p) => s + p.z, 0) / outer.length;
        latLngs.push(this.enuToLatLng(cx, cz, origin));
      }

      // roadVertexOffsets[r][v] = index in latLngs for roads[r].centerline[v].
      const roadVertexOffsets: number[][] = [];
      for (const entity of [...roads, ...walkways]) {
        const centerline =
          (entity.geometry as { centerline?: Array<{ x: number; y: number; z: number }> })
            .centerline ?? [];
        const vOffsets: number[] = [];
        for (const vertex of centerline) {
          vOffsets.push(latLngs.length);
          latLngs.push(this.enuToLatLng(vertex.x, vertex.z, origin));
        }
        roadVertexOffsets.push(vOffsets);
      }

      // terrainVertexOffsets[t][v] = index in latLngs for terrain[t].samples[v].
      const terrainVertexOffsets: number[][] = [];
      for (const entity of terrain) {
        const samples =
          (entity.geometry as { samples?: Array<{ x: number; y: number; z: number }> })
            .samples ?? [];
        const vOffsets: number[] = [];
        for (const sample of samples) {
          vOffsets.push(latLngs.length);
          latLngs.push(this.enuToLatLng(sample.x, sample.z, origin));
        }
        terrainVertexOffsets.push(vOffsets);
      }

      // treeOffsets[i] = index in latLngs for trees[i].point, or -1 to skip.
      const treeOffsets: number[] = [];
      for (const tree of trees) {
        const point = (tree.geometry as { point?: { x: number; z: number } }).point;
        if (point === undefined) {
          treeOffsets.push(-1);
          continue;
        }
        treeOffsets.push(latLngs.length);
        latLngs.push(this.enuToLatLng(point.x, point.z, origin));
      }

      // Ground heightfield grid — spans the full ground-plane footprint.
      const GROUND_COLS = 33;
      const GROUND_ROWS = 33;
      const groundOffsets: number[] = [];
      for (let r = 0; r < GROUND_ROWS; r++) {
        for (let c = 0; c < GROUND_COLS; c++) {
          const gx = -groundHalfSize + (2 * groundHalfSize) * (c / (GROUND_COLS - 1));
          const gz = -groundHalfSize + (2 * groundHalfSize) * (r / (GROUND_ROWS - 1));
          groundOffsets.push(latLngs.length);
          latLngs.push(this.enuToLatLng(gx, gz, origin));
        }
      }

      if (latLngs.length === 1) return undefined; // only origin — nothing to sample

      // -----------------------------------------------------------------------
      // Phase 2: single DEM batch query (multi-tile aware).
      // -----------------------------------------------------------------------
      const allElevations = await this.dem.getElevationsForPoints(origin, latLngs);
      const centerElevation = allElevations[0] ?? 0;

      // -----------------------------------------------------------------------
      // Phase 3: apply results back.
      // -----------------------------------------------------------------------
      for (let i = 0; i < buildings.length; i++) {
        const offset = buildingOffsets[i];
        if (offset === undefined || offset === -1) continue;
        const absElev = allElevations[offset] ?? 0;
        const demRelative = absElev - centerElevation;
        const archBase = (buildings[i]!.geometry as { baseY?: number }).baseY ?? 0;
        (buildings[i]!.geometry as { baseY?: number }).baseY = demRelative + archBase;
      }

      const roadAndWalkways = [...roads, ...walkways];
      for (let r = 0; r < roadAndWalkways.length; r++) {
        const vOffsets = roadVertexOffsets[r] ?? [];
        const centerline =
          (roadAndWalkways[r]!.geometry as { centerline?: Array<{ x: number; y: number; z: number }> })
            .centerline ?? [];
        for (let v = 0; v < centerline.length; v++) {
          const offset = vOffsets[v];
          if (offset === undefined) continue;
          const absElev = allElevations[offset] ?? 0;
          centerline[v]!.y = absElev - centerElevation;
        }
      }

      for (let t = 0; t < terrain.length; t++) {
        const vOffsets = terrainVertexOffsets[t] ?? [];
        const samples =
          (terrain[t]!.geometry as { samples?: Array<{ x: number; y: number; z: number }> })
            .samples ?? [];
        for (let v = 0; v < samples.length; v++) {
          const offset = vOffsets[v];
          if (offset === undefined) continue;
          const absElev = allElevations[offset] ?? 0;
          samples[v]!.y = absElev - centerElevation;
        }
      }

      for (let i = 0; i < trees.length; i++) {
        const offset = treeOffsets[i];
        if (offset === undefined || offset === -1) continue;
        const point = (trees[i]!.geometry as { point?: { x: number; y: number; z: number } }).point;
        if (point === undefined) continue;
        point.y = (allElevations[offset] ?? centerElevation) - centerElevation;
      }

      const groundHeights = groundOffsets.map(
        (o) => (allElevations[o] ?? centerElevation) - centerElevation,
      );
      const heightfield: GroundHeightfield = {
        halfSize: groundHalfSize,
        cols: GROUND_COLS,
        rows: GROUND_ROWS,
        heights: groundHeights,
      };

      const sw = this.enuToLatLng(-groundHalfSize, -groundHalfSize, origin);
      const ne = this.enuToLatLng(groundHalfSize, groundHalfSize, origin);
      const texture = await this.satellite?.fetchBboxImage({
        minLat: sw.lat,
        minLng: sw.lng,
        maxLat: ne.lat,
        maxLng: ne.lng,
      });
      if (texture !== undefined) heightfield.texture = texture;

      this.logger.log(
        `Elevation enriched: buildings=${buildings.length} roads=${roads.length} walkways=${walkways.length} terrain=${terrain.length} points=${latLngs.length} centerElev=${centerElevation.toFixed(1)}m ground=${GROUND_COLS}x${GROUND_ROWS}`,
      );
      return heightfield;
    } catch (err) {
      this.logger.warn(`Elevation enrichment failed; using y=0: ${String(err)}`);
      return undefined;
    }
  }

  /** ENU (x=East, z=North) → approximate lat/lng given scene origin. */
  private enuToLatLng(
    x: number,
    z: number,
    origin: { lat: number; lng: number },
  ): { lat: number; lng: number } {
    const EARTH_RADIUS = 6_371_000;
    const latRad = (origin.lat * Math.PI) / 180;
    const deltaLat = (z / EARTH_RADIUS) * (180 / Math.PI);
    const deltaLng = (x / (EARTH_RADIUS * Math.cos(latRad))) * (180 / Math.PI);
    return { lat: origin.lat + deltaLat, lng: origin.lng + deltaLng };
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
