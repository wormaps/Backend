import { Injectable } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import type {
  MidQaCheck,
  MidQaReport,
  SceneDetail,
  SceneMeta,
  SceneTwinGraph,
  ValidationGateState,
  ValidationReport,
} from '../../types/scene.types';

@Injectable()
export class SceneMidQaService {
  async buildReport(args: {
    sceneId: string;
    meta: SceneMeta;
    detail: SceneDetail;
    twin: SceneTwinGraph;
    validation: ValidationReport;
  }): Promise<MidQaReport> {
    const { sceneId, meta, detail, twin, validation } = args;
    const diagnosticsLogPath = validation.qualityGate?.artifactRefs.diagnosticsLogPath;
    const diagnosticsLineCount = diagnosticsLogPath
      ? await this.readDiagnosticsLineCount(diagnosticsLogPath)
      : 0;

    const providerSnapshotCount = twin.sourceSnapshots.snapshots.filter(
      (snapshot) =>
        snapshot.provider === 'GOOGLE_PLACES' ||
        snapshot.provider === 'OVERPASS' ||
        snapshot.provider === 'MAPILLARY',
    ).length;
    const upstreamEnvelopeCount = twin.sourceSnapshots.snapshots.reduce(
      (sum, snapshot) => sum + (snapshot.upstreamEnvelopes?.length ?? 0),
      0,
    );
    const providerSnapshotWithEnvelopeCount =
      twin.sourceSnapshots.snapshots.filter(
        (snapshot) =>
          (snapshot.provider === 'GOOGLE_PLACES' ||
            snapshot.provider === 'OVERPASS' ||
            snapshot.provider === 'MAPILLARY') &&
          (snapshot.upstreamEnvelopes?.length ?? 0) > 0,
      ).length;
    const replayableRatio =
      twin.sourceSnapshots.snapshots.length > 0
        ? twin.sourceSnapshots.snapshots.filter((snapshot) => snapshot.replayable)
            .length / twin.sourceSnapshots.snapshots.length
        : 0;
    const observedEvidenceCount = twin.evidence.filter(
      (item) => item.provenance === 'observed',
    ).length;
    const inferredEvidenceCount = twin.evidence.filter(
      (item) => item.provenance === 'inferred',
    ).length;
    const defaultedEvidenceCount = twin.evidence.filter(
      (item) => item.provenance === 'defaulted',
    ).length;
    const observedAppearanceCoverage = Math.min(
      1,
      (detail.provenance.osmTagCoverage.coloredBuildings +
        detail.provenance.osmTagCoverage.materialBuildings) /
        Math.max(detail.facadeHints.length, 1),
    );
    const qaChecks: MidQaCheck[] = [
      {
        id: 'provider_trace',
        state:
          providerSnapshotCount >= 2 && providerSnapshotWithEnvelopeCount >= 2
            ? detail.provenance.mapillaryUsed || providerSnapshotCount >= 3
              ? 'PASS'
              : 'WARN'
            : 'FAIL',
        summary: '외부 provider trace 존재 여부',
        metrics: {
          providerSnapshotCount,
          providerSnapshotWithEnvelopeCount,
          upstreamEnvelopeCount,
          mapillaryUsed: detail.provenance.mapillaryUsed,
        },
      },
      {
        id: 'snapshot_replayability',
        state:
          replayableRatio >= 1 && upstreamEnvelopeCount >= 2
            ? 'PASS'
            : replayableRatio >= 0.8
              ? 'WARN'
              : 'FAIL',
        summary: 'snapshot replayability 비율',
        metrics: {
          replayableRatio: round(replayableRatio),
          snapshotCount: twin.sourceSnapshots.snapshots.length,
          upstreamEnvelopeCount,
        },
      },
      {
        id: 'observed_coverage',
        state:
          observedAppearanceCoverage >= 0.15
            ? 'PASS'
            : observedAppearanceCoverage >= 0.05
              ? 'WARN'
              : 'FAIL',
        summary: '관측 기반 appearance coverage',
        metrics: {
          observedAppearanceCoverage: round(observedAppearanceCoverage),
          observedEvidenceCount,
          inferredEvidenceCount,
          defaultedEvidenceCount,
          facadeHintCount: detail.facadeHints.length,
        },
      },
      {
        id: 'spatial_roundtrip',
        state:
          twin.spatialFrame.verification.maxRoundTripErrorM <= 0.05
            ? 'PASS'
            : twin.spatialFrame.verification.maxRoundTripErrorM <= 0.25
              ? 'WARN'
              : 'FAIL',
        summary: 'WGS84 <-> local ENU roundtrip 오차',
        metrics: {
          maxRoundTripErrorM: twin.spatialFrame.verification.maxRoundTripErrorM,
          avgRoundTripErrorM: twin.spatialFrame.verification.avgRoundTripErrorM,
          terrainMode: twin.spatialFrame.terrain.mode,
        },
      },
      {
        id: 'terrain_grounding',
        state:
          twin.spatialFrame.terrain.hasElevationModel &&
          twin.spatialFrame.terrain.mode !== 'FLAT_PLACEHOLDER'
            ? 'PASS'
            : 'FAIL',
        summary: 'terrain/elevation grounding readiness',
        metrics: {
          hasElevationModel: twin.spatialFrame.terrain.hasElevationModel,
          terrainMode: twin.spatialFrame.terrain.mode,
          baseHeightMeters: twin.spatialFrame.terrain.baseHeightMeters,
        },
      },
      {
        id: 'terrain_asset_alignment',
        state:
          !twin.spatialFrame.terrain.hasElevationModel
            ? 'FAIL'
            : (meta.roads.some((road) => Math.abs(road.terrainOffsetM ?? 0) > 0) ||
                  meta.buildings.some(
                    (building) => Math.abs(building.terrainOffsetM ?? 0) > 0,
                  ))
              ? 'PASS'
              : 'WARN',
        summary: 'terrain-grounded road/building asset alignment',
        metrics: {
          terrainAnchoredRoadCount: meta.roads.filter(
            (road) => Math.abs(road.terrainOffsetM ?? 0) > 0,
          ).length,
          terrainAnchoredBuildingCount: meta.buildings.filter(
            (building) => Math.abs(building.terrainOffsetM ?? 0) > 0,
          ).length,
          hasElevationModel: twin.spatialFrame.terrain.hasElevationModel,
        },
      },
      {
        id: 'delivery_binding',
        state:
          twin.delivery.artifacts.some(
            (artifact) => artifact.semanticMetadataCoverage !== 'NONE',
          )
            ? 'WARN'
            : 'FAIL',
        summary: 'delivery artifact semantic binding 수준',
        metrics: {
          artifactCount: twin.delivery.artifacts.length,
          semanticCoverageKinds: twin.delivery.artifacts
            .map((artifact) => artifact.semanticMetadataCoverage)
            .join(','),
        },
      },
      {
        id: 'state_binding',
        state:
          twin.stateChannels.some((channel) => channel.bindingScope === 'SCENE')
            ? 'WARN'
            : 'FAIL',
        summary: 'state binding granularity',
        metrics: {
          channelCount: twin.stateChannels.length,
          bindingScope: twin.stateChannels.map((channel) => channel.bindingScope).join(','),
        },
      },
      {
        id: 'mesh_health',
        state:
          (validation.qualityGate?.meshSummary.emptyOrInvalidGeometryCount ?? 0) === 0 &&
          (validation.qualityGate?.meshSummary.totalSkipped ?? 0) === 0
            ? 'PASS'
            : (validation.qualityGate?.meshSummary.criticalEmptyOrInvalidGeometryCount ?? 0) >
                  0
              ? 'FAIL'
              : 'WARN',
        summary: 'mesh skipped/invalid 상태',
        metrics: {
          totalSkipped: validation.qualityGate?.meshSummary.totalSkipped ?? null,
          invalidGeometry:
            validation.qualityGate?.meshSummary.emptyOrInvalidGeometryCount ??
            null,
          diagnosticsLineCount,
        },
      },
    ];

    const summary = summarizeChecks(qaChecks);
    const overall = scoreChecks(qaChecks);
    const findings = buildFindings(qaChecks, {
      detail,
      diagnosticsLineCount,
      observedAppearanceCoverage,
      meta,
    });

    return {
      reportId: `midqa-${twin.buildId}`,
      sceneId,
      generatedAt: new Date().toISOString(),
      summary,
      score: {
        overall,
        confidence:
          overall >= 0.8 ? 'high' : overall >= 0.6 ? 'medium' : 'low',
      },
      checks: qaChecks,
      findings,
      references: {
        twinBuildId: twin.buildId,
        validationReportId: validation.reportId,
        diagnosticsLogPath,
      },
    };
  }

