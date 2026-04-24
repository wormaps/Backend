import type { SourceSnapshot } from '../../../packages/contracts/source-snapshot';
import type { SceneScope } from '../../../packages/contracts/twin-scene-graph';
import type { GlbCompilerService } from '../../glb/application/glb-compiler.service';
import type { GlbValidationService } from '../../glb/application/glb-validation.service';
import type { NormalizedEntityBuilderService } from '../../normalization/application/normalized-entity-builder.service';
import type { SnapshotCollectorService } from '../../providers/application/snapshot-collector.service';
import type { QaGateService } from '../../qa/application/qa-gate.service';
import type { MeshPlanBuilderService } from '../../render/application/mesh-plan-builder.service';
import type { RenderIntentResolverService } from '../../render/application/render-intent-resolver.service';
import type { EvidenceGraphBuilderService } from '../../twin/application/evidence-graph-builder.service';
import type { TwinGraphBuilderService } from '../../twin/application/twin-graph-builder.service';
import { BuildManifestFactory } from './build-manifest.factory';
import type { SceneBuildRunResult } from './scene-build-run-result';
import { SceneBuildAggregate } from '../domain/scene-build.aggregate';

export type SceneBuildMvpInput = {
  sceneId: string;
  buildId: string;
  snapshotBundleId: string;
  scope: SceneScope;
  snapshots: SourceSnapshot[];
};

export class SceneBuildOrchestratorService {
  constructor(
    private readonly snapshotCollector: SnapshotCollectorService,
    private readonly normalizedEntityBuilder: NormalizedEntityBuilderService,
    private readonly evidenceGraphBuilder: EvidenceGraphBuilderService,
    private readonly twinGraphBuilder: TwinGraphBuilderService,
    private readonly renderIntentResolver: RenderIntentResolverService,
    private readonly meshPlanBuilder: MeshPlanBuilderService,
    private readonly qaGate: QaGateService,
    private readonly glbCompiler: GlbCompilerService,
    private readonly glbValidation: GlbValidationService,
    private readonly manifestFactory: BuildManifestFactory,
  ) {}

