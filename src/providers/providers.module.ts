import { SnapshotCollectorService } from './application/snapshot-collector.service';

export const providersModule = {
  name: 'providers',
  services: {
    snapshotCollector: new SnapshotCollectorService(),
  },
} as const;
