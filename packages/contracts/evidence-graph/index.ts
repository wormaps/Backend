import type { SourceEntityRef } from '../source-snapshot';

export type Provenance = 'observed' | 'inferred' | 'defaulted';

export type DerivationRecord = {
  step: string;
  version: string;
  reasonCodes: string[];
  inputEntityIds?: string[];
  outputEntityIds?: string[];
};

export type EvidenceValue<T> = {
  value: T;
  provenance: Provenance;
  confidence: number;
  source: string;
  reasonCodes: string[];
  derivation?: DerivationRecord[];
};

export type EvidenceNode = {
  id: string;
  entityId?: string;
  propertyKey?: string;
  sourceEntityRef?: SourceEntityRef;
  provenance: Provenance;
  confidence: number;
  reasonCodes: string[];
  valueHash?: string;
};

export type EvidenceEdge = {
  from: string;
  to: string;
  relation: 'supports' | 'derived_from' | 'contradicts' | 'supersedes';
  reasonCodes: string[];
};

export type EvidenceGraph = {
  id: string;
  sceneId: string;
  snapshotBundleId: string;
  nodes: EvidenceNode[];
  edges: EvidenceEdge[];
  generatedAt: string;
  evidencePolicyVersion: string;
};
