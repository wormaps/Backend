import { Module } from '@nestjs/common';

import { SnapshotCollectorService } from './application/snapshot-collector.service';
import { OsmSceneBuildService } from './application/osm-scene-build.service';
import { OverpassAdapter } from './infrastructure/overpass.adapter';
import { MapboxDemAdapter } from './infrastructure/mapbox-dem.adapter';

@Module({
  providers: [SnapshotCollectorService, OsmSceneBuildService, OverpassAdapter, MapboxDemAdapter],
  exports: [SnapshotCollectorService, OsmSceneBuildService],
})
export class ProvidersModule {}

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
