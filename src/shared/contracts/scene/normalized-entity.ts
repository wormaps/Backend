import type { MeshGeometry } from '../../core/geometry';
import type { QaIssue } from '../quality/qa';
import type { SourceEntityRef } from './source-snapshot';
import type { TwinEntityType } from '../graph/twin-scene-graph';

export type NormalizedEntity = {
  id: string;
  stableId: string;
  type: TwinEntityType;
  geometry?: MeshGeometry;
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
