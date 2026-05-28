import type { QaIssue } from '../qa';

export type SourceProvider =
  | 'google_places'
  | 'osm'
  | 'open_meteo'
  | 'tomtom'
  | 'manual'
  | 'curated';

export type SourceSnapshotStorageMode =
  | 'none'
  | 'metadata_only'
  | 'ephemeral_payload'
  | 'cached_payload';

export type SourceSnapshotStatus = 'success' | 'partial' | 'failed';

export type SourceSnapshotPolicy = {
  provider: SourceProvider;
  attributionRequired: boolean;
  attributionText?: string;
  retentionPolicy:
    | 'ephemeral'
    | 'cache_allowed'
    | 'id_only'
    | 'artifact_allowed';
  policyVersion: string;
  policyUrl?: string;
};

export type SourceSnapshot = {
  id: string;
  provider: SourceProvider;
  sceneId: string;
  requestedAt: string;
  receivedAt?: string;
  queryHash: string;
  responseHash?: string;
  storageMode: SourceSnapshotStorageMode;
  payloadRef?: string;
  payloadSchemaVersion?: string;
  sourceTimestamp?: string;
  status: SourceSnapshotStatus;
  errorCode?: string;
  compliance: SourceSnapshotPolicy;
  issues?: QaIssue[];
};

export type SourceEntityRef = {
  provider: SourceProvider;
  sourceId: string;
  layer?: string;
  sourceSnapshotId: string;
};

export type ProviderBudgetPolicy = {
  provider: SourceProvider;
  maxRequestsPerBuild: number;
  maxRetriesPerRequest: number;
  timeoutMs: number;
  backoffPolicy: 'none' | 'linear' | 'exponential';
  cacheReuseWindowSec?: number;
  fallbackAllowed: boolean;
};

