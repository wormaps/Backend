import { Injectable, Logger } from '@nestjs/common';
import type { SourceSnapshot } from '../../shared/contracts';
import type { SceneScope } from '../../shared/contracts';
import { GlbCompilerService } from '../../pipeline/glb/application';
import type { GroundHeightfield } from '../../pipeline/glb/application';
import { GlbValidationService } from '../../pipeline/glb/application';
import type { GooglePhotorealTile } from '../../providers/infrastructure';
import { NormalizedEntityBuilderService } from '../../pipeline/normalization/application';
import { SnapshotCollectorService } from '../../providers/application';
import { QaGateService } from './qa-gate.service';
import { MeshPlanBuilderService } from '../../pipeline/render/application';
import { RenderIntentResolverService } from '../../pipeline/render/application';
import { EvidenceGraphBuilderService } from '../../pipeline/twin/application';
import { TwinGraphBuilderService } from '../../pipeline/twin/application';
import { BuildManifestFactory } from './build-manifest.factory';
import type { SceneBuildRunResult } from './scene-build-run-result';
import { SceneBuildAggregate } from '../domain';
import { buildCoordinateSystem, extractComplianceIssues, summarizeQa } from './orchestrator/scene-build-orchestrator.policy';
import {
  createCompletedResult,
  createGlbValidationFailureResult,
  createQuarantinedResult,
  createSnapshotFailureResult,
  toSceneBuildQaResult,
} from './orchestrator/scene-build-result.factory';

export type SceneBuildMvpInput = {
  sceneId: string;
  buildId: string;
  snapshotBundleId: string;
  scope: SceneScope;
  snapshots: SourceSnapshot[];
  groundHeightfield?: GroundHeightfield;
  photorealTiles?: GooglePhotorealTile[];
};

@Injectable()
export class SceneBuildOrchestratorService {
  private readonly logger = new Logger(SceneBuildOrchestratorService.name);
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

  
  async run(input: SceneBuildMvpInput): Promise<SceneBuildRunResult> {
    const startedAt = Date.now();
    this.logger.log('Build run started', {
      sceneId: input.sceneId,
      snapshotCount: input.snapshots.length,
      radiusMeters: input.scope.radiusMeters,
    });

    const build = SceneBuildAggregate.request(input.sceneId, input.buildId);
    build.transitionTo('SNAPSHOT_COLLECTING');

    const collected = this.snapshotCollector.collectFromSnapshots(input.snapshots);
    if (!collected.ok) {
      this.logger.warn('Snapshot collection failed', {
        sceneId: input.sceneId,
        state: collected.error,
      });
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
        complianceIssues: extractComplianceIssues(qaResult.issues),
        finalTier: qaResult.finalTier,
        finalTierReasonCodes: qaResult.finalTierReasonCodes,
        qaSummary: summarizeQa(qaResult.issues),
        coordinateSystem: buildCoordinateSystem(input.scope),
      });

