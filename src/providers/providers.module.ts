import { forwardRef, Module } from '@nestjs/common';

import { BuildModule } from '../build';
import { SceneBuildOrchestratorService } from '../build/application/scene-build-orchestrator.service';
import { SnapshotCollectorService } from './application';
import { OsmSceneBuildService, SCENE_BUILD_ORCHESTRATOR } from './application';
import { OverpassAdapter, MapboxDemAdapter, MapboxSatelliteAdapter, VWorldBuildingAdapter, MapboxBuildingsAdapter } from './infrastructure';

@Module({
  imports: [forwardRef(() => BuildModule)],
  providers: [
    SnapshotCollectorService,
    OsmSceneBuildService,
    OverpassAdapter,
    MapboxDemAdapter,
    MapboxSatelliteAdapter,
    VWorldBuildingAdapter,
    MapboxBuildingsAdapter,
    // Binds the injection token to the concrete orchestrator (from BuildModule via forwardRef).
    { provide: SCENE_BUILD_ORCHESTRATOR, useExisting: SceneBuildOrchestratorService },
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
