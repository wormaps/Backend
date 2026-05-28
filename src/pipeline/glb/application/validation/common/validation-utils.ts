import { createHash } from 'node:crypto';

import type { QaSummary } from '../../../../../shared/contracts';
import type { MeshPlanNode } from '../../../../../shared/contracts';

export function sameQaSummary(left: QaSummary, right: QaSummary): boolean {
  return (
    left.issueCount === right.issueCount &&
    left.criticalCount === right.criticalCount &&
    left.majorCount === right.majorCount &&
    left.minorCount === right.minorCount &&
    left.infoCount === right.infoCount &&
    left.failBuildCount === right.failBuildCount &&
    left.downgradeTierCount === right.downgradeTierCount &&
    left.stripDetailCount === right.stripDetailCount &&
    sameStringArray(left.topCodes, right.topCodes)
  );
}

export function sameStringArray(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export function hashJson(value: unknown): string {
  return `sha256:${createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;
}

export function describeValidatorFailure(
  errorCount: number,
  warningCount: number,
  firstIssue: { code?: string; message?: string } | undefined,
): string {
  const suffix =
    firstIssue === undefined
      ? 'No validator issue details were returned.'
      : `${firstIssue.code ?? 'UNKNOWN'}: ${firstIssue.message ?? 'No message.'}`;
  return `glTF validator reported ${errorCount} error(s) and ${warningCount} warning(s). ${suffix}`;
}

export function describeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

export function isFinitePoint(point: MeshPlanNode['pivot']): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y) && Number.isFinite(point.z);
}
