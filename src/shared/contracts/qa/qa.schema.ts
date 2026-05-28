import { z } from 'zod';

import type { QaIssueCode } from './index';

// ---------------------------------------------------------------------------
// QaIssueCode (template literal pattern)
// ---------------------------------------------------------------------------

export const QaIssueCodeSchema = z.custom<QaIssueCode>(
  (val) => typeof val === 'string' && /^[A-Z_]+$/.test(val),
);

// ---------------------------------------------------------------------------
// QaIssueSeverity
// ---------------------------------------------------------------------------

export const QaIssueSeveritySchema = z.enum([
  'critical',
  'major',
  'minor',
  'info',
]);
export type QaIssueSeverity = z.infer<typeof QaIssueSeveritySchema>;

// ---------------------------------------------------------------------------
// QaIssueScope
// ---------------------------------------------------------------------------

export const QaIssueScopeSchema = z.enum([
  'scene',
  'entity',
  'mesh',
  'material',
  'provider',
]);
export type QaIssueScope = z.infer<typeof QaIssueScopeSchema>;

// ---------------------------------------------------------------------------
// QaIssueAction
// ---------------------------------------------------------------------------

export const QaIssueActionSchema = z.enum([
  'fail_build',
  'downgrade_tier',
  'strip_detail',
  'warn_only',
  'record_only',
]);
export type QaIssueAction = z.infer<typeof QaIssueActionSchema>;

// ---------------------------------------------------------------------------
// QaIssue
// ---------------------------------------------------------------------------

export const QaIssueSchema = z.object({
  code: QaIssueCodeSchema,
  severity: QaIssueSeveritySchema,
  scope: QaIssueScopeSchema,
  entityId: z.string().optional(),
  message: z.string(),
  metric: z.number().optional(),
  threshold: z.number().optional(),
  action: QaIssueActionSchema,
});
export type QaIssue = z.infer<typeof QaIssueSchema>;
