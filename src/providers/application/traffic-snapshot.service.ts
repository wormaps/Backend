import { createHash } from 'node:crypto';
import { TomTomTrafficAdapter, type TrafficFlowData } from '../infrastructure/tomtom-traffic.adapter';
import type { SceneScope } from '../../../packages/contracts/twin-scene-graph';
import type { SourceSnapshot } from '../../../packages/contracts/source-snapshot';

export class TrafficSnapshotService {
  constructor(private readonly tomtom: TomTomTrafficAdapter) {}

  async createSnapshot(
    sceneId: string,
    bundleId: string,
    scope: SceneScope,
  ): Promise<{ snapshot: SourceSnapshot; traffic: TrafficFlowData }> {
    const traffic = await this.tomtom.queryTrafficFlow(scope.center.lat, scope.center.lng);
    const rawJson = JSON.stringify(traffic);
    const responseHash = `sha256:${createHash('sha256').update(rawJson).digest('hex')}`;

    return {
      snapshot: {
        id: `snapshot:traffic:${bundleId}`,
        provider: 'tomtom',
        sceneId,
        requestedAt: new Date().toISOString(),
        queryHash: `sha256:${createHash('sha256').update(`${scope.center.lat},${scope.center.lng}`).digest('hex')}`,
        responseHash,
        storageMode: 'metadata_only',
        payloadRef: rawJson,
        payloadSchemaVersion: 'tomtom-flow.v1',
        status: 'success',
        compliance: {
          provider: 'tomtom',
          attributionRequired: true,
          attributionText: 'TomTom',
          retentionPolicy: 'cache_allowed',
          policyVersion: '1.0.0',
        },
      },
      traffic,
    };
  }
}
