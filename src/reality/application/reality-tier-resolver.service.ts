import type { RenderIntent } from '../../../packages/contracts/render-intent';
import type { QaIssue } from '../../../packages/contracts/qa';
import type { RealityTier, TwinSceneGraphMetadata } from '../../../packages/contracts/twin-scene-graph';

export class RealityTierResolverService {
  resolveInitial(metadata: TwinSceneGraphMetadata): RealityTier {
    if (this.hasCriticalIssue(metadata.qualityIssues)) {
      return 'PLACEHOLDER_SCENE';
    }

    if (metadata.observedRatio >= 0.8) {
      return 'STRUCTURAL_TWIN';
    }

    if (metadata.observedRatio >= 0.5) {
      return 'PROCEDURAL_MODEL';
    }

    return 'PLACEHOLDER_SCENE';
  }

  resolveProvisional(
    initialCandidate: RealityTier,
    intents: RenderIntent[],
    issues: QaIssue[],
  ): { tier: RealityTier; reasonCodes: string[] } {
    if (this.hasCriticalIssue(issues)) {
      return {
        tier: 'PLACEHOLDER_SCENE',
        reasonCodes: ['CRITICAL_ISSUE_PREVENTS_TIER'],
      };
    }

    const includedIntentCount = intents.filter(
      (intent) => intent.visualMode !== 'placeholder' && intent.visualMode !== 'excluded',
    ).length;
    const structuralIntentCount = intents.filter(
      (intent) => intent.visualMode === 'structural_detail' || intent.visualMode === 'landmark_asset',
    ).length;

    if (includedIntentCount === 0) {
      return {
        tier: 'PLACEHOLDER_SCENE',
        reasonCodes: ['NO_RENDERABLE_INTENTS'],
      };
    }

    if (structuralIntentCount > 0 && initialCandidate === 'STRUCTURAL_TWIN') {
      return {
        tier: 'STRUCTURAL_TWIN',
        reasonCodes: ['STRUCTURAL_INTENT_PRESENT'],
      };
    }

    return {
      tier: initialCandidate === 'PLACEHOLDER_SCENE' ? 'PLACEHOLDER_SCENE' : 'PROCEDURAL_MODEL',
      reasonCodes: ['NO_VISUAL_EVIDENCE_STRUCTURAL_LIMIT'],
    };
  }

  resolveFinal(
    provisionalTier: RealityTier,
    issues: QaIssue[],
  ): { tier: RealityTier; reasonCodes: string[] } {
    if (this.hasCriticalIssue(issues)) {
      return {
        tier: 'PLACEHOLDER_SCENE',
        reasonCodes: ['CRITICAL_ISSUE_FAILS_FINAL_TIER'],
      };
    }

    const downgradeCount = issues.filter((issue) => issue.action === 'downgrade_tier').length;
    if (downgradeCount === 0) {
      return {
        tier: provisionalTier,
        reasonCodes: ['FINAL_TIER_ACCEPTED'],
      };
    }

    let tier = provisionalTier;
    for (let index = 0; index < downgradeCount; index += 1) {
      tier = this.downgrade(tier);
    }

    return {
      tier,
      reasonCodes: ['MAJOR_ISSUE_TIER_DOWNGRADE_APPLIED'],
    };
  }

  private hasCriticalIssue(issues: QaIssue[]): boolean {
    return issues.some((issue) => issue.severity === 'critical' || issue.action === 'fail_build');
  }

  private downgrade(tier: RealityTier): RealityTier {
    switch (tier) {
      case 'REALITY_TWIN':
        return 'STRUCTURAL_TWIN';
      case 'STRUCTURAL_TWIN':
        return 'PROCEDURAL_MODEL';
      case 'PROCEDURAL_MODEL':
      case 'PLACEHOLDER_SCENE':
      default:
        return 'PLACEHOLDER_SCENE';
    }
  }
}
