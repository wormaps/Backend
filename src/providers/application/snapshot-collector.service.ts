import type { SourceSnapshot } from '../../../packages/contracts/source-snapshot';
import type { QaIssue } from '../../../packages/contracts/qa';
import { err, ok, type Result } from '../../shared';

export type SnapshotCollection = {
  snapshots: SourceSnapshot[];
  issues: QaIssue[];
};

export class SnapshotCollectorService {
  collectFromSnapshots(
    snapshots: SourceSnapshot[],
  ): Result<SnapshotCollection, 'SNAPSHOT_PARTIAL' | 'FAILED'> {
    if (snapshots.length === 0) {
      return err('FAILED', 'At least one SourceSnapshot is required.');
    }

    if (snapshots.some((snapshot) => snapshot.status === 'failed')) {
      return err('SNAPSHOT_PARTIAL', 'One or more provider snapshots failed.');
    }

    return ok({
      snapshots,
      issues: snapshots.flatMap((snapshot) => snapshot.issues ?? []),
    });
  }

  failedSnapshotIssues(snapshots: SourceSnapshot[]): QaIssue[] {
    return snapshots
      .filter((snapshot) => snapshot.status === 'failed')
      .map((snapshot) => ({
        code: 'PROVIDER_SNAPSHOT_FAILED',
        severity: 'major',
        scope: 'provider',
        message: `Provider snapshot ${snapshot.id} failed.`,
        action: 'warn_only',
      }));
  }
}
