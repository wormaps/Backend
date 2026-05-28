import { forwardRef, Module } from '@nestjs/common';

import { BuildModule } from '../build';
import { SnapshotCollectorService } from './application';
import { OsmSceneBuildService } from './application';
import { OverpassAdapter } from './infrastructure';
import { MapboxDemAdapter } from './infrastructure';

@Module({
  imports: [forwardRef(() => BuildModule)],
  providers: [SnapshotCollectorService, OsmSceneBuildService, OverpassAdapter, MapboxDemAdapter],
  exports: [SnapshotCollectorService, OsmSceneBuildService],
})
export class ProvidersModule {}

export function validateProviderApiKeys(options?: { strict?: boolean }): void {
  // Phase 1 API path currently depends only on OSM(+optional Mapbox DEM),
  // so no required provider keys are enforced here.
  void options;
}
