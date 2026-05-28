import { forwardRef, Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { OverpassAdapter, VWorldBuildingAdapter, MapboxBuildingsAdapter, type OSMEntityData } from '../infrastructure';
import { MapboxDemAdapter } from '../infrastructure';
import { SceneBuildOrchestratorService } from '../../build/application/scene-build-orchestrator.service';
import type { SceneBuildRunResult } from '../../build/application';
import type { SceneScope } from '../../shared/contracts';
import type { SourceSnapshot } from '../../shared/contracts';
import { createHash } from 'node:crypto';
type SceneBuildOrchestrator = Pick<SceneBuildOrchestratorService, 'run'>;

/** Approximate bounding box for South Korea. */
function isKorea(lat: number, lng: number): boolean {
  return lat >= 33.0 && lat <= 38.9 && lng >= 124.0 && lng <= 132.0;
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
    @Inject(forwardRef(() => SceneBuildOrchestratorService))
    private readonly orchestrator: SceneBuildOrchestrator,
  ) {}

  async run(input: OsmSceneBuildInput): Promise<SceneBuildRunResult> {
    // Select building provider based on region.
    const { lat, lng } = input.scope.center;
    const buildings = await this.queryBuildings(input.scope, lat, lng);
    await this.enrichElevation(buildings, input.scope.center);
    await this.delay(200);
    const roads = await this.overpass.queryRoads(input.scope);
    await this.delay(200);
    const walkways = await this.overpass.queryWalkways(input.scope);
    await this.delay(200);
    const terrain = await this.overpass.queryTerrain(input.scope);

    const snapshots: SourceSnapshot[] = [];
    const allCount = buildings.length + roads.length + walkways.length + terrain.length;

    if (buildings.length > 0) {
      snapshots.push(this.makeSnapshot(input, 'building', buildings));
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

    this.logger.log(`OSM Build: ${allCount} entities across ${snapshots.length} snapshot(s)`);

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
    const rawJson = JSON.stringify(entities);
    const responseHash = `sha256:${createHash('sha256').update(rawJson).digest('hex')}`;
    return {
      id: `snapshot:osm:${entityType}:${input.snapshotBundleId}`,
      provider: 'osm',
      sceneId: input.sceneId,
      requestedAt: new Date().toISOString(),
      queryHash: `sha256:${createHash('sha256').update(entityType).digest('hex')}`,
      responseHash,
      storageMode: 'metadata_only',
      payloadRef: rawJson,
      payloadSchemaVersion: 'osm-entity.v1',
      status: 'success',
      compliance: {
        provider: 'osm',
        attributionRequired: true,
        attributionText: 'OpenStreetMap contributors',
        retentionPolicy: 'cache_allowed',
        policyVersion: '1.0.0',
      },
    };
  }

  private async enrichElevation(
    entities: OSMEntityData[],
    origin: { lat: number; lng: number },
  ): Promise<void> {
    if (!this.dem) return;
    try {
      const buildings = entities.filter((e) => e.entityType === 'building');
      if (buildings.length === 0) return;

      const centroids = buildings.map((b) => this.buildingCentroid(b, origin));
      // Include origin as first point so we can compute relative elevation in one tile fetch.
      const allPoints = [origin, ...centroids];
      const allElevations = await this.dem.getElevationsForPoints(origin, allPoints);
      const centerElevation = allElevations[0] ?? 0;

      for (let i = 0; i < buildings.length; i++) {
        const building = buildings[i]!;
        const elevation = allElevations[i + 1] ?? 0;
        // Store relative elevation (metres above/below scene centre).
        (building.geometry as { baseY?: number }).baseY = elevation - centerElevation;
      }

      this.logger.log('Per-building elevation applied', { buildingCount: buildings.length, centerElevation });
    } catch (err) {
      this.logger.warn('Elevation enrichment failed; using baseY=0', { error: String(err) });
    }
  }

  /**
   * Compute approximate lat/lng for a building footprint centroid.
   * Local coords: x = East metres, z = North metres (from wgs84ToEnu mapping).
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
    const deltaLat = (cz / EARTH_RADIUS) * (180 / Math.PI);
    const deltaLng = (cx / (EARTH_RADIUS * Math.cos(latRad))) * (180 / Math.PI);

    return { lat: origin.lat + deltaLat, lng: origin.lng + deltaLng };
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
