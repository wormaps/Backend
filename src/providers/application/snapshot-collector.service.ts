import { Injectable, Logger } from '@nestjs/common';
import type { SourceSnapshot } from '../../shared/contracts';
import type { QaIssue } from '../../shared/contracts';
import { err, ok, type Result } from '../../shared';

export type SnapshotCollection = {
  snapshots: SourceSnapshot[];
  issues: QaIssue[];
};

@Injectable()
export class SnapshotCollectorService {
  private readonly logger = new Logger(SnapshotCollectorService.name);

  collectFromSnapshots(
    snapshots: SourceSnapshot[],
  ): Result<SnapshotCollection, 'SNAPSHOT_PARTIAL' | 'FAILED'> {
    this.logger.debug(`Collecting snapshots count=${snapshots.length}`);
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
