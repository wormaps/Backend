import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { OverpassAdapter, VWorldBuildingAdapter, MapboxBuildingsAdapter, type OSMEntityData } from '../infrastructure';
import { MapboxDemAdapter } from '../infrastructure';
import type { SceneBuildRunResult } from '../../build/application';
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
} satisfies Record<'osm' | 'vworld' | 'mapbox', ComplianceInfo>;

// Injection token — avoids circular import with build/application.
export const SCENE_BUILD_ORCHESTRATOR = Symbol('SCENE_BUILD_ORCHESTRATOR');
type SceneBuildOrchestrator = {
  run(input: {
    sceneId: string;
    buildId: string;
    snapshotBundleId: string;
    scope: SceneScope;
    snapshots: SourceSnapshot[];
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
    @Optional() private readonly vworld: VWorldBuildingAdapter | undefined,
    @Optional() private readonly mapboxBuildings: MapboxBuildingsAdapter | undefined,
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

    // Suppress parent buildings whose footprint is covered by building:parts.
    const filteredBuildings = this.suppressParentsWithParts(buildings, buildingParts);
    const allBuildingEntities = [...filteredBuildings, ...buildingParts];

    // Enrich all geometry with DEM elevation in one batch (single tile fetch).
    // buildingParts enriched separately — their baseY is architectural offset, DEM adds on top.
    await this.enrichElevation(allBuildingEntities, roads, walkways, terrain, input.scope.center);

    const snapshots: SourceSnapshot[] = [];

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

    this.logger.log(`OSM Build: buildings=${filteredBuildings.length}+${buildingParts.length}parts roads=${roads.length} walkways=${walkways.length} terrain=${terrain.length} snapshots=${snapshots.length}`);

    const buildInput = {
      sceneId: input.sceneId,
      buildId: input.buildId,
      snapshotBundleId: input.snapshotBundleId,
      scope: input.scope,
      snapshots,
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
  ): Promise<void> {
    if (!this.dem) return;
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

      if (latLngs.length === 1) return; // only origin — no entities to enrich

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

      this.logger.log(
        `Elevation enriched: buildings=${buildings.length} roads=${roads.length} walkways=${walkways.length} terrain=${terrain.length} points=${latLngs.length} centerElev=${centerElevation.toFixed(1)}m`,
      );
    } catch (err) {
      this.logger.warn(`Elevation enrichment failed; using y=0: ${String(err)}`);
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
