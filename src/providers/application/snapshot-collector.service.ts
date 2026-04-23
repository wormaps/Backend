import type { SourceSnapshot } from '../../../packages/contracts/source-snapshot';
import { err, ok, type Result } from '../../shared';

export class SnapshotCollectorService {
  collectFromSnapshots(
    snapshots: SourceSnapshot[],
  ): Result<SourceSnapshot[], 'SNAPSHOT_PARTIAL' | 'FAILED'> {
    if (snapshots.length === 0) {
      return err('FAILED', 'At least one SourceSnapshot is required.');
    }

    if (snapshots.some((snapshot) => snapshot.status === 'failed')) {
      return err('SNAPSHOT_PARTIAL', 'One or more provider snapshots failed.');
    }

    return ok(snapshots);
  }
}
