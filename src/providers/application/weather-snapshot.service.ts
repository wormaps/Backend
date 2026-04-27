import { createHash } from 'node:crypto';
import { OpenMeteoAdapter, type WeatherData } from '../infrastructure/open-meteo.adapter';
import type { SceneScope } from '../../../packages/contracts/twin-scene-graph';
import type { SourceSnapshot } from '../../../packages/contracts/source-snapshot';

export class WeatherSnapshotService {
  constructor(private readonly openMeteo = new OpenMeteoAdapter()) {}

  async createSnapshot(
    sceneId: string,
    bundleId: string,
    scope: SceneScope,
  ): Promise<{ snapshot: SourceSnapshot; weather: WeatherData }> {
    const weather = await this.openMeteo.queryWeather(scope.center.lat, scope.center.lng);
    const rawJson = JSON.stringify(weather);
    const responseHash = `sha256:${createHash('sha256').update(rawJson).digest('hex')}`;

    return {
      snapshot: {
        id: `snapshot:weather:${bundleId}`,
        provider: 'open_meteo',
        sceneId,
        requestedAt: new Date().toISOString(),
        queryHash: `sha256:${createHash('sha256').update(`${scope.center.lat},${scope.center.lng}`).digest('hex')}`,
        responseHash,
        storageMode: 'metadata_only',
        payloadRef: rawJson,
        payloadSchemaVersion: 'open-meteo.v1',
        status: 'success',
        compliance: {
          provider: 'open_meteo',
          attributionRequired: false,
          retentionPolicy: 'cache_allowed',
          policyVersion: '1.0.0',
        },
      },
      weather,
    };
  }
}
