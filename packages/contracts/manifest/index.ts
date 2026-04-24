import type { SchemaVersionSet } from '../../core/schemas';
import type { QaIssue } from '../qa';
import type { RealityTier } from '../twin-scene-graph';

export type AttributionSummary = {
  required: boolean;
  entries: Array<{
    provider: string;
    label: string;
    url?: string;
  }>;
};

export type QaSummary = {
  issueCount: number;
  criticalCount: number;
  majorCount: number;
  minorCount: number;
  infoCount: number;
  topCodes: string[];
};

export const SCENE_BUILD_STATES = [
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
] as const;

export type SceneBuildState = (typeof SCENE_BUILD_STATES)[number];

export function isSceneBuildState(value: string): value is SceneBuildState {
  return SCENE_BUILD_STATES.includes(value as SceneBuildState);
}

export type SceneBuildManifest = {
  sceneId: string;
  buildId: string;
  state: SceneBuildState;
  createdAt: string;
  scopeId: string;
  snapshotBundleId: string;
  schemaVersions: SchemaVersionSet;
  mapperVersion: string;
  normalizationVersion: string;
  identityVersion: string;
  renderPolicyVersion: string;
  meshPolicyVersion: string;
  qaVersion: string;
  glbCompilerVersion: string;
  packageVersions: Record<string, string>;
  inputHashes: Record<string, string>;
  artifactHashes: Record<string, string>;
  finalTier: RealityTier;
  finalTierReasonCodes: string[];
  qaSummary: QaSummary;
  attribution: AttributionSummary;
  complianceIssues: QaIssue[];
};
