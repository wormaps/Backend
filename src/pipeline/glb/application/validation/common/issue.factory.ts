import type { QaIssue } from '../../../../../shared/contracts';

export function createQaIssue(
  code: QaIssue['code'],
  severity: QaIssue['severity'],
  action: QaIssue['action'],
  scope: QaIssue['scope'],
  message: string,
  metric?: number,
  threshold?: number,
): QaIssue {
  return {
    code,
    severity,
    scope,
    message,
    action,
    ...(metric !== undefined ? { metric } : {}),
    ...(threshold !== undefined ? { threshold } : {}),
  };
}
