import type { MeshPlan } from '../../../packages/contracts/mesh-plan';

export type GlbArtifact = {
  sceneId: string;
  artifactRef: string;
  byteLength: number;
};

export class GlbCompilerService {
  compile(meshPlan: MeshPlan): GlbArtifact {
    return {
      sceneId: meshPlan.sceneId,
      artifactRef: `memory://${meshPlan.sceneId}.glb`,
      byteLength: 0,
    };
  }
}
