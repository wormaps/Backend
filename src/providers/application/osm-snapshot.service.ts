import { createHash } from 'node:crypto';
import { OverpassAdapter, type OSMEntityData } from '../infrastructure/overpass.adapter';
import type { SceneScope } from '../../../packages/contracts/twin-scene-graph';
import type { SourceSnapshot } from '../../../packages/contracts/source-snapshot';

export class OsmSnapshotService {
  constructor(private readonly overpass = new OverpassAdapter()) {}

  async createSnapshot(
    sceneId: string,
    bundleId: string,
    scope: SceneScope,
  ): Promise<{ snapshot: SourceSnapshot; entities: OSMEntityData[] }> {
    const entities = await this.overpass.queryAll(scope);
    const rawJson = JSON.stringify(entities);
    const responseHash = `sha256:${createHash('sha256').update(rawJson).digest('hex')}`;

    return {
      snapshot: {
        id: `snapshot:osm:${bundleId}`,
        provider: 'osm',
        sceneId,
        requestedAt: new Date().toISOString(),
        queryHash: `sha256:${createHash('sha256').update(`${scope.center.lat},${scope.center.lng}`).digest('hex')}`,
        responseHash,
        storageMode: 'metadata_only',
        payloadRef: rawJson,
        payloadSchemaVersion: 'osm-entity.v1',
        status: entities.length > 0 ? 'success' : 'partial',
        compliance: {
          provider: 'osm',
          attributionRequired: true,
          attributionText: 'OpenStreetMap contributors',
          retentionPolicy: 'cache_allowed',
          policyVersion: '1.0.0',
        },
      },
      entities,
    };
  }
}
