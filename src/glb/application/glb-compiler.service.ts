import { createHash } from 'node:crypto';

import type { TypedArray } from '@gltf-transform/core';
import { Buffer, Document, NodeIO, type Accessor } from '@gltf-transform/core';
import { EXTMeshoptCompression } from '@gltf-transform/extensions';
import { meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import earcut from 'earcut';

import type { MeshPlan, MeshPlanNode } from '../../../packages/contracts/mesh-plan';
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
      const positions = this.createPositions(document, buffer, meshNode);
      const indices = this.createIndices(document, buffer, positions);
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
    io.registerExtensions([EXTMeshoptCompression]);
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

    // Apply meshopt compression to reduce final GLB size.
    // artifactHash stays geometry-deterministic (uncompressed baseline).
    let finalBytes: Uint8Array;
    try {
      await MeshoptEncoder.ready;
      await document.transform(meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
      finalBytes = await io.writeBinary(document);
    } catch {
      // Fallback: if compression fails (e.g. primitive too small), use uncompressed.
      finalBytes = bytes;
    }

    return {
      sceneId: input.meshPlan.sceneId,
      artifactRef: `memory://${input.meshPlan.sceneId}.glb`,
      byteLength: finalBytes.byteLength,
      artifactHash,
      bytes: finalBytes,
      finalTier: input.finalTier,
      qaSummary: input.qaSummary,
      meshSummary,
      gltfMetadata: finalMetadata,
    };
  }

  private createPositions(document: Document, buffer: Buffer, node: MeshPlanNode): Accessor {
    const geometry = node.geometry;
    const type = node.primitive;
    const { x, y, z } = node.pivot;

    if (geometry !== undefined) {
      return this.createPositionsFromGeometry(document, buffer, geometry, type, { x, y, z });
    }

    return this.createPlaceholderPositions(document, buffer, type, { x, y, z });
  }

  private createPlaceholderPositions(
    document: Document,
    buffer: Buffer,
    primitive: string,
    pivot: { x: number; y: number; z: number },
  ): Accessor {
    const { x, y, z } = pivot;
    let positions: Float32Array;

    switch (primitive) {
      case 'building_massing':
        positions = new Float32Array([
          x, y, z, x + 1, y, z, x + 1, y, z + 1,
          x, y, z, x + 1, y, z + 1, x, y, z + 1,
        ]);
        break;
      case 'road':
      case 'walkway':
        positions = new Float32Array([
          x - 0.5, y, z, x + 0.5, y, z, x + 0.5, y, z + 0.5,
          x - 0.5, y, z, x + 0.5, y, z + 0.5, x - 0.5, y, z + 0.5,
        ]);
        break;
      case 'terrain':
        positions = new Float32Array([
          x - 1, y, z - 1, x + 1, y, z - 1, x + 1, y, z + 1,
          x - 1, y, z - 1, x + 1, y, z + 1, x - 1, y, z + 1,
        ]);
        break;
      default:
        positions = new Float32Array([
          x, y + 0.5, z, x + 0.3, y, z + 0.3, x - 0.3, y, z - 0.3,
        ]);
        break;
    }

    return document.createAccessor('positions')
      .setArray(positions as TypedArray)
      .setType('VEC3')
      .setBuffer(buffer);
  }

  private createBuildingPositions(
    document: Document,
    buffer: Buffer,
    geometry: Record<string, unknown>,
  ): Accessor {
    const footprint = (geometry as { footprint: { outer: Array<{ x: number; y: number; z: number }> } }).footprint;
    const baseY = (geometry as { baseY?: number }).baseY ?? 0;
    const height = 3;

    const outer = footprint.outer;
    if (outer.length < 3) {
      return this.createPlaceholderPositions(document, buffer, 'building_massing', { x: outer[0]?.x ?? 0, y: baseY, z: outer[0]?.z ?? 0 });
    }

    const flatVerts: number[] = [];
    for (const p of outer) {
      flatVerts.push(p.x, p.z);
    }

    const triangles = earcut(flatVerts);

    const positions: number[] = [];
    for (let i = 0; i < triangles.length; i++) {
      const idx = triangles[i]!;
      const p = outer[idx]!;
      positions.push(p.x, baseY, p.z);
      positions.push(p.x, baseY + height, p.z);
    }

    const positionsArray = new Float32Array(positions);
    return document.createAccessor('positions')
      .setArray(positionsArray as TypedArray)
      .setType('VEC3')
      .setBuffer(buffer);
  }

  private createRoadPositions(
    document: Document,
    buffer: Buffer,
    geometry: Record<string, unknown>,
  ): Accessor {
    const centerline = (geometry as { centerline: Array<{ x: number; y: number; z: number }> }).centerline;
    const width = 2;

    if (centerline.length < 2) {
      return this.createPlaceholderPositions(document, buffer, 'road', { x: centerline[0]?.x ?? 0, y: centerline[0]?.y ?? 0, z: centerline[0]?.z ?? 0 });
    }

    const halfWidth = width / 2;
    const positions: number[] = [];

    for (let i = 0; i < centerline.length; i++) {
      const p = centerline[i]!;

      let dx: number, dz: number;
      if (i === 0) {
        dx = centerline[1]!.x - p.x;
        dz = centerline[1]!.z - p.z;
      } else if (i === centerline.length - 1) {
        dx = p.x - centerline[i - 1]!.x;
        dz = p.z - centerline[i - 1]!.z;
      } else {
        dx = centerline[i + 1]!.x - centerline[i - 1]!.x;
        dz = centerline[i + 1]!.z - centerline[i - 1]!.z;
      }

      const len = Math.sqrt(dx * dx + dz * dz);
      if (len < 0.001) {
        positions.push(p.x - halfWidth, p.y, p.z, p.x + halfWidth, p.y, p.z);
        continue;
      }
      const nx = dx / len;
      const nz = dz / len;

      const px = -nz * halfWidth;
      const pz = nx * halfWidth;

      positions.push(p.x - px, p.y, p.z - pz);
      positions.push(p.x + px, p.y, p.z + pz);
    }

    const positionsArray = new Float32Array(positions);
    return document.createAccessor('positions')
      .setArray(positionsArray as TypedArray)
      .setType('VEC3')
      .setBuffer(buffer);
  }

  private createPositionsFromGeometry(
    document: Document,
    buffer: Buffer,
    geometry: Record<string, unknown>,
    type: string,
    pivot: { x: number; y: number; z: number },
  ): Accessor {
    switch (type) {
      case 'building_massing':
        return this.createBuildingPositions(document, buffer, geometry);
      case 'road':
      case 'walkway':
        return this.createRoadPositions(document, buffer, geometry);
      default:
        return this.createPlaceholderPositions(document, buffer, type, pivot);
    }
  }

  private createIndices(document: Document, buffer: Buffer, positions: Accessor) {
    const count = positions.getCount();
    const indices = new Uint16Array(count);
    for (let i = 0; i < count; i++) {
      indices[i] = i;
    }
    return document.createAccessor('indices')
      .setArray(indices)
      .setType('SCALAR')
      .setBuffer(buffer);
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
