import { readFile } from 'node:fs/promises';
import { getSceneDiagnosticsLogPath } from '../../../storage/scene-storage.utils';
import type { SceneQualityGateMeshSummary } from '../../../types/scene.types';

const CRITICAL_MESH_NAMES = new Set([
  'road_base',
  'road_markings',
  'lane_overlay',
  'crosswalk_overlay',
  'junction_overlay',
  'building_windows',
  'building_roof_surfaces_cool',
  'building_roof_surfaces_warm',
  'building_roof_surfaces_neutral',
  'building_roof_accents_cool',
  'building_roof_accents_warm',
  'building_roof_accents_neutral',
]);
const CRITICAL_MESH_PREFIXES = ['building_shells_'];

interface ParsedDiagnosticsEntry {
  stage?: string;
  meshNodes?: Array<{
    name?: string;
    skipped?: boolean;
    skippedReason?: string;
  }>;
  triangulationFallbackCount?: number;
}

export async function resolveSceneQualityGateMeshSummary(
  sceneId: string,
): Promise<SceneQualityGateMeshSummary> {
  const emptySummary: SceneQualityGateMeshSummary = {
    totalMeshNodeCount: 0,
    totalSkipped: 0,
    polygonBudgetExceededCount: 0,
    criticalPolygonBudgetExceededCount: 0,
    emptyOrInvalidGeometryCount: 0,
    criticalEmptyOrInvalidGeometryCount: 0,
    selectionCutCount: 0,
    missingSourceCount: 0,
    triangulationFallbackCount: 0,
  };

  let raw = '';
  try {
    raw = await readFile(getSceneDiagnosticsLogPath(sceneId), 'utf8');
  } catch {
    return emptySummary;
  }

  const glbBuildEntries = raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      try {
        return JSON.parse(line) as ParsedDiagnosticsEntry;
      } catch {
        return null;
      }
    })
    .filter((entry): entry is ParsedDiagnosticsEntry => {
      if (!entry) {
        return false;
      }
      return entry.stage === 'glb_build';
    });

  const latest = glbBuildEntries.at(-1);
  const meshNodes = latest?.meshNodes;
  if (!meshNodes?.length) {
    return emptySummary;
  }

  const skippedNodes = meshNodes.filter((node) => node.skipped === true);
  const polygonBudgetNodes = skippedNodes.filter(
    (node) =>
      node.skippedReason === 'polygon_budget_exceeded' ||
      node.skippedReason === 'polygon_budget_reserved_for_critical',
  );
  const invalidNodes = skippedNodes.filter(
    (node) => node.skippedReason === 'empty_or_invalid_geometry',
  );

  const triangulationFallbackCount = latest?.triangulationFallbackCount ?? 0;

  return {
    totalMeshNodeCount: meshNodes.length,
    totalSkipped: skippedNodes.length,
    polygonBudgetExceededCount: polygonBudgetNodes.length,
    criticalPolygonBudgetExceededCount: polygonBudgetNodes.filter((node) =>
      isCriticalMeshNode(node.name),
    ).length,
    emptyOrInvalidGeometryCount: invalidNodes.length,
    criticalEmptyOrInvalidGeometryCount: invalidNodes.filter((node) =>
      isCriticalMeshNode(node.name),
    ).length,
    selectionCutCount: skippedNodes.filter(
      (node) => node.skippedReason === 'selection_cut',
    ).length,
    missingSourceCount: skippedNodes.filter(
      (node) => node.skippedReason === 'missing_source',
    ).length,
    triangulationFallbackCount,
  };
}

function isCriticalMeshNode(name?: string): boolean {
  if (!name) {
    return false;
  }
  if (CRITICAL_MESH_NAMES.has(name)) {
    return true;
  }
  return CRITICAL_MESH_PREFIXES.some((prefix) => name.startsWith(prefix));
}
