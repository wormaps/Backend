import { OverpassAdapter, type OSMEntityData } from '../infrastructure/overpass.adapter';
import { MapboxDemAdapter } from '../infrastructure/mapbox-dem.adapter';
import type { SceneBuildOrchestratorService } from '../../build/application/scene-build-orchestrator.service';
import type { SceneBuildRunResult } from '../../build/application/scene-build-run-result';
import type { SceneScope } from '../../../packages/contracts/twin-scene-graph';
import type { SourceSnapshot } from '../../../packages/contracts/source-snapshot';
import { createHash } from 'node:crypto';
import { BunLogger } from '../../../packages/core/logger';

export type OsmSceneBuildInput = {
  sceneId: string;
  buildId: string;
  snapshotBundleId: string;
  scope: SceneScope;
};

export class OsmSceneBuildService {
  private readonly logger = new BunLogger({ level: 'info', service: 'osm-scene-build' });

  constructor(
    private readonly overpass: OverpassAdapter,
    private orchestrator?: SceneBuildOrchestratorService,
    private readonly dem?: MapboxDemAdapter,
  ) {}

  static create(overpass: OverpassAdapter, mapboxToken?: string): OsmSceneBuildService {
    const dem = mapboxToken ? new MapboxDemAdapter(mapboxToken) : undefined;
    return new OsmSceneBuildService(overpass, undefined, dem);
  }

  setOrchestrator(orchestrator: SceneBuildOrchestratorService): void {
    this.orchestrator = orchestrator;
  }

  async run(input: OsmSceneBuildInput): Promise<SceneBuildRunResult> {
    if (!this.orchestrator) throw new Error('Orchestrator not set');

    // Fetch each entity type separately and create per-type snapshots
    const buildings = await this.overpass.queryBuildings(input.scope);
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

    this.logger.info(`OSM Build: ${allCount} entities across ${snapshots.length} snapshot(s)`);

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
      const baseElevation = await this.dem.getElevation(origin.lat, origin.lng);
      for (const entity of entities) {
        if (entity.entityType === 'building') {
          (entity.geometry as { baseY?: number }).baseY = baseElevation;
        }
      }
      this.logger.info('Elevation enrichment applied', { baseElevation });
    } catch (err) {
      this.logger.warn('Elevation enrichment failed; using baseY=0', { error: String(err) });
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
