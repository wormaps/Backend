import { Buffer, Document, NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression } from '@gltf-transform/extensions';
import { Injectable, Logger } from '@nestjs/common';

import type { MeshPlan } from '../../../../shared/contracts';
import type { QaSummary, WorMapGltfMetadataExport } from '../../../../shared/contracts';
import type { RealityTier } from '../../../../shared/contracts';
import { SCHEMA_VERSION_SET_V1 } from '../../../../shared/core';
import { computeCanonicalGlbArtifactHash, GLB_HASH_PLACEHOLDER } from '../artifact/glb-artifact-hash';
import { createBuildingAO, createIndices, createNormals, createTexcoords, createTreeColors, createWindowColors } from './glb-attributes.builder';
import { createPositions } from './glb-position.builder';
import { addGroundPlane, estimateSceneBaseY } from './glb-ground-plane';
import type { GroundHeightfield } from './glb-ground-plane';
import { createMaterialNodeMap } from './glb-material.factory';
import { summarizeMeshSummary } from './glb-mesh-summary';
import { GltfMetadataFactory } from '../metadata/gltf-metadata.factory';
import type { GooglePhotorealTile } from '../../../../providers/infrastructure';
import { GoogleTilesMergeService } from './google-tiles-merge.service';

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
  /** Half-size of ground plane quad in metres. Defaults to 300. */
  groundRadius?: number;
  /** DEM-sampled ground surface. When present, replaces the flat quad. */
  groundHeightfield?: GroundHeightfield;
  photorealTiles?: GooglePhotorealTile[];
  scopeCenter: { lat: number; lng: number };
};

@Injectable()
export class GlbCompilerService {
  private readonly logger = new Logger(GlbCompilerService.name);

  constructor(
    private readonly metadataFactory: GltfMetadataFactory,
    private readonly googleTilesMerge: GoogleTilesMergeService,
  ) {}

  async compile(input: CompileGlbInput): Promise<GlbArtifact> {
    this.logger.log(
      `GLB compile started sceneId=${input.meshPlan.sceneId} nodes=${input.meshPlan.nodes.length} materials=${input.meshPlan.materials.length}`,
    );

    const document = new Document();
    const root = document.getRoot();
    root.getAsset().version = '2.0';
    root.getAsset().generator = 'wormap-v2';

    const buffer = document.createBuffer('buffer0');

    const nodeById = new Map<string, ReturnType<Document['createNode']>>();
    const materialNodeMap = createMaterialNodeMap(document, input.meshPlan.materials);

    for (const meshNode of input.meshPlan.nodes) {
      const node = document.createNode(meshNode.name);
      node.setTranslation([meshNode.pivot.x, meshNode.pivot.y, meshNode.pivot.z]);

      const mesh = document.createMesh(meshNode.name);
      const primitive = document.createPrimitive();
      const positions = createPositions(document, buffer, meshNode);
      const indices = createIndices(document, buffer, positions, meshNode.primitive);
      const normals = createNormals(document, buffer, positions, indices);
      const texcoords = createTexcoords(document, buffer, positions, meshNode.primitive);

      primitive.setAttribute('POSITION', positions);
      primitive.setIndices(indices);
      primitive.setAttribute('NORMAL', normals);
      primitive.setAttribute('TEXCOORD_0', texcoords);
      if (meshNode.primitive === 'building_windows') {
        primitive.setAttribute('COLOR_0', createWindowColors(document, buffer, positions));
      } else if (meshNode.primitive === 'poi_marker') {
        primitive.setAttribute('COLOR_0', createTreeColors(document, buffer, positions));
      } else if (meshNode.primitive === 'building_massing') {
        primitive.setAttribute('COLOR_0', createBuildingAO(document, buffer, positions));
      }
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
      if (meshNode.parentId === undefined) continue;

      const parent = nodeById.get(meshNode.parentId);
      const child = nodeById.get(meshNode.id);
      if (parent !== undefined && child !== undefined) {
        parent.addChild(child);
      }
    }

    const scene = document.createScene(input.meshPlan.sceneId);
    for (const meshNode of input.meshPlan.nodes) {
      if (meshNode.parentId !== undefined) continue;
      const node = nodeById.get(meshNode.id);
      if (node !== undefined) {
        scene.addChild(node);
      }
    }

    const sceneBaseY = estimateSceneBaseY(input.meshPlan);
    const groundNode = addGroundPlane(
      document,
      buffer as Buffer,
      input.groundRadius ?? 300,
      input.groundHeightfield ? -0.05 : sceneBaseY - 0.02,
      input.groundHeightfield,
    );
    scene.addChild(groundNode);

    if ((input.photorealTiles?.length ?? 0) > 0) {
      await this.googleTilesMerge.merge({
        document,
        sceneRoot: scene,
        tiles: input.photorealTiles ?? [],
        scopeCenter: input.scopeCenter,
      });
    }

    root.setDefaultScene(scene);

    const meshSummary = summarizeMeshSummary(input.meshPlan);
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

    this.logger.log(`GLB compile completed sceneId=${input.meshPlan.sceneId} bytes=${bytes.byteLength} hash=${artifactHash}`);

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
}
