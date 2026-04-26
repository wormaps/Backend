export type QaIssueCode =
  | `PROVIDER_${string}`
  | `COMPLIANCE_${string}`
  | `SPATIAL_${string}`
  | `SCENE_${string}`
  | `GEOMETRY_${string}`
  | `REALITY_${string}`
  | `DCC_${string}`
  | `REPLAY_${string}`;

export const QA_ISSUE_CODES = [
  'COMPLIANCE_ATTRIBUTION_MISSING',
  'COMPLIANCE_CACHED_PAYLOAD_ALLOWED',
  'COMPLIANCE_MANUAL_SOURCE_EXISTS',
  'COMPLIANCE_PROVIDER_POLICY_RISK',
  'COMPLIANCE_RETENTION_POLICY_RESPECTED',
  'DCC_GLB_ACCESSOR_MINMAX_INVALID',
  'DCC_GLB_BINARY_HASH_MISMATCH',
  'DCC_GLB_BOUNDS_INVALID',
  'DCC_GLB_DUPLICATE_NODE_ID',
  'DCC_GLB_EMPTY_NODE',
  'DCC_GLB_INDEX_OUT_OF_RANGE',
  'DCC_GLB_INVALID_PIVOT',
  'DCC_GLB_INVALID_TRANSFORM',
  'DCC_GLB_ORPHAN_NODE',
  'DCC_GLB_PARENT_CYCLE',
  'DCC_GLB_PRIMITIVE_POLICY_VIOLATION',
  'DCC_GLB_VALIDATOR_ERROR',
  'DCC_MATERIAL_MISSING',
  'GEOMETRY_DEGENERATE_TRIANGLE',
  'GEOMETRY_INVALID_INSET',
  'GEOMETRY_NON_MANIFOLD_EDGE',
  'GEOMETRY_OPEN_SHELL',
  'GEOMETRY_ROOF_WALL_GAP',
  'GEOMETRY_SELF_INTERSECTION',
  'GEOMETRY_Z_FIGHTING_RISK',
  'PROVIDER_MAPPER_VERSION_MISSING',
  'PROVIDER_RATE_LIMIT_CAPTURED',
  'PROVIDER_REPLAYABLE',
  'PROVIDER_RESPONSE_HASH_MISSING',
  'PROVIDER_SNAPSHOT_FAILED',
  'REALITY_DEFAULTED_RATIO_HIGH',
  'REALITY_FACADE_COVERAGE_LOW',
  'REALITY_HEIGHT_CONFIDENCE_LOW',
  'REALITY_INFERRED_RATIO_HIGH',
  'REALITY_MATERIAL_CONFIDENCE_LOW',
  'REALITY_OBSERVED_RATIO_LOW',
  'REALITY_PLACEHOLDER_RATIO_HIGH',
  'REALITY_PROCEDURAL_DECORATION_HIGH',
  'REPLAY_CORE_METRIC_DRIFT',
  'REPLAY_INPUT_HASHES_COMPLETE',
  'REPLAY_MANIFEST_ARTIFACT_MISMATCH',
  'REPLAY_SNAPSHOT_BUNDLE_ID_MISSING',
  'SCENE_DUPLICATED_FOOTPRINT',
  'SCENE_ROAD_BUILDING_OVERLAP',
  'SPATIAL_COORDINATE_NAN_INF',
  'SPATIAL_COORDINATE_OUTLIER',
  'SPATIAL_COORDINATE_ROUNDTRIP_ERROR',
  'SPATIAL_SCENE_EXTENT',
  'SPATIAL_EXTREME_TERRAIN_SLOPE',
  'SPATIAL_TERRAIN_GROUNDING_GAP',
] as const satisfies readonly QaIssueCode[];

export type RegisteredQaIssueCode = (typeof QA_ISSUE_CODES)[number];

export type QaIssueSeverity = 'critical' | 'major' | 'minor' | 'info';

export type QaIssueScope =
  | 'scene'
  | 'entity'
  | 'mesh'
  | 'material'
  | 'provider';

export type QaIssueAction =
  | 'fail_build'
  | 'downgrade_tier'
  | 'strip_detail'
  | 'warn_only'
  | 'record_only';

export type QaIssue = {
  code: QaIssueCode;
  severity: QaIssueSeverity;
  scope: QaIssueScope;
  entityId?: string;
  message: string;
  metric?: number;
  threshold?: number;
  action: QaIssueAction;
};

export const QA_ISSUE_CODE_PREFIXES = [
  'PROVIDER_',
  'COMPLIANCE_',
  'SPATIAL_',
  'SCENE_',
  'GEOMETRY_',
  'REALITY_',
  'DCC_',
  'REPLAY_',
] as const;

export function isQaIssueCode(value: string): value is QaIssueCode {
  return QA_ISSUE_CODE_PREFIXES.some((prefix) => value.startsWith(prefix));
}

export function isRegisteredQaIssueCode(value: string): value is RegisteredQaIssueCode {
  return QA_ISSUE_CODES.includes(value as RegisteredQaIssueCode);
}
