import { z } from 'zod';

import type { QaIssue } from '../qa';
import type { RealityTier } from '../twin-scene-graph';
import type { SchemaVersionSet } from '../../core/schemas';

import { QaIssueSchema } from '../qa/qa.schema';
import { RealityTierSchema } from '../twin-scene-graph/twin-scene-graph.schema';
import { SchemaVersionSetSchema } from '../../core/schemas/index';

// ---------------------------------------------------------------------------
// AttributionSummary
// ---------------------------------------------------------------------------

export const AttributionSummarySchema = z.object({
  required: z.boolean(),
  entries: z.array(
    z.object({
      provider: z.string(),
      label: z.string(),
      url: z.string().optional(),
    }),
  ),
});
export type AttributionSummary = z.infer<typeof AttributionSummarySchema>;

// ---------------------------------------------------------------------------
// QaSummary
// ---------------------------------------------------------------------------

export const QaSummarySchema = z.object({
  issueCount: z.number(),
  criticalCount: z.number(),
  majorCount: z.number(),
  minorCount: z.number(),
  infoCount: z.number(),
  warnActionCount: z.number(),
  recordActionCount: z.number(),
  failBuildCount: z.number(),
  downgradeTierCount: z.number(),
  stripDetailCount: z.number(),
  topCodes: z.array(z.string()),
});
export type QaSummary = z.infer<typeof QaSummarySchema>;

// ---------------------------------------------------------------------------
// SceneBuildState
// ---------------------------------------------------------------------------

export const SceneBuildStateSchema = z.enum([
  'REQUESTED',
  'SNAPSHOT_COLLECTING',
  'SNAPSHOT_PARTIAL',
  'SNAPSHOT_COLLECTED',
  'NORMALIZING',
  'NORMALIZED',
  'GRAPH_BUILDING',
  'GRAPH_BUILT',
  'RENDER_INTENT_RESOLVING',
  'RENDER_INTENT_RESOLVED',
  'MESH_PLANNING',
  'MESH_PLANNED',
  'GLB_BUILDING',
  'GLB_BUILT',
  'QA_RUNNING',
  'QUARANTINED',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
  'SUPERSEDED',
]);
export type SceneBuildState = z.infer<typeof SceneBuildStateSchema>;

// ---------------------------------------------------------------------------
// SceneBuildManifest
// ---------------------------------------------------------------------------

export const SceneBuildManifestSchema = z.object({
  sceneId: z.string(),
  buildId: z.string(),
  state: SceneBuildStateSchema,
  createdAt: z.string(),
  scopeId: z.string(),
  snapshotBundleId: z.string(),
  schemaVersions: SchemaVersionSetSchema,
  mapperVersion: z.string(),
  normalizationVersion: z.string(),
  identityVersion: z.string(),
  renderPolicyVersion: z.string(),
  meshPolicyVersion: z.string(),
  qaVersion: z.string(),
  glbCompilerVersion: z.string(),
  packageVersions: z.record(z.string(), z.string()),
  inputHashes: z.record(z.string(), z.string()),
  artifactHashes: z.record(z.string(), z.string()),
  finalTier: RealityTierSchema,
  finalTierReasonCodes: z.array(z.string()),
  qaSummary: QaSummarySchema,
  attribution: AttributionSummarySchema,
  complianceIssues: z.array(QaIssueSchema),
  coordinateSystem: z
    .object({
      source: z.literal('WGS84'),
      localFrame: z.literal('ENU'),
      origin: z.object({ lat: z.number(), lng: z.number() }),
      unit: z.literal('meter'),
      axis: z.enum(['Y_UP', 'Z_UP']),
    })
    .optional(),
});
export type SceneBuildManifest = z.infer<typeof SceneBuildManifestSchema>;
