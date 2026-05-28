import { z } from 'zod';

import type { QaIssue } from '../qa';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const SourceProviderSchema = z.enum([
  'google_places',
  'osm',
  'open_meteo',
  'tomtom',
  'manual',
  'curated',
]);
export type SourceProvider = z.infer<typeof SourceProviderSchema>;

export const SourceSnapshotStorageModeSchema = z.enum([
  'none',
  'metadata_only',
  'ephemeral_payload',
  'cached_payload',
]);
export type SourceSnapshotStorageMode = z.infer<typeof SourceSnapshotStorageModeSchema>;

export const SourceSnapshotStatusSchema = z.enum([
  'success',
  'partial',
  'failed',
]);
export type SourceSnapshotStatus = z.infer<typeof SourceSnapshotStatusSchema>;

// ---------------------------------------------------------------------------
// SourceSnapshotPolicy
// ---------------------------------------------------------------------------

export const SourceSnapshotPolicySchema = z.object({
  provider: SourceProviderSchema,
  attributionRequired: z.boolean(),
  attributionText: z.string().optional(),
  retentionPolicy: z.enum([
    'ephemeral',
    'cache_allowed',
    'id_only',
    'artifact_allowed',
  ]),
  policyVersion: z.string(),
  policyUrl: z.string().optional(),
});
export type SourceSnapshotPolicy = z.infer<typeof SourceSnapshotPolicySchema>;

// ---------------------------------------------------------------------------
// ProviderBudgetPolicy
// ---------------------------------------------------------------------------

export const ProviderBudgetPolicySchema = z.object({
  provider: SourceProviderSchema,
  maxRequestsPerBuild: z.number(),
  maxRetriesPerRequest: z.number(),
  timeoutMs: z.number(),
  backoffPolicy: z.enum(['none', 'linear', 'exponential']),
  cacheReuseWindowSec: z.number().optional(),
  fallbackAllowed: z.boolean(),
});
export type ProviderBudgetPolicy = z.infer<typeof ProviderBudgetPolicySchema>;

// ---------------------------------------------------------------------------
// SourceEntityRef
// ---------------------------------------------------------------------------

export const SourceEntityRefSchema = z.object({
  provider: SourceProviderSchema,
  sourceId: z.string(),
  layer: z.string().optional(),
  sourceSnapshotId: z.string(),
});
export type SourceEntityRef = z.infer<typeof SourceEntityRefSchema>;

// ---------------------------------------------------------------------------
// SourceSnapshot
// ---------------------------------------------------------------------------

export const SourceSnapshotSchema = z.object({
  id: z.string(),
  provider: SourceProviderSchema,
  sceneId: z.string(),
  requestedAt: z.string(),
  receivedAt: z.string().optional(),
  queryHash: z.string(),
  responseHash: z.string().optional(),
  storageMode: SourceSnapshotStorageModeSchema,
  payloadRef: z.string().optional(),
  payloadSchemaVersion: z.string().optional(),
  sourceTimestamp: z.string().optional(),
  status: SourceSnapshotStatusSchema,
  errorCode: z.string().optional(),
  compliance: SourceSnapshotPolicySchema,
  issues: z.custom<QaIssue[]>((val) => Array.isArray(val)).optional(),
});
export type SourceSnapshot = z.infer<typeof SourceSnapshotSchema>;
