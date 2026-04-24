import { createHash } from 'node:crypto';

import { Document, NodeIO } from '@gltf-transform/core';

import type { MeshPlan } from '../../../packages/contracts/mesh-plan';
import type { QaSummary, WorMapGltfMetadataExport } from '../../../packages/contracts/manifest';
import type { RealityTier } from '../../../packages/contracts/twin-scene-graph';
import { SCHEMA_VERSION_SET_V1 } from '../../../packages/core/schemas';
import { GltfMetadataFactory } from './gltf-metadata.factory';
import { computeCanonicalGlbArtifactHash, GLB_HASH_PLACEHOLDER } from './glb-artifact-hash';

export type GlbArtifact = {
  sceneId: string;
  artifactRef: string;
  byteLength: number;
  artifactHash: string;
  bytes: Uint8Array;
  finalTier: RealityTier;
  qaSummary: QaSummary;
  meshSummary: {
    nodeCount: number;
    materialCount: number;
    primitiveCounts: Record<string, number>;
  };
  gltfMetadata: WorMapGltfMetadataExport;
};

export type CompileGlbInput = {
  meshPlan: MeshPlan;
  buildId: string;
  snapshotBundleId: string;
  finalTier: RealityTier;
  qaSummary: QaSummary;
};

export class GlbCompilerService {
  constructor(private readonly metadataFactory = new GltfMetadataFactory()) {}

  async compile(input: CompileGlbInput): Promise<GlbArtifact> {
    const document = new Document();
    const root = document.getRoot();
    root.getAsset().version = '2.0';
    root.getAsset().generator = 'wormap-v2';

    const buffer = document.createBuffer('buffer0');
    const materialByRole = new Map(
      input.meshPlan.materials.map((material) => [material.role, material]),
    );

    const nodeById = new Map<string, ReturnType<Document['createNode']>>();
    const materialNodeMap = new Map<string, ReturnType<Document['createMaterial']>>();

    for (const materialPlan of input.meshPlan.materials) {
      const material = document.createMaterial(materialPlan.name);
      material.setDoubleSided(materialPlan.role === 'debug');
      materialNodeMap.set(materialPlan.id, material);
    }

    for (const meshNode of input.meshPlan.nodes) {
      const node = document.createNode(meshNode.name);
      node.setTranslation([meshNode.pivot.x, meshNode.pivot.y, meshNode.pivot.z]);

      const mesh = document.createMesh(meshNode.name);
      const primitive = document.createPrimitive();
      const positions = this.createPositions(document, buffer, meshNode.pivot);
      const indices = this.createIndices(document, buffer);
      primitive.setAttribute('POSITION', positions);
      primitive.setIndices(indices);
      primitive.setMode(4);

      const material = materialNodeMap.get(meshNode.materialId);
      if (material !== undefined) {
        primitive.setMaterial(material);
      }

      mesh.addPrimitive(primitive);
      node.setMesh(mesh);
      nodeById.set(meshNode.id, node);
    }

    for (const meshNode of input.meshPlan.nodes) {
      if (meshNode.parentId === undefined) {
        continue;
      }

      const parent = nodeById.get(meshNode.parentId);
      const child = nodeById.get(meshNode.id);
      if (parent !== undefined && child !== undefined) {
        parent.addChild(child);
      }
    }

    const scene = document.createScene(input.meshPlan.sceneId);
    for (const meshNode of input.meshPlan.nodes.filter((node) => node.parentId === undefined)) {
      const node = nodeById.get(meshNode.id);
      if (node !== undefined) {
        scene.addChild(node);
      }
    }
    root.setDefaultScene(scene);

    const meshSummary = this.summarizeMeshSummary(input.meshPlan);
    const placeholderMetadata = this.metadataFactory.create({
      sceneId: input.meshPlan.sceneId,
      buildId: input.buildId,
      snapshotBundleId: input.snapshotBundleId,
      finalTier: input.finalTier,
      finalTierReasonCodes: [],
      qaSummary: input.qaSummary,
      schemaVersions: SCHEMA_VERSION_SET_V1,
      meshSummary,
      artifactHash: GLB_HASH_PLACEHOLDER,
    });

    root.setExtras({ worMap: placeholderMetadata.extras.value.worMap });

    const io = new NodeIO();
    await io.init();
    const placeholderBytes = await io.writeBinary(document);

    const artifactHash = await computeCanonicalGlbArtifactHash(placeholderBytes);
    const finalMetadata = this.metadataFactory.create({
      sceneId: input.meshPlan.sceneId,
      buildId: input.buildId,
      snapshotBundleId: input.snapshotBundleId,
      finalTier: input.finalTier,
      finalTierReasonCodes: [],
      qaSummary: input.qaSummary,
      schemaVersions: SCHEMA_VERSION_SET_V1,
      meshSummary,
      artifactHash,
    });

    root.setExtras({ worMap: finalMetadata.extras.value.worMap });

    const bytes = await io.writeBinary(document);
    const verifiedArtifactHash = await computeCanonicalGlbArtifactHash(bytes);
    if (verifiedArtifactHash !== artifactHash) {
      throw new Error(
        `Canonical GLB hash changed after final metadata embedding: expected ${artifactHash}, received ${verifiedArtifactHash}.`,
      );
    }

    return {
      sceneId: input.meshPlan.sceneId,
      artifactRef: `memory://${input.meshPlan.sceneId}.glb`,
      byteLength: bytes.byteLength,
      artifactHash,
      bytes,
      finalTier: input.finalTier,
      qaSummary: input.qaSummary,
      meshSummary,
      gltfMetadata: finalMetadata,
    };
  }

  private createPositions(document: Document, buffer: ReturnType<Document['createBuffer']>, pivot: { x: number; y: number; z: number }) {
    const positions = document.createAccessor('positions').setArray(
      new Float32Array([
        pivot.x, pivot.y, pivot.z,
        pivot.x + 1, pivot.y, pivot.z,
        pivot.x, pivot.y, pivot.z + 1,
      ]),
    ).setType('VEC3').setBuffer(buffer);

    return positions;
  }

  private createIndices(document: Document, buffer: ReturnType<Document['createBuffer']>) {
    return document.createAccessor('indices').setArray(
      new Uint16Array([0, 1, 2]),
    ).setType('SCALAR').setBuffer(buffer);
  }

  private computeArtifactHash(bytes: Uint8Array): string {
    return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
  }

  private summarizeMeshSummary(meshPlan: MeshPlan) {
    return {
      nodeCount: meshPlan.nodes.length,
      materialCount: meshPlan.materials.length,
      primitiveCounts: meshPlan.nodes.reduce<Record<string, number>>((distribution, node) => {
        distribution[node.primitive] = (distribution[node.primitive] ?? 0) + 1;
        return distribution;
      }, {}),
    };
  }
}
