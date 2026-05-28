import { OsmSceneBuildService } from './application/osm-scene-build.service';
import { OverpassAdapter } from './infrastructure/overpass.adapter';
import { SnapshotCollectorService } from './application/snapshot-collector.service';

const mapboxToken = process.env.MAPBOX_TOKEN;

export const providersModule = {
  name: 'providers',
  services: {
    snapshotCollector: new SnapshotCollectorService(),
    osmSceneBuild: OsmSceneBuildService.create(new OverpassAdapter(), mapboxToken),
  },
} as const;

export function validateProviderApiKeys(options?: { strict?: boolean }): void {
  // Phase 1 API path currently depends only on OSM(+optional Mapbox DEM),
  // so no required provider keys are enforced here.
  void options;
}
