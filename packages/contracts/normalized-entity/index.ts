import type { QaIssue } from '../qa';
import type { SourceEntityRef } from '../source-snapshot';
import type { TwinEntityType } from '../twin-scene-graph';

export type NormalizedEntity = {
  id: string;
  stableId: string;
  type: TwinEntityType;
  geometry?: Record<string, unknown>;
  sourceEntityRefs: SourceEntityRef[];
  tags: string[];
  issues: QaIssue[];
};

export type NormalizedEntityBundle = {
  id: string;
  sceneId: string;
  snapshotBundleId: string;
  entities: NormalizedEntity[];
  issues: QaIssue[];
  generatedAt: string;
  normalizationVersion: string;
};