  private async readDiagnosticsLineCount(path: string): Promise<number> {
    try {
      const raw = await readFile(path, 'utf8');
      return raw
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean).length;
    } catch {
      return 0;
    }
  }
}

function summarizeChecks(checks: MidQaCheck[]): ValidationGateState {
  if (checks.some((check) => check.state === 'FAIL')) {
    return 'FAIL';
  }
  if (checks.some((check) => check.state === 'WARN')) {
    return 'WARN';
  }
  return 'PASS';
}

function scoreChecks(checks: MidQaCheck[]): number {
  const score =
    checks.reduce((sum, check) => {
      if (check.state === 'PASS') {
        return sum + 1;
      }
      if (check.state === 'WARN') {
        return sum + 0.5;
      }
      return sum;
    }, 0) / Math.max(checks.length, 1);
  return round(score);
}

function buildFindings(
  checks: MidQaCheck[],
  context: {
    detail: SceneDetail;
    diagnosticsLineCount: number;
    observedAppearanceCoverage: number;
    meta: SceneMeta;
  },
): MidQaReport['findings'] {
  const findings: MidQaReport['findings'] = [];

  for (const check of checks) {
    if (check.state === 'FAIL') {
      findings.push({
        severity: 'error',
        message: `${check.id} check failed: ${check.summary}`,
      });
    } else if (check.state === 'WARN') {
      findings.push({
        severity: 'warn',
        message: `${check.id} check is partial: ${check.summary}`,
      });
    }
  }

  if (context.observedAppearanceCoverage < 0.05) {
    findings.push({
      severity: 'warn',
      message:
        '건물 appearance의 관측 기반 coverage가 매우 낮습니다. facade/material 결과의 대부분이 추론입니다.',
    });
  }

  if (context.meta.bounds.radiusM > 0) {
    const terrainCheck = checks.find((check) => check.id === 'terrain_grounding');
    if (terrainCheck?.state === 'FAIL') {
      findings.push({
        severity: 'error',
        message:
          'terrain/elevation grounding이 없습니다. 현재 scene은 FLAT_PLACEHOLDER 지면 기준입니다.',
      });
    }
  }

  const terrainAlignmentCheck = checks.find(
    (check) => check.id === 'terrain_asset_alignment',
  );
  if (terrainAlignmentCheck?.state === 'WARN') {
    findings.push({
      severity: 'warn',
      message:
        'terrain source는 있지만 road/building asset grounding 반영이 충분하지 않습니다.',
    });
  }

  if (context.diagnosticsLineCount === 0) {
    findings.push({
      severity: 'warn',
      message: 'diagnostics log line count가 0입니다. build trace가 부족합니다.',
    });
  }

  if (context.meta.buildings.length > 0 && context.detail.facadeHints.length === 0) {
    findings.push({
      severity: 'error',
      message: 'building은 존재하지만 facade hint가 비어 있습니다.',
    });
  }

  if (findings.length === 0) {
    findings.push({
      severity: 'info',
      message: '중간 QA에서 치명적 결함은 발견되지 않았습니다.',
    });
  }

  return findings;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
