import type { SourceProvider, SourceSnapshot } from '../../packages/contracts/source-snapshot';
import type { SceneScope } from '../../packages/contracts/twin-scene-graph';

export const defaultScope: SceneScope = {
  center: { lat: 37.4979, lng: 127.0276 },
  boundaryType: 'radius',
  radiusMeters: 150,
  focusPlaceId: 'fixture-place',
  coreArea: { outer: [] },
  contextArea: { outer: [] },
};

export function snapshot(
  sceneId: string,
  id: string,
  provider: SourceProvider,
  status: SourceSnapshot['status'] = 'success',
): SourceSnapshot {
  return {
    id,
    provider,
    sceneId,
    requestedAt: '2026-04-23T00:00:00.000Z',
    receivedAt: status === 'failed' ? undefined : '2026-04-23T00:00:01.000Z',
    queryHash: `sha256:${id}:query`,
    responseHash: status === 'failed' ? undefined : `sha256:${id}:response`,
    storageMode: 'metadata_only',
    status,
    errorCode: status === 'failed' ? 'FIXTURE_PROVIDER_FAILURE' : undefined,
    compliance: {
      provider,
      attributionRequired: provider === 'osm',
      attributionText: provider === 'osm' ? 'OpenStreetMap contributors' : undefined,
      retentionPolicy: provider === 'google_places' ? 'id_only' : 'cache_allowed',
      policyVersion: '1.0.0',
    },
  };
}
