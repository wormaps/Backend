import type { SceneBuildManifest, MeshPlan } from '../../../../../shared/contracts';
import type { QaIssue } from '../../../../../shared/contracts';
import type { GlbArtifact } from '../../compiler/glb-compiler.service';

export type GlbValidationInput = {
  manifest: SceneBuildManifest;
  artifact: GlbArtifact;
  meshPlan: MeshPlan;
};

export type GlbValidationResult = {
  passed: boolean;
  issues: QaIssue[];
};
