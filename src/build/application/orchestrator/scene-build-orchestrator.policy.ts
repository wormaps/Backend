import type { SceneBuildManifest, SceneScope } from '../../../shared/contracts';

export function buildCoordinateSystem(scope: SceneScope): SceneBuildManifest['coordinateSystem'] {
  return {
    source: 'WGS84',
    localFrame: 'ENU',
    origin: scope.center,
    unit: 'meter',
    axis: 'Y_UP',
  };
}

export function extractComplianceIssues<T extends { code: string }>(issues: T[]): T[] {
  return issues.filter((issue) => issue.code.startsWith('COMPLIANCE_'));
}

export function summarizeQa(issues: { severity: 'critical' | 'major' | 'minor' | 'info'; code: string; action: string }[]) {
  const codeCounts = issues.reduce<Record<string, number>>((distribution, issue) => {
    distribution[issue.code] = (distribution[issue.code] ?? 0) + 1;
    return distribution;
  }, {});

  return {
    issueCount: issues.length,
    criticalCount: issues.filter((issue) => issue.severity === 'critical').length,
    majorCount: issues.filter((issue) => issue.severity === 'major').length,
    minorCount: issues.filter((issue) => issue.severity === 'minor').length,
    infoCount: issues.filter((issue) => issue.severity === 'info').length,
    warnActionCount: issues.filter((issue) => issue.action === 'warn_only').length,
    recordActionCount: issues.filter((issue) => issue.action === 'record_only').length,
    failBuildCount: issues.filter((issue) => issue.action === 'fail_build').length,
    downgradeTierCount: issues.filter((issue) => issue.action === 'downgrade_tier').length,
    stripDetailCount: issues.filter((issue) => issue.action === 'strip_detail').length,
    topCodes: Object.entries(codeCounts)
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .slice(0, 5)
      .map(([code]) => code),
  };
}
