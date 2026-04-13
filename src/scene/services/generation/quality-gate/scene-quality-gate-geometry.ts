import type { SceneDetail } from '../../../types/scene.types';

const COLLISION_RATIO_HARD_FAIL_THRESHOLD = 0.03;

interface GeometryDiagnosticsShape {
  collisionRiskCount?: number;
  groundedGapCount?: number;
  openShellCount?: number;
  roofWallGapCount?: number;
  invalidSetbackJoinCount?: number;
  terrainAnchoredRoadCount?: number;
  terrainAnchoredWalkwayCount?: number;
  transportTerrainCoverageRatio?: number;
}

type SceneGeometryDiagnosticWithCorrection = {
  objectId?: string;
  collisionRiskCount?: number;
  groundedGapCount?: number;
  openShellCount?: number;
  roofWallGapCount?: number;
  invalidSetbackJoinCount?: number;
  terrainAnchoredRoadCount?: number;
  terrainAnchoredWalkwayCount?: number;
  transportTerrainCoverageRatio?: number;
};

export function hasCriticalCollision(args: {
  geometryDiagnostics: SceneDetail['geometryDiagnostics'] | undefined;
  totalBuildingCount: number;
}): boolean {
  const marker = findGeometryCorrectionDiagnostics(args.geometryDiagnostics);
  const collisionCount = marker?.collisionRiskCount ?? 0;
  if (collisionCount === 0) {
    return false;
  }
  const denominator = Math.max(1, args.totalBuildingCount);
  return collisionCount / denominator >= COLLISION_RATIO_HARD_FAIL_THRESHOLD;
}

export function hasCriticalGroundingGap(args: {
  geometryDiagnostics: SceneDetail['geometryDiagnostics'] | undefined;
  totalBuildingCount: number;
}): boolean {
  const marker = findGeometryCorrectionDiagnostics(args.geometryDiagnostics);
  const gapCount = marker?.groundedGapCount ?? 0;
  if (gapCount === 0) {
    return false;
  }
  const denominator = Math.max(1, args.totalBuildingCount);
  return gapCount / denominator >= 0.02;
}

export function hasCriticalShellClosure(
  geometryDiagnostics: SceneDetail['geometryDiagnostics'] | undefined,
): boolean {
  const marker = findGeometryCorrectionDiagnostics(geometryDiagnostics);
  const openShellCount = marker?.openShellCount ?? 0;
  const invalidSetbackJoinCount = marker?.invalidSetbackJoinCount ?? 0;
  return openShellCount > 0 || invalidSetbackJoinCount > 0;
}

export function hasCriticalRoofWallGap(
  geometryDiagnostics: SceneDetail['geometryDiagnostics'] | undefined,
): boolean {
  const marker = findGeometryCorrectionDiagnostics(geometryDiagnostics);
  return (marker?.roofWallGapCount ?? 0) > 0;
}

export function hasCriticalTerrainTransportAlignment(args: {
  geometryDiagnostics: SceneDetail['geometryDiagnostics'] | undefined;
  totalTransportCount: number;
}): boolean {
  if (args.totalTransportCount <= 0) {
    return false;
  }
  const marker = findGeometryCorrectionDiagnostics(args.geometryDiagnostics);
  if (!marker) {
    return true;
  }

  const explicitCoverage = marker.transportTerrainCoverageRatio;
  if (typeof explicitCoverage === 'number') {
    return explicitCoverage < 0.95;
  }

  const anchoredRoadCount = marker.terrainAnchoredRoadCount ?? 0;
  const anchoredWalkwayCount = marker.terrainAnchoredWalkwayCount ?? 0;
  return (
    (anchoredRoadCount + anchoredWalkwayCount) / args.totalTransportCount < 0.95
  );
}

export function findGeometryCorrectionDiagnostics(
  geometryDiagnostics: SceneDetail['geometryDiagnostics'] | undefined,
): GeometryDiagnosticsShape | null {
  if (!geometryDiagnostics || geometryDiagnostics.length === 0) {
    return null;
  }
  const marker = geometryDiagnostics.find(
    (item) => item.objectId === '__geometry_correction__',
  ) as SceneGeometryDiagnosticWithCorrection | null;
  if (!marker) {
    return null;
  }
  return {
    collisionRiskCount: marker.collisionRiskCount,
    groundedGapCount: marker.groundedGapCount,
    openShellCount: marker.openShellCount,
    roofWallGapCount: marker.roofWallGapCount,
    invalidSetbackJoinCount: marker.invalidSetbackJoinCount,
    terrainAnchoredRoadCount: marker.terrainAnchoredRoadCount,
    terrainAnchoredWalkwayCount: marker.terrainAnchoredWalkwayCount,
    transportTerrainCoverageRatio: marker.transportTerrainCoverageRatio,
  };
}
