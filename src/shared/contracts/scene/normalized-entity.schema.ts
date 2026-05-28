import { z } from 'zod';

import type { QaIssue } from '../quality/qa';
import type { SourceEntityRef } from './source-snapshot';
import type { TwinEntityType } from '../graph/twin-scene-graph';

import { MeshGeometrySchema } from '../../core/mesh-geometry';
import { QaIssueSchema } from '../quality/qa.schema';
import { SourceEntityRefSchema } from './source-snapshot.schema';
import { TwinEntityTypeSchema } from '../graph/twin-scene-graph.schema';

// ---------------------------------------------------------------------------
// NormalizedEntity
// ---------------------------------------------------------------------------

export const NormalizedEntitySchema = z.object({
  id: z.string(),
  stableId: z.string(),
  type: TwinEntityTypeSchema,
  geometry: MeshGeometrySchema.optional(),
  sourceEntityRefs: z.array(SourceEntityRefSchema),
  tags: z.array(z.string()),
  issues: z.array(QaIssueSchema),
});
export type NormalizedEntity = z.infer<typeof NormalizedEntitySchema>;

// ---------------------------------------------------------------------------
// NormalizedEntityBundle
// ---------------------------------------------------------------------------

export const NormalizedEntityBundleSchema = z.object({
  id: z.string(),
  sceneId: z.string(),
  snapshotBundleId: z.string(),
  entities: z.array(NormalizedEntitySchema),
  issues: z.array(QaIssueSchema),
  generatedAt: z.string(),
  normalizationVersion: z.string(),
});
export type NormalizedEntityBundle = z.infer<typeof NormalizedEntityBundleSchema>;
