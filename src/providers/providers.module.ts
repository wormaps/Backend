import { OsmSceneBuildService } from './application/osm-scene-build.service';
import { OsmSnapshotService } from './application/osm-snapshot.service';
import { SnapshotCollectorService } from './application/snapshot-collector.service';

export const providersModule = {
  name: 'providers',
  services: {
    snapshotCollector: new SnapshotCollectorService(),
    osmSnapshot: new OsmSnapshotService(),
    osmSceneBuild: new OsmSceneBuildService(new OsmSnapshotService()),
  },
} as const;