  private summarizeQa(issues: { severity: 'critical' | 'major' | 'minor' | 'info'; code: string }[]) {
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
      topCodes: Object.entries(codeCounts)
        .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
        .slice(0, 5)
        .map(([code]) => code),
    };
  }

  run(input: SceneBuildMvpInput): SceneBuildRunResult {
    const build = SceneBuildAggregate.request(input.sceneId, input.buildId);
    build.transitionTo('SNAPSHOT_COLLECTING');

    const collected = this.snapshotCollector.collectFromSnapshots(input.snapshots);
    if (!collected.ok) {
      const qaResult = {
        passed: false,
        issues: this.snapshotCollector.failedSnapshotIssues(input.snapshots),
        finalTier: 'PLACEHOLDER_SCENE' as const,
        finalTierReasonCodes: ['SNAPSHOT_COLLECTION_FAILED'],
        intentAdjusted: false,
      };
      build.transitionTo(collected.error);
      const manifest = this.manifestFactory.create({
        sceneId: input.sceneId,
        buildId: input.buildId,
        state: build.currentState(),
        scopeId: input.scope.focusPlaceId ?? input.sceneId,
        snapshotBundleId: input.snapshotBundleId,
        snapshots: input.snapshots,
        complianceIssues: qaResult.issues.filter((issue) => issue.code.startsWith('COMPLIANCE_')),
        finalTier: qaResult.finalTier,
        finalTierReasonCodes: qaResult.finalTierReasonCodes,
        qaSummary: this.summarizeQa(qaResult.issues),
      });

      return {
        kind: 'snapshot_failure',
        build,
        state: collected.error,
        collected,
        qaResult,
        manifest,
      };
    }

    build.transitionTo('SNAPSHOT_COLLECTED');
    build.transitionTo('NORMALIZING');
    const normalizedEntityBundle = this.normalizedEntityBuilder.build(
      input.sceneId,
      input.snapshotBundleId,
      collected.value.snapshots,
    );
    build.transitionTo('NORMALIZED');

    build.transitionTo('GRAPH_BUILDING');
    const evidenceGraph = this.evidenceGraphBuilder.build(normalizedEntityBundle);
    const twinSceneGraph = this.twinGraphBuilder.build(
      input.sceneId,
      input.scope,
      evidenceGraph,
      normalizedEntityBundle,
    );
    build.transitionTo('GRAPH_BUILT');

    build.transitionTo('RENDER_INTENT_RESOLVING');
    const renderIntentSet = this.renderIntentResolver.resolve(twinSceneGraph);
    build.transitionTo('RENDER_INTENT_RESOLVED');

    build.transitionTo('MESH_PLANNING');
    let effectiveRenderIntentSet = renderIntentSet;
    let meshPlan = this.meshPlanBuilder.build(twinSceneGraph, effectiveRenderIntentSet);
    build.transitionTo('MESH_PLANNED');

    build.transitionTo('QA_RUNNING');
    let qaResult = this.qaGate.evaluate({
      graph: twinSceneGraph,
      intentSet: effectiveRenderIntentSet,
      meshPlan,
    });

    if (qaResult.intentAdjusted) {
      effectiveRenderIntentSet = qaResult.effectiveIntentSet;
      meshPlan = this.meshPlanBuilder.build(twinSceneGraph, effectiveRenderIntentSet);
      qaResult = this.qaGate.evaluate({
        graph: twinSceneGraph,
        intentSet: effectiveRenderIntentSet,
        meshPlan,
      });
    }

    if (!qaResult.passed) {
      build.transitionTo('QUARANTINED');
      const manifest = this.manifestFactory.create({
        sceneId: input.sceneId,
        buildId: input.buildId,
        state: build.currentState(),
        scopeId: input.scope.focusPlaceId ?? input.sceneId,
        snapshotBundleId: input.snapshotBundleId,
        snapshots: collected.value.snapshots,
        renderIntentSet: effectiveRenderIntentSet,
        meshPlan,
        complianceIssues: qaResult.issues.filter((issue) => issue.code.startsWith('COMPLIANCE_')),
        finalTier: qaResult.finalTier,
        finalTierReasonCodes: qaResult.finalTierReasonCodes,
        qaSummary: this.summarizeQa(qaResult.issues),
      });

      return {
        kind: 'quarantined',
        build,
        state: 'QUARANTINED',
        normalizedEntityBundle,
        evidenceGraph,
        twinSceneGraph,
        renderIntentSet: effectiveRenderIntentSet,
        meshPlan,
        qaResult: {
          passed: qaResult.passed,
          issues: qaResult.issues,
          finalTier: qaResult.finalTier,
          finalTierReasonCodes: qaResult.finalTierReasonCodes,
          intentAdjusted: qaResult.intentAdjusted,
        },
        manifest,
      };
    }

    build.transitionTo('GLB_BUILDING');
    const glbArtifact = this.glbCompiler.compile({
      meshPlan,
      finalTier: qaResult.finalTier,
      qaSummary: this.summarizeQa(qaResult.issues),
    });
    const manifestCandidate = this.manifestFactory.create({
      sceneId: input.sceneId,
      buildId: input.buildId,
      state: 'COMPLETED',
      scopeId: input.scope.focusPlaceId ?? input.sceneId,
      snapshotBundleId: input.snapshotBundleId,
      snapshots: collected.value.snapshots,
      renderIntentSet: effectiveRenderIntentSet,
      meshPlan,
      glbArtifact,
      complianceIssues: qaResult.issues.filter((issue) => issue.code.startsWith('COMPLIANCE_')),
      finalTier: qaResult.finalTier,
      finalTierReasonCodes: qaResult.finalTierReasonCodes,
      qaSummary: this.summarizeQa(qaResult.issues),
    });

    const glbValidation = this.glbValidation.validate({
      manifest: manifestCandidate,
      artifact: glbArtifact,
      meshPlan,
    });

    if (!glbValidation.passed) {
      build.transitionTo('FAILED');
      const manifest = this.manifestFactory.create({
        sceneId: input.sceneId,
        buildId: input.buildId,
        state: build.currentState(),
        scopeId: input.scope.focusPlaceId ?? input.sceneId,
        snapshotBundleId: input.snapshotBundleId,
        snapshots: collected.value.snapshots,
        renderIntentSet: effectiveRenderIntentSet,
        meshPlan,
        glbArtifact,
        complianceIssues: qaResult.issues.filter((issue) => issue.code.startsWith('COMPLIANCE_')),
        finalTier: qaResult.finalTier,
        finalTierReasonCodes: qaResult.finalTierReasonCodes,
        qaSummary: this.summarizeQa(qaResult.issues),
      });

      return {
        kind: 'glb_validation_failure',
        build,
        state: 'FAILED',
        normalizedEntityBundle,
        evidenceGraph,
        twinSceneGraph,
        renderIntentSet: effectiveRenderIntentSet,
        meshPlan,
        qaResult: {
          passed: qaResult.passed,
          issues: qaResult.issues,
          finalTier: qaResult.finalTier,
          finalTierReasonCodes: qaResult.finalTierReasonCodes,
          intentAdjusted: qaResult.intentAdjusted,
        },
        glbArtifact,
        glbValidation,
        manifest,
      };
    }

    build.transitionTo('GLB_BUILT');
    build.transitionTo('COMPLETED');
    const manifest = this.manifestFactory.create({
      sceneId: input.sceneId,
      buildId: input.buildId,
      state: build.currentState(),
      scopeId: input.scope.focusPlaceId ?? input.sceneId,
      snapshotBundleId: input.snapshotBundleId,
      snapshots: collected.value.snapshots,
      renderIntentSet: effectiveRenderIntentSet,
      meshPlan,
      glbArtifact,
      complianceIssues: qaResult.issues.filter((issue) => issue.code.startsWith('COMPLIANCE_')),
      finalTier: qaResult.finalTier,
      finalTierReasonCodes: qaResult.finalTierReasonCodes,
      qaSummary: this.summarizeQa(qaResult.issues),
    });

    return {
      kind: 'completed',
      build,
      state: 'COMPLETED',
      normalizedEntityBundle,
      evidenceGraph,
      twinSceneGraph,
      renderIntentSet: effectiveRenderIntentSet,
      meshPlan,
      qaResult: {
        passed: qaResult.passed,
        issues: qaResult.issues,
        finalTier: qaResult.finalTier,
        finalTierReasonCodes: qaResult.finalTierReasonCodes,
        intentAdjusted: qaResult.intentAdjusted,
      },
      glbArtifact,
      manifest,
    };
  }
}
