import type {
  SceneDetail,
  SceneFacadeHint,
  SceneMeta,
  SceneRoadDecal,
} from '../../types/scene.types';

export function summarizeMaterialClasses(facadeHints: SceneFacadeHint[]) {
  const grouped = new Map<
    SceneFacadeHint['materialClass'],
    { buildingCount: number; palette: string[] }
  >();

  for (const hint of facadeHints) {
    const current = grouped.get(hint.materialClass) ?? {
      buildingCount: 0,
      palette: [],
    };
    current.buildingCount += 1;
    current.palette = [...new Set([...current.palette, ...hint.palette])].slice(
      0,
      3,
    );
    grouped.set(hint.materialClass, current);
  }

  return [...grouped.entries()].map(([className, value]) => ({
    className,
    palette: value.palette,
    buildingCount: value.buildingCount,
  }));
}

export function buildPlaceReadabilityDiagnostics(
  buildings: SceneMeta['buildings'],
  facadeHints: SceneFacadeHint[],
  roadDecals: SceneRoadDecal[],
  streetFurniture: SceneDetail['streetFurniture'],
  streetFurnitureRowCount: number,
) {
  const heroBuildings = buildings.filter(
    (building) => building.visualRole && building.visualRole !== 'generic',
  ).length;
  const heroIntersections = roadDecals
    .filter((decal) => decal.priority === 'hero')
    .reduce((ids, decal) => {
      ids.add(decal.intersectionId ?? decal.objectId);
      return ids;
    }, new Set<string>()).size;
  const scrambleStripeCount = roadDecals.filter(
    (decal) => decal.layer === 'crosswalk_overlay',
  ).length;
  const billboardPlaneCount = facadeHints.filter(
    (hint) => hint.billboardEligible,
  ).length;
  const canopyCount = facadeHints.filter(
    (hint) => hint.visualRole === 'hero_landmark',
  ).length;
  const roofUnitCount = facadeHints.filter(
    (hint) => hint.signageDensity === 'high',
  ).length;
  const emissiveZoneCount = facadeHints.filter(
    (hint) => hint.emissiveStrength >= 0.8,
  ).length;

  return {
    heroBuildingCount: heroBuildings,
    heroIntersectionCount: heroIntersections,
    scrambleStripeCount,
    billboardPlaneCount,
    canopyCount,
    roofUnitCount,
    emissiveZoneCount,
    streetFurnitureRowCount:
      streetFurnitureRowCount > 0
        ? streetFurnitureRowCount
        : Math.ceil(streetFurniture.length / 2),
  };
}

export function clampCoverage(value: number): number {
  return Math.max(0, Math.min(1, Number(value.toFixed(2))));
}
