import type { MeshPlan } from '../../../packages/contracts/mesh-plan';
import type { QaSummary } from '../../../packages/contracts/manifest';
import type { RealityTier } from '../../../packages/contracts/twin-scene-graph';
import { createHash } from 'node:crypto';

export type GlbArtifact = {
  sceneId: string;
  artifactRef: string;
  byteLength: number;
  artifactHash: string;
  finalTier: RealityTier;
  qaSummary: QaSummary;
  meshSummary: {
    nodeCount: number;
    materialCount: number;
    primitiveCounts: Record<string, number>;
  };
};

export type CompileGlbInput = {
  meshPlan: MeshPlan;
  finalTier: RealityTier;
  qaSummary: QaSummary;
};

export class GlbCompilerService {
  compile(input: CompileGlbInput): GlbArtifact {
    const primitiveCounts = input.meshPlan.nodes.reduce<Record<string, number>>((distribution, node) => {
      distribution[node.primitive] = (distribution[node.primitive] ?? 0) + 1;
      return distribution;
    }, {});

    const artifactRef = `memory://${input.meshPlan.sceneId}.glb`;
    const byteLength = input.meshPlan.nodes.length * 128 + input.meshPlan.materials.length * 64;
    const meshSummary = {
      nodeCount: input.meshPlan.nodes.length,
      materialCount: input.meshPlan.materials.length,
      primitiveCounts,
    };
    const artifactHash = this.computeArtifactHash({
      sceneId: input.meshPlan.sceneId,
      artifactRef,
      byteLength,
      finalTier: input.finalTier,
      qaSummary: input.qaSummary,
      meshSummary,
    });

    return {
      sceneId: input.meshPlan.sceneId,
      artifactRef,
      byteLength,
      artifactHash,
      finalTier: input.finalTier,
      qaSummary: input.qaSummary,
      meshSummary,
    };
  }

  private computeArtifactHash(value: Record<string, unknown>): string {
    return `sha256:${createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;
  }
}
