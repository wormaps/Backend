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
  'PROVIDER_SNAPSHOT_FAILED',
  'COMPLIANCE_PROVIDER_POLICY_RISK',
  'SPATIAL_COORDINATE_OUTLIER',
  'SPATIAL_EXTREME_TERRAIN_SLOPE',
  'SCENE_DUPLICATED_FOOTPRINT',
  'SCENE_ROAD_BUILDING_OVERLAP',
  'GEOMETRY_SELF_INTERSECTION',
  'DCC_MATERIAL_MISSING',
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