      return createSnapshotFailureResult({
        build,
        state: collected.error,
        collected,
        qaResult,
        manifest,
      });
    }

    build.transitionTo('SNAPSHOT_COLLECTED');
    this.logger.log('Snapshot collection completed', {
      sceneId: input.sceneId,
      snapshotCount: collected.value.snapshots.length,
    });

    build.transitionTo('NORMALIZING');
    const normalizedEntityBundle = this.normalizedEntityBuilder.build(
      input.sceneId,
      input.snapshotBundleId,
      collected.value.snapshots,
    );
    build.transitionTo('NORMALIZED');
    this.logger.log('Normalization completed', {
      sceneId: input.sceneId,
      normalizedEntityCount: normalizedEntityBundle.entities.length,
      normalizationIssueCount: normalizedEntityBundle.issues.length,
    });

    build.transitionTo('GRAPH_BUILDING');
    const evidenceGraph = this.evidenceGraphBuilder.build(normalizedEntityBundle);
    const twinSceneGraph = this.twinGraphBuilder.build(
      input.sceneId,
      input.scope,
      evidenceGraph,
      normalizedEntityBundle,
    );
    build.transitionTo('GRAPH_BUILT');
    this.logger.log('Twin graph built', {
      sceneId: input.sceneId,
      entityCount: twinSceneGraph.entities.length,
      relationshipCount: twinSceneGraph.relationships.length,
    });

    build.transitionTo('RENDER_INTENT_RESOLVING');
    const renderIntentSet = this.renderIntentResolver.resolve(twinSceneGraph);
    build.transitionTo('RENDER_INTENT_RESOLVED');
    this.logger.log('Render intents resolved', {
      sceneId: input.sceneId,
      intentCount: renderIntentSet.intents.length,
      provisionalTier: renderIntentSet.tier.provisional,
    });

    build.transitionTo('MESH_PLANNING');
    let effectiveRenderIntentSet = renderIntentSet;
    let meshPlan = this.meshPlanBuilder.build(twinSceneGraph, effectiveRenderIntentSet);
    build.transitionTo('MESH_PLANNED');
    this.logger.log('Mesh plan built', {
      sceneId: input.sceneId,
      nodeCount: meshPlan.nodes.length,
      materialCount: meshPlan.materials.length,
    });

    build.transitionTo('QA_RUNNING');
    let qaResult = this.qaGate.evaluate({
      graph: twinSceneGraph,
      intentSet: effectiveRenderIntentSet,
      meshPlan,
    });

    if (qaResult.intentAdjusted) {
      this.logger.warn('QA adjusted render intents, rebuilding mesh plan', {
        sceneId: input.sceneId,
        originalIntentCount: renderIntentSet.intents.length,
      });
      effectiveRenderIntentSet = qaResult.effectiveIntentSet;
      meshPlan = this.meshPlanBuilder.build(twinSceneGraph, effectiveRenderIntentSet);
      qaResult = this.qaGate.evaluate({
        graph: twinSceneGraph,
        intentSet: effectiveRenderIntentSet,
        meshPlan,
      });
    }

    if (!qaResult.passed) {
      this.logger.warn('QA gate failed build', {
        sceneId: input.sceneId,
        issueCount: qaResult.issues.length,
        finalTier: qaResult.finalTier,
      });
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
        complianceIssues: extractComplianceIssues(qaResult.issues),
        finalTier: qaResult.finalTier,
        finalTierReasonCodes: qaResult.finalTierReasonCodes,
        qaSummary: summarizeQa(qaResult.issues),
        coordinateSystem: buildCoordinateSystem(input.scope),
      });

      return createQuarantinedResult({
        build,
        normalizedEntityBundle,
        evidenceGraph,
        twinSceneGraph,
        renderIntentSet: effectiveRenderIntentSet,
        meshPlan,
        qaResult: toSceneBuildQaResult(qaResult),
        manifest,
      });
    }

    build.transitionTo('GLB_BUILDING');
    const glbArtifact = await this.glbCompiler.compile({
      meshPlan,
      buildId: input.buildId,
      snapshotBundleId: input.snapshotBundleId,
      finalTier: qaResult.finalTier,
      qaSummary: summarizeQa(qaResult.issues),
      groundRadius: (input.scope.radiusMeters ?? 150) * 2.5,
      groundHeightfield: input.groundHeightfield,
      photorealTiles: input.photorealTiles,
      scopeCenter: input.scope.center,
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
      complianceIssues: extractComplianceIssues(qaResult.issues),
      finalTier: qaResult.finalTier,
      finalTierReasonCodes: qaResult.finalTierReasonCodes,
      qaSummary: summarizeQa(qaResult.issues),
      coordinateSystem: buildCoordinateSystem(input.scope),
    });

    const glbValidation = await this.glbValidation.validate({
      manifest: manifestCandidate,
      artifact: glbArtifact,
      meshPlan,
    });

    if (!glbValidation.passed) {
      this.logger.error('GLB validation failed', {
        sceneId: input.sceneId,
        validationIssueCount: glbValidation.issues.length,
        issues: glbValidation.issues
          .filter((issue) => issue.severity === 'critical' || issue.action === 'fail_build')
          .map((issue) => ({ code: issue.code, message: issue.message, metric: issue.metric, threshold: issue.threshold })),
      });
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
        complianceIssues: extractComplianceIssues(qaResult.issues),
        finalTier: qaResult.finalTier,
        finalTierReasonCodes: qaResult.finalTierReasonCodes,
        qaSummary: summarizeQa(qaResult.issues),
        coordinateSystem: buildCoordinateSystem(input.scope),
      });

      return createGlbValidationFailureResult({
        build,
        normalizedEntityBundle,
        evidenceGraph,
        twinSceneGraph,
        renderIntentSet: effectiveRenderIntentSet,
        meshPlan,
        qaResult: toSceneBuildQaResult(qaResult),
        glbArtifact,
        glbValidation,
        manifest,
      });
    }

    build.transitionTo('GLB_BUILT');
    build.transitionTo('COMPLETED');
    this.logger.log('Build run completed', {
      sceneId: input.sceneId,
      elapsedMs: Date.now() - startedAt,
      glbByteLength: glbArtifact.byteLength,
      nodeCount: glbArtifact.meshSummary.nodeCount,
      materialCount: glbArtifact.meshSummary.materialCount,
    });
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
      complianceIssues: extractComplianceIssues(qaResult.issues),
      finalTier: qaResult.finalTier,
      finalTierReasonCodes: qaResult.finalTierReasonCodes,
      qaSummary: summarizeQa(qaResult.issues),
      coordinateSystem: buildCoordinateSystem(input.scope),
    });

    return createCompletedResult({
      build,
      normalizedEntityBundle,
      evidenceGraph,
      twinSceneGraph,
      renderIntentSet: effectiveRenderIntentSet,
      meshPlan,
      qaResult: toSceneBuildQaResult(qaResult),
      glbArtifact,
      manifest,
    });
  }
}
