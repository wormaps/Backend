import { forwardRef, Module } from '@nestjs/common';

import { BuildModule } from '../build';
import { SnapshotCollectorService } from './application';
import { OsmSceneBuildService } from './application';
import { OverpassAdapter, MapboxDemAdapter, VWorldBuildingAdapter, MapboxBuildingsAdapter } from './infrastructure';

@Module({
  imports: [forwardRef(() => BuildModule)],
  providers: [
    SnapshotCollectorService,
    OsmSceneBuildService,
    OverpassAdapter,
    MapboxDemAdapter,
    VWorldBuildingAdapter,
    MapboxBuildingsAdapter,
  ],
  exports: [SnapshotCollectorService, OsmSceneBuildService],
})
export class ProvidersModule {}

export function validateProviderApiKeys(options?: { strict?: boolean }): void {
  const strict = options?.strict ?? false;
  if (strict) {
    const missing: string[] = [];
    if (!process.env.MAPBOX_TOKEN) missing.push('MAPBOX_TOKEN');
    if (!process.env.V_WORLD_API_KEY) missing.push('V_WORLD_API_KEY (Korean buildings)');
    if (missing.length > 0) {
      throw new Error(`Missing required API keys: ${missing.join(', ')}`);
    }
  }
}
