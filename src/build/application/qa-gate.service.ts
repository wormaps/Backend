import { Injectable, Logger } from '@nestjs/common';
import type { MeshPlan } from '../../shared/contracts';
import type { QaIssue } from '../../shared/contracts';
import type { RenderIntent, RenderIntentSet } from '../../shared/contracts';
import type { RealityTier, TwinSceneGraph } from '../../shared/contracts';
import { RealityTierResolverService } from '../../pipeline/twin/application/reality-tier-resolver.service';

export type QaGateInput = {
  graph: TwinSceneGraph;
  intentSet: RenderIntentSet;
  meshPlan: MeshPlan;
};

export type QaGateResult = {
  passed: boolean;
  issues: QaIssue[];
  effectiveIntentSet: RenderIntentSet;
  intentAdjusted: boolean;
  finalTier: RealityTier;
  finalTierReasonCodes: string[];
  warnCount: number;
  infoCount: number;
};

@Injectable()
export class QaGateService {
  private readonly logger = new Logger(QaGateService.name);

  constructor(private readonly realityTierResolver: RealityTierResolverService) {}

  evaluate(input: QaGateInput): QaGateResult {
    this.logger.debug(`Evaluating QA gate scene=${input.intentSet.sceneId}`);
    const issues = [
      ...input.graph.metadata.qualityIssues,
      ...input.meshPlan.nodes.flatMap((node) =>
        !input.meshPlan.materials.some((material) => material.id === node.materialId)
          ? [
              {
                code: 'DCC_MATERIAL_MISSING',
                severity: 'critical',
                scope: 'mesh',
                message: `MeshPlan node ${node.id} references missing material ${node.materialId}.`,
                action: 'fail_build',
              } satisfies QaIssue,
            ]
          : [],
      ),
    ];

    const effectiveIntentSet = this.stripDetailIfNeeded(input.intentSet, issues);
    const finalTier = this.realityTierResolver.resolveFinal(effectiveIntentSet.tier.provisional, issues);

    const warnCount = issues.filter((issue) => issue.severity === 'minor').length;
    const infoCount = issues.filter((issue) => issue.severity === 'info').length;

    return {
      passed: issues.every((issue) => issue.severity !== 'critical'),
      issues,
      effectiveIntentSet,
      intentAdjusted: effectiveIntentSet !== input.intentSet,
      finalTier: finalTier.tier,
      finalTierReasonCodes: finalTier.reasonCodes,
      warnCount,
      infoCount,
    };
  }

  private stripDetailIfNeeded(intentSet: RenderIntentSet, issues: QaIssue[]): RenderIntentSet {
    const shouldStripDetail = issues.some((issue) => issue.action === 'strip_detail');
    if (!shouldStripDetail) {
      return intentSet;
    }

    let changed = false;
    const intents: RenderIntent[] = intentSet.intents.map((intent) => {
      if (intent.visualMode !== 'structural_detail' && intent.visualMode !== 'landmark_asset') {
        return intent;
      }

      changed = true;
      return {
        ...intent,
        visualMode: 'massing' as const,
        allowedDetails: {
          windows: false,
          entrances: false,
          roofEquipment: false,
          facadeMaterial: false,
          signage: false,
        },
        reasonCodes: [...intent.reasonCodes, 'QA_STRIP_DETAIL_APPLIED'],
      };
    });

    if (!changed) {
      return intentSet;
    }

    return {
      ...intentSet,
      intents,
    };
  }
}
