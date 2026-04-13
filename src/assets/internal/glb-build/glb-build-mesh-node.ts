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

  const triangleCount = geometry.indices.length / 3;
  const isProtected = isBudgetProtectedMesh(name, triangleBudget);
  if (!isProtected) {
    const nonProtectedBudget = Math.max(
      0,
      triangleBudget.totalTriangleBudget - triangleBudget.protectedTriangleReserve,
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

  if (triangleBudget.totalTriangleCount + triangleCount > triangleBudget.totalTriangleBudget) {
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

  currentMeshDiagnostics.push({
    name,
    vertices: geometry.positions.length / 3,
    triangles: geometry.indices.length / 3,
    skipped: false,
    sourceCount: trace.sourceCount,
    selectedCount: trace.selectedCount,
  });

  const mesh = doc.createMesh(name);
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

  const semanticExtras = {
    sceneId: scene.name ?? undefined,
    meshName: name,
    sourceCount: trace.sourceCount ?? 0,
    selectedCount: trace.selectedCount ?? 0,
    sourceObjectIds: (trace.sourceObjectIds ?? []).slice(0, 256),
    semanticCategory:
      trace.semanticCategory ?? resolveSemanticCategory(name),
    semanticMetadataCoverage:
      trace.semanticCoverage ??
      resolveSemanticCoverage(trace.sourceCount, trace.selectedCount),
    twinEntityIds: resolveTwinEntityIds(
      scene.name ?? '',
      name,
      trace.semanticCategory ?? resolveSemanticCategory(name),
      trace.sourceObjectIds ?? [],
    ),
    twinComponentIds: resolveTwinComponentIds(
      scene.name ?? '',
      name,
      trace.semanticCategory ?? resolveSemanticCategory(name),
      trace.sourceObjectIds ?? [],
    ),
    sourceSnapshotIds: resolveSourceSnapshotIds(
      scene.name ?? '',
      name,
      trace.semanticCategory ?? resolveSemanticCategory(name),
    ),
  };
  applyExtras(primitive, semanticExtras);
  applyExtras(mesh, semanticExtras);

  mesh.addPrimitive(primitive);
  const node = doc.createNode(name).setMesh(mesh);
  applyExtras(node, semanticExtras);
  const parent = resolveMeshParent(
    doc,
    scene,
    semanticExtras.semanticCategory as string,
    semanticExtras.sourceObjectIds as string[],
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

export function isBudgetProtectedMesh(name: string, triangleBudget: TriangleBudgetState): boolean {
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

  return true;
}
