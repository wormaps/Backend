import type { TypedArray } from '@gltf-transform/core';
import { Buffer, Document, NodeIO, type Accessor } from '@gltf-transform/core';
import { EXTMeshoptCompression } from '@gltf-transform/extensions';
import earcut from 'earcut';
import { Injectable, Logger } from '@nestjs/common';

import type { MeshPlan, MeshPlanNode } from '../../../shared/contracts';
import type { QaSummary, WorMapGltfMetadataExport } from '../../../shared/contracts';
import type { RealityTier } from '../../../shared/contracts';
import type {
  BuildingMeshGeometry,
  MeshGeometry,
  RoadMeshGeometry,
  WalkwayMeshGeometry,
} from '../../../shared/core';
import { SCHEMA_VERSION_SET_V1 } from '../../../shared/core';
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

@Injectable()
export class GlbCompilerService {
  private readonly logger = new Logger(GlbCompilerService.name);

  constructor(private readonly metadataFactory: GltfMetadataFactory) {}

  async compile(input: CompileGlbInput): Promise<GlbArtifact> {
    this.logger.log(`GLB compile started sceneId=${input.meshPlan.sceneId} nodes=${input.meshPlan.nodes.length} materials=${input.meshPlan.materials.length}`);

    const document = new Document();
    const root = document.getRoot();
    root.getAsset().version = '2.0';
    root.getAsset().generator = 'wormap-v2';

    const buffer = document.createBuffer('buffer0');

    const nodeById = new Map<string, ReturnType<Document['createNode']>>();
    const materialNodeMap = new Map<string, ReturnType<Document['createMaterial']>>();

    for (const materialPlan of input.meshPlan.materials) {
      const material = document.createMaterial(materialPlan.name);
      material.setDoubleSided(materialPlan.role === 'debug');
      if (materialPlan.baseColor !== undefined) {
        const [r, g, b] = materialPlan.baseColor;
        material.setBaseColorFactor([r, g, b, 1.0]);
      }
      if (materialPlan.role === 'window') {
        material.setDoubleSided(true);
        material.setBaseColorFactor([0.06, 0.09, 0.14, 1.0]); // dark steel blue, linear sRGB
        material.setMetallicFactor(0.85);
        material.setRoughnessFactor(0.08);
      }
      materialNodeMap.set(materialPlan.id, material);
    }

    for (const meshNode of input.meshPlan.nodes) {
      const node = document.createNode(meshNode.name);
      node.setTranslation([meshNode.pivot.x, meshNode.pivot.y, meshNode.pivot.z]);

      const mesh = document.createMesh(meshNode.name);
      const primitive = document.createPrimitive();
      const positions = this.createPositions(document, buffer, meshNode);
      const indices = this.createIndices(document, buffer, positions, meshNode.primitive);
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
    _pivot: { x: number; y: number; z: number },
  ): Accessor {
    // All positions are relative to the node's world translation (pivot).
    // Do NOT embed the pivot offset here — node.setTranslation already places it.
    let positions: Float32Array;

    switch (primitive) {
      case 'building_massing':
      case 'building_windows':
        positions = new Float32Array([0, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 1]);
        break;
      case 'road':
      case 'walkway':
        positions = new Float32Array([
          -0.5, 0, 0, 0.5, 0, 0, 0.5, 0, 0.5,
          -0.5, 0, 0, 0.5, 0, 0.5, -0.5, 0, 0.5,
        ]);
        break;
      case 'terrain':
        positions = new Float32Array([
          -1, 0, -1, 1, 0, -1, 1, 0, 1,
          -1, 0, -1, 1, 0, 1, -1, 0, 1,
        ]);
        break;
      default:
        positions = new Float32Array([0, 0.5, 0, 0.3, 0, 0.3, -0.3, 0, -0.3]);
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
    geometry: BuildingMeshGeometry,
  ): Accessor {
    const outer = geometry.footprint.outer;
    const baseY = geometry.baseY ?? 0;
    const height = geometry.height ?? 5;
    const topY = baseY + height;

    if (outer.length < 3) {
      return this.createPlaceholderPositions(document, buffer, 'building_massing', {
        x: outer[0]?.x ?? 0,
        y: baseY,
        z: outer[0]?.z ?? 0,
      });
    }

    const holes = geometry.footprint.holes;
    const allVerts = holes && holes.length > 0 ? [...outer, ...holes.flat()] : outer;
    const flatXZ: number[] = allVerts.flatMap(({ x, z }) => [x, z]);
    let holeIndices: number[] | undefined;
    if (holes && holes.length > 0) {
      holeIndices = [];
      let offset = outer.length;
      for (const hole of holes) {
        holeIndices.push(offset);
        offset += hole.length;
      }
    }
    const floorTris = earcut(flatXZ, holeIndices);

    // Determine polygon winding via signed area (Shoelace in XZ).
    // signedArea > 0 → CCW in earcut's [x,z] convention:
    //   earcut output triangles have -Y normal (outward for floor), so floor uses a,b,c order.
    //   Roof reverses to +Y (outward). Walls need BL,TR,BR order.
    // signedArea < 0 → CW: cap and wall orders flip.
    let signedArea = 0;
    for (let i = 0; i < outer.length; i++) {
      const a = outer[i]!;
      const b = outer[(i + 1) % outer.length]!;
      signedArea += a.x * b.z - b.x * a.z;
    }
    const ccw = signedArea > 0;

    const positions: number[] = [];

    // Floor cap: outward normal = -Y (visible from below)
    for (let i = 0; i < floorTris.length; i += 3) {
      const a = allVerts[floorTris[i]!]!;
      const b = allVerts[floorTris[i + 1]!]!;
      const c = allVerts[floorTris[i + 2]!]!;
      if (ccw) {
        positions.push(a.x, baseY, a.z, b.x, baseY, b.z, c.x, baseY, c.z);
      } else {
        positions.push(a.x, baseY, a.z, c.x, baseY, c.z, b.x, baseY, b.z);
      }
    }

    // Roof cap: outward normal = +Y (visible from above)
    for (let i = 0; i < floorTris.length; i += 3) {
      const a = allVerts[floorTris[i]!]!;
      const b = allVerts[floorTris[i + 1]!]!;
      const c = allVerts[floorTris[i + 2]!]!;
      if (ccw) {
        positions.push(a.x, topY, a.z, c.x, topY, c.z, b.x, topY, b.z);
      } else {
        positions.push(a.x, topY, a.z, b.x, topY, b.z, c.x, topY, c.z);
      }
    }

    // Wall quads (two triangles per footprint edge)
    const n = outer.length;
    for (let j = 0; j < n; j++) {
      const p0 = outer[j]!;
      const p1 = outer[(j + 1) % n]!;
      if (ccw) {
        // CCW polygon: BL TR BR, BL TL TR → outward normals = (dz, 0, -dx)/L
        positions.push(p0.x, baseY, p0.z, p1.x, topY, p1.z, p1.x, baseY, p1.z);
        positions.push(p0.x, baseY, p0.z, p0.x, topY, p0.z, p1.x, topY, p1.z);
      } else {
        // CW polygon: BL BR TR, BL TR TL → outward normals = (-dz, 0, dx)/L
        positions.push(p0.x, baseY, p0.z, p1.x, baseY, p1.z, p1.x, topY, p1.z);
        positions.push(p0.x, baseY, p0.z, p1.x, topY, p1.z, p0.x, topY, p0.z);
      }
    }

    const positionsArray = new Float32Array(positions);
    return document
      .createAccessor('positions')
      .setArray(positionsArray as TypedArray)
      .setType('VEC3')
      .setBuffer(buffer);
  }

  private createWindowPositions(
    document: Document,
    buffer: Buffer,
    geometry: BuildingMeshGeometry,
  ): Accessor {
    const outer = geometry.footprint.outer;
    const baseY = geometry.baseY ?? 0;
    const height = geometry.height ?? 5;

    if (outer.length < 3) {
      return this.createPlaceholderPositions(document, buffer, 'building_windows', {
        x: outer[0]?.x ?? 0,
        y: baseY,
        z: outer[0]?.z ?? 0,
      });
    }
    const floors = Math.max(1, Math.floor(height / 3.0));
    const floorH = height / floors;

    const INSET = 0.08;
    const SIDE_MARGIN = 0.6;
    const WIN_SPACING = 2.5;
    const WIN_WIDTH = 1.2;
    const WIN_HEIGHT = 1.4;
    const BOTTOM_MARGIN = 0.8;
    const MIN_WALL_LEN = 2.5;

    const positions: number[] = [];
    const n = outer.length;

    // Determine polygon winding via signed area (Shoelace formula in XZ plane).
    // Positive = CCW, negative = CW. Inward normal sign depends on winding.
    let signedArea = 0;
    for (let i = 0; i < n; i++) {
      const a = outer[i]!;
      const b = outer[(i + 1) % n]!;
      signedArea += a.x * b.z - b.x * a.z;
    }
    const windingSign = signedArea > 0 ? 1 : -1; // CCW → +1, CW → -1

    for (let j = 0; j < n; j++) {
      const p0 = outer[j]!;
      const p1 = outer[(j + 1) % n]!;
      const dx = p1.x - p0.x;
      const dz = p1.z - p0.z;
      const L = Math.sqrt(dx * dx + dz * dz);

      if (L < MIN_WALL_LEN) continue;

      // Inward normal depends on winding: CCW outward = (dz/L, -dx/L), inward flips.
      // windingSign flips the direction for CW polygons automatically.
      const inX = (-dz / L) * INSET * windingSign;
      const inZ = (dx / L) * INSET * windingSign;

      const usableLen = L - 2 * SIDE_MARGIN;
      if (usableLen < WIN_WIDTH) continue;

      const winsPerFloor = Math.max(1, Math.floor(usableLen / WIN_SPACING));
      const actualSpacing = usableLen / winsPerFloor;
      const halfW = Math.min(WIN_WIDTH / 2, actualSpacing * 0.4);

      for (let floor = 0; floor < floors; floor++) {
        const winBottomY = baseY + floor * floorH + BOTTOM_MARGIN;
        const winTopY = winBottomY + WIN_HEIGHT;
        if (winTopY > baseY + height - 0.3) continue;

        for (let w = 0; w < winsPerFloor; w++) {
          const tCenter = (SIDE_MARGIN + actualSpacing * (w + 0.5)) / L;
          const t0 = tCenter - halfW / L;
          const t1 = tCenter + halfW / L;

          const x0 = p0.x + t0 * dx + inX;
          const z0 = p0.z + t0 * dz + inZ;
          const x1 = p0.x + t1 * dx + inX;
          const z1 = p0.z + t1 * dz + inZ;

          // Triangle 1: BL BR TR
          positions.push(x0, winBottomY, z0, x1, winBottomY, z1, x1, winTopY, z1);
          // Triangle 2: BL TR TL
          positions.push(x0, winBottomY, z0, x1, winTopY, z1, x0, winTopY, z0);
        }
      }
    }

    if (positions.length === 0) {
      // No valid windows — return placeholder (avoids empty accessor)
      return this.createPlaceholderPositions(document, buffer, 'building_windows', {
        x: outer[0]?.x ?? 0,
        y: baseY,
        z: outer[0]?.z ?? 0,
      });
    }

    return document
      .createAccessor('window-positions')
      .setArray(new Float32Array(positions) as TypedArray)
      .setType('VEC3')
      .setBuffer(buffer);
  }

  private createRoadPositions(
    document: Document,
    buffer: Buffer,
    geometry: RoadMeshGeometry | WalkwayMeshGeometry,
  ): Accessor {
    const centerline = geometry.centerline;
    const width = 2;

    if (centerline.length < 2) {
      return this.createPlaceholderPositions(document, buffer, 'road', { x: centerline[0]?.x ?? 0, y: centerline[0]?.y ?? 0, z: centerline[0]?.z ?? 0 });
    }

    const halfWidth = width / 2;
    const positions: number[] = [];

    for (let i = 0; i < centerline.length; i++) {
      const p = centerline[i]!;

      let dx: number, dz: number;
      const prev = i > 0 ? centerline[i - 1] : centerline[i];
      const next = i < centerline.length - 1 ? centerline[i + 1] : centerline[i];
      if (prev === undefined) continue;
      if (next === undefined) continue;
      dx = next.x - prev.x;
      dz = next.z - prev.z;

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
    geometry: MeshGeometry,
    type: string,
    pivot: { x: number; y: number; z: number },
  ): Accessor {
    switch (geometry.kind) {
      case 'building':
        if (type === 'building_windows') {
          return this.createWindowPositions(document, buffer, geometry);
        }
        return this.createBuildingPositions(document, buffer, geometry);
      case 'road':
      case 'walkway':
        return this.createRoadPositions(document, buffer, geometry);
      default:
        return this.createPlaceholderPositions(document, buffer, type, pivot);
    }
  }

  private createIndices(document: Document, buffer: Buffer, positions: Accessor, type: string) {
    const count = positions.getCount();

    if (type === 'road' || type === 'walkway') {
      const pairCount = Math.floor(count / 2);
      if (pairCount < 2) {
        return document.createAccessor('indices')
          .setArray(new Uint16Array(0))
          .setType('SCALAR')
          .setBuffer(buffer);
      }
      const triCount = (pairCount - 1) * 2;
      const indexCount = triCount * 3;
      const indices = indexCount > 65535 ? new Uint32Array(indexCount) : new Uint16Array(indexCount);
      let idx = 0;
      for (let i = 0; i < pairCount - 1; i++) {
        const a = 2 * i;
        const b = 2 * i + 1;
        const c = 2 * i + 2;
        const d = 2 * i + 3;
        indices[idx++] = a;
        indices[idx++] = b;
        indices[idx++] = d;
        indices[idx++] = a;
        indices[idx++] = d;
        indices[idx++] = c;
      }
      return document.createAccessor('indices')
        .setArray(indices)
        .setType('SCALAR')
        .setBuffer(buffer);
    }

    const indices = count > 65535 ? new Uint32Array(count) : new Uint16Array(count);
    for (let i = 0; i < count; i++) {
      indices[i] = i;
    }
    return document.createAccessor('indices')
      .setArray(indices)
      .setType('SCALAR')
      .setBuffer(buffer);
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
