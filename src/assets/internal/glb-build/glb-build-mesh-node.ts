import { GeometryBuffers } from '../../compiler/road';
import { applyExtras } from './glb-build-material-cache';
import {
  resolveSemanticCategory,
  resolveSemanticCoverage,
  resolveTwinEntityIds,
  resolveTwinComponentIds,
  resolveSourceSnapshotIds,
} from './glb-build-semantic-trace';
import { resolveMeshParent } from './glb-build-hierarchy';

export interface MeshNodeDiagnostic {
  name: string;
  vertices: number;
  triangles: number;
  skipped: boolean;
  sourceCount?: number;
  selectedCount?: number;
  skippedReason?: string;
  lodLevel?: 'HIGH' | 'MEDIUM' | 'LOW';
  layer?: string;
}

export type MeshSemanticTrace = {
  sourceCount?: number;
  selectedCount?: number;
  selectionLod?: 'HIGH' | 'MEDIUM' | 'LOW';
  loadTier?: 'high' | 'medium' | 'low';
  progressiveOrder?: number;
  prototypeKey?: string;
  instanceGroupKey?: string;
  semanticCategory?: string;
  semanticCoverage?: 'NONE' | 'PARTIAL' | 'FULL';
  sourceObjectIds?: string[];
};

export interface TriangleBudgetState {
  totalTriangleBudget: number;
  totalTriangleCount: number;
  protectedTriangleCount: number;
  protectedTriangleReserve: number;
  budgetProtectedMeshNames: Set<string>;
  budgetProtectedMeshPrefixes: string[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GltfNode = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GltfDoc = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GltfScene = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GltfAccessor = any;

function resolveLodLevel(triangleCount: number): 'HIGH' | 'MEDIUM' | 'LOW' {
  if (triangleCount >= 1000) {
    return 'HIGH';
  }
  if (triangleCount >= 200) {
    return 'MEDIUM';
  }
  return 'LOW';
}

export function addMeshNode(
  doc: GltfDoc,
  AccessorRef: GltfAccessor,
  scene: GltfScene,
  buffer: unknown,
  name: string,
  geometry: GeometryBuffers,
  material: unknown,
  trace: MeshSemanticTrace = {},
  currentMeshDiagnostics: MeshNodeDiagnostic[],
  triangleBudget: TriangleBudgetState,
  semanticGroupNodes: Map<string, GltfNode>,
  logger?: { warn: (message: string, context?: Record<string, unknown>) => void },
): void {
  if (!isGeometryValid(geometry)) {
    currentMeshDiagnostics.push({
      name,
      vertices: 0,
      triangles: 0,
      skipped: true,
      sourceCount: trace.sourceCount,
      selectedCount: trace.selectedCount,
      skippedReason: resolveSkippedReason(trace),
    });
    return;
  }

  // Safety net: floor triangle count when indices are not divisible by 3.
  const indicesLength = geometry.indices.length;
  if (indicesLength % 3 !== 0) {
    logger?.warn('glb-build.indices.not-divisible-by-3', {
      meshName: name,
      indicesLength,
    });
  }
  const triangleCount = Math.floor(indicesLength / 3);
  const isProtected = isBudgetProtectedMesh(name, triangleBudget);
  if (!isProtected) {
    const nonProtectedBudget = Math.max(
      0,
      triangleBudget.totalTriangleBudget -
        triangleBudget.protectedTriangleReserve,
    );
    const nonProtectedTriangleCount =
      triangleBudget.totalTriangleCount - triangleBudget.protectedTriangleCount;
    if (nonProtectedTriangleCount + triangleCount > nonProtectedBudget) {
      currentMeshDiagnostics.push({
        name,
        vertices: geometry.positions.length / 3,
        triangles: triangleCount,
        skipped: true,
        sourceCount: trace.sourceCount,
        selectedCount: trace.selectedCount,
        skippedReason: 'polygon_budget_reserved_for_critical',
      });
      return;
    }
  }

  if (
    triangleBudget.totalTriangleCount + triangleCount >
    triangleBudget.totalTriangleBudget
  ) {
    currentMeshDiagnostics.push({
      name,
      vertices: geometry.positions.length / 3,
      triangles: triangleCount,
      skipped: true,
      sourceCount: trace.sourceCount,
      selectedCount: trace.selectedCount,
      skippedReason: 'polygon_budget_exceeded',
    });
    return;
  }

  triangleBudget.totalTriangleCount += triangleCount;
  if (isProtected) {
    triangleBudget.protectedTriangleCount += triangleCount;
  }

  const lodLevel = resolveLodLevel(triangleCount);
  currentMeshDiagnostics.push({
    name,
    vertices: geometry.positions.length / 3,
    triangles: triangleCount,
    skipped: false,
    sourceCount: trace.sourceCount,
    selectedCount: trace.selectedCount,
    lodLevel,
  });

  const mesh = doc.createMesh(name);

  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i < geometry.positions.length; i += 3) {
    const x = geometry.positions[i]!;
    const y = geometry.positions[i + 1]!;
    const z = geometry.positions[i + 2]!;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (z < minZ) minZ = z;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
    if (z > maxZ) maxZ = z;
  }

  const primitive = doc
    .createPrimitive()
    .setAttribute(
      'POSITION',
      doc
        .createAccessor(`${name}-positions`, buffer)
        .setArray(new Float32Array(geometry.positions))
        .setType(AccessorRef.Type.VEC3),
    )
    .setAttribute(
      'NORMAL',
      doc
        .createAccessor(`${name}-normals`, buffer)
        .setArray(new Float32Array(geometry.normals))
        .setType(AccessorRef.Type.VEC3),
    )
    .setIndices(
      doc
        .createAccessor(`${name}-indices`, buffer)
        .setArray(new Uint32Array(geometry.indices))
        .setType(AccessorRef.Type.SCALAR),
    )
    .setMaterial(material);

  if (geometry.uvs && geometry.uvs.length > 0) {
    primitive.setAttribute(
      'TEXCOORD_0',
      doc
        .createAccessor(`${name}-uvs`, buffer)
        .setArray(new Float32Array(geometry.uvs))
        .setType(AccessorRef.Type.VEC2),
    );
  }

  const semanticCategory =
    trace.semanticCategory ?? resolveSemanticCategory(name);
  const semanticMetadataCoverage =
    trace.semanticCoverage ??
    resolveSemanticCoverage(trace.sourceCount, trace.selectedCount);
  const sourceObjectIds = (trace.sourceObjectIds ?? []).slice(0, 256);
  const nodeExtras = {
    sceneId: scene.name ?? undefined,
    meshName: name,
    sourceCount: trace.sourceCount ?? 0,
    selectedCount: trace.selectedCount ?? 0,
    selectionLod: trace.selectionLod,
    loadTier: trace.loadTier,
    progressiveOrder: trace.progressiveOrder,
    prototypeKey: trace.prototypeKey ?? trace.instanceGroupKey,
    instanceGroupKey: trace.instanceGroupKey,
    semanticCategory,
    semanticMetadataCoverage,
    sourceObjectIds,
    twinEntityIds: resolveTwinEntityIds(
      scene.name ?? '',
      name,
      semanticCategory,
      trace.sourceObjectIds ?? [],
    ),
    twinComponentIds: resolveTwinComponentIds(
      scene.name ?? '',
      name,
      semanticCategory,
      trace.sourceObjectIds ?? [],
    ),
    sourceSnapshotIds: resolveSourceSnapshotIds(
      scene.name ?? '',
      name,
      semanticCategory,
    ),
  };

  mesh.addPrimitive(primitive);
  const node = doc.createNode(name).setMesh(mesh);
  applyExtras(node, nodeExtras);
  const parent = resolveMeshParent(
    doc,
    scene,
    semanticCategory,
    sourceObjectIds,
    semanticGroupNodes,
  );
  parent.addChild(node);
}

export function resolveSkippedReason(trace: {
  sourceCount?: number;
  selectedCount?: number;
}): string {
  if ((trace.sourceCount ?? 0) === 0) {
    return 'missing_source';
  }
  if ((trace.selectedCount ?? 0) === 0) {
    return 'selection_cut';
  }
  return 'empty_or_invalid_geometry';
}

export function isBudgetProtectedMesh(
  name: string,
  triangleBudget: TriangleBudgetState,
): boolean {
  if (triangleBudget.budgetProtectedMeshNames.has(name)) {
    return true;
  }
  return triangleBudget.budgetProtectedMeshPrefixes.some((prefix) =>
    name.startsWith(prefix),
  );
}

export function isGeometryValid(geometry: GeometryBuffers): boolean {
  if (geometry.indices.length === 0 || geometry.positions.length === 0) {
    return false;
  }

  if (
    geometry.positions.length % 3 !== 0 ||
    geometry.normals.length !== geometry.positions.length ||
    geometry.indices.length % 3 !== 0 ||
    geometry.indices.some((index) => !Number.isInteger(index) || index < 0)
  ) {
    throw new Error('GLB geometry buffer shape is invalid.');
  }

  if (
    geometry.positions.some((value) => !Number.isFinite(value)) ||
    geometry.normals.some((value) => !Number.isFinite(value))
  ) {
    throw new Error('GLB geometry contains non-finite vertex data.');
  }

  if (
    geometry.uvs !== undefined &&
    geometry.uvs.length > 0 &&
    geometry.uvs.length !== geometry.positions.length / 3 * 2
  ) {
    throw new Error('GLB geometry UV buffer length does not match vertex count.');
  }

  return true;
}
