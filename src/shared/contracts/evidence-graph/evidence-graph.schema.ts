import { z } from 'zod';

import type { SourceEntityRef } from '../source-snapshot';

// ---------------------------------------------------------------------------
// Provenance
// ---------------------------------------------------------------------------

export const ProvenanceSchema = z.enum([
  'observed',
  'inferred',
  'defaulted',
]);
export type Provenance = z.infer<typeof ProvenanceSchema>;

// ---------------------------------------------------------------------------
// DerivationRecord
// ---------------------------------------------------------------------------

export const DerivationRecordSchema = z.object({
  step: z.string(),
  version: z.string(),
  reasonCodes: z.array(z.string()),
  inputEntityIds: z.array(z.string()).optional(),
  outputEntityIds: z.array(z.string()).optional(),
});
export type DerivationRecord = z.infer<typeof DerivationRecordSchema>;

// ---------------------------------------------------------------------------
// EvidenceValue (generic pattern with z.unknown())
// ---------------------------------------------------------------------------

export const EvidenceValueSchema = z.object({
  value: z.unknown(),
  provenance: ProvenanceSchema,
  confidence: z.number(),
  source: z.string(),
  reasonCodes: z.array(z.string()),
  derivation: z.array(DerivationRecordSchema).optional(),
});
export type EvidenceValue = z.infer<typeof EvidenceValueSchema>;

// ---------------------------------------------------------------------------
// EvidenceNode
// ---------------------------------------------------------------------------

export const EvidenceNodeSchema = z.object({
  id: z.string(),
  entityId: z.string().optional(),
  propertyKey: z.string().optional(),
  sourceEntityRef: z.custom<SourceEntityRef>((val) => typeof val === 'object' && val !== null).optional(),
  provenance: ProvenanceSchema,
  confidence: z.number(),
  reasonCodes: z.array(z.string()),
  valueHash: z.string().optional(),
});
export type EvidenceNode = z.infer<typeof EvidenceNodeSchema>;

// ---------------------------------------------------------------------------
// EvidenceEdge
// ---------------------------------------------------------------------------

export const EvidenceEdgeSchema = z.object({
  from: z.string(),
  to: z.string(),
  relation: z.enum([
    'supports',
    'derived_from',
    'contradicts',
    'supersedes',
  ]),
  reasonCodes: z.array(z.string()),
});
export type EvidenceEdge = z.infer<typeof EvidenceEdgeSchema>;

// ---------------------------------------------------------------------------
// EvidenceGraph
// ---------------------------------------------------------------------------

export const EvidenceGraphSchema = z.object({
  id: z.string(),
  sceneId: z.string(),
  snapshotBundleId: z.string(),
  nodes: z.array(EvidenceNodeSchema),
  edges: z.array(EvidenceEdgeSchema),
  generatedAt: z.string(),
  evidencePolicyVersion: z.string(),
});
export type EvidenceGraph = z.infer<typeof EvidenceGraphSchema>;
