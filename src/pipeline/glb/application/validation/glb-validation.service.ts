import { Injectable, Logger } from '@nestjs/common';

import type { GlbValidationInput, GlbValidationResult } from './common/validation-types';
import { validateConsistency } from './validators/consistency.validator';
import { validateMeshPlan } from './validators/mesh-plan.validator';
import { validateArtifactBytes } from './validators/artifact-bytes.validator';

export type { GlbValidationInput, GlbValidationResult } from './common/validation-types';

@Injectable()
export class GlbValidationService {
  private readonly logger = new Logger(GlbValidationService.name);

  async validate(input: GlbValidationInput): Promise<GlbValidationResult> {
    this.logger.debug(`Validating GLB artifact for scene ${input.manifest.sceneId}`);

    const issues = [
      ...validateConsistency(input.manifest, input.artifact, input.meshPlan),
      ...validateMeshPlan(input.meshPlan),
      ...(await validateArtifactBytes(input.artifact, input.meshPlan)),
    ];

    return {
      passed: !issues.some((issue) => issue.severity === 'critical' || issue.action === 'fail_build'),
      issues,
    };
  }
}
