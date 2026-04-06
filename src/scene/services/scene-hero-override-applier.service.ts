import { Injectable } from '@nestjs/common';
import { midpoint } from '../../places/utils/geo.utils';
import {
  IntersectionProfile,
  SceneDetail,
  SceneFacadeHint,
  SceneMeta,
  SceneRoadDecal,
} from '../types/scene.types';
import { HeroOverrideManifest } from '../overrides/shibuya-scramble-crossing.override';
import { SceneHeroOverrideMatcherService } from './scene-hero-override-matcher.service';

@Injectable()
export class SceneHeroOverrideApplierService {
  constructor(
    private readonly matcher: SceneHeroOverrideMatcherService = new SceneHeroOverrideMatcherService(),
  ) {}

  apply(
    meta: SceneMeta,
    detail: SceneDetail,
    manifest: HeroOverrideManifest,
  ): { meta: SceneMeta; detail: SceneDetail } {
    const overrideAssignments = this.matcher.resolveFacadeAssignments(meta, manifest);
    const overriddenBuildings = this.applyBuildingOverrides(meta.buildings, overrideAssignments);
    const facadeHints = this.mergeFacadeHints(meta, detail, overrideAssignments);
    const crossings = mergeByObjectId(
      detail.crossings,
      manifest.crossings.map((crossing) => ({
        objectId: crossing.id,
        name: crossing.name,
        type: 'CROSSING' as const,
        crossing: crossing.style,
        crossingRef: crossing.style,
        signalized: crossing.style === 'signalized',
        path: crossing.path,
        center: midpoint(crossing.path) ?? crossing.path[0],
        principal: crossing.principal ?? true,
        style: crossing.style,
      })),
    );
    const streetFurniture = mergeByObjectId(
      detail.streetFurniture,
      [
        ...manifest.streetFurniture.map((item) => ({
          objectId: item.id,
          name: item.id,
          type: item.type,
          location: item.location,
          principal: item.principal ?? true,
        })),
        ...manifest.streetFurnitureRows.flatMap((row, rowIndex) =>
          row.points.map((point, pointIndex) => ({
            objectId: `${row.id}-${pointIndex + 1}`,
            name: `${row.id}-${pointIndex + 1}`,
            type: row.type,
            location: point,
            principal: row.principal ?? rowIndex < 2,
          })),
        ),
      ],
    );
    const signageClusters = mergeByObjectId(
      detail.signageClusters,
      manifest.signageClusters.map((cluster) => ({
        objectId: cluster.id,
        anchor: cluster.anchor,
        panelCount: cluster.panelCount,
        palette: cluster.palette,
        emissiveStrength: cluster.emissiveStrength,
        widthMeters: cluster.widthMeters,
        heightMeters: cluster.heightMeters,
      })),
    );
    const roadDecals = mergeByObjectId(
      detail.roadDecals ?? [],
      [
        ...manifest.roadDecalOverrides,
        ...this.buildIntersectionDecals(manifest),
      ],
    );
    const intersectionProfiles = mergeByObjectId(
      detail.intersectionProfiles ?? [],
      [
        ...manifest.crossings.map((crossing) => ({
          objectId: `${crossing.id}-intersection`,
          anchor: midpoint(crossing.path) ?? crossing.path[0],
          profile: resolveCrossingProfile(crossing.principal ?? false, crossing.style),
          crossingObjectIds: [crossing.id],
        })),
        ...manifest.intersectionOverrides.map((intersection) => ({
          objectId: intersection.intersectionId,
          anchor:
            midpoint(intersection.stripeSets[0]?.centerPath ?? []) ??
            intersection.crosswalkPolygons[0]?.[0] ??
            { lat: 0, lng: 0 },
          profile: resolveIntersectionProfile(intersection.profile),
          crossingObjectIds: intersection.crossingObjectIds,
        })),
      ],
    );
    const landmarkAnchors = mergeByObjectId(
      meta.landmarkAnchors,
      manifest.landmarkAnchors.map((anchor) => ({
        objectId: anchor.id,
        name: anchor.name,
        location: anchor.location,
        kind: anchor.kind,
      })),
    );
    const heroOverridesApplied = [
      ...detail.heroOverridesApplied,
      manifest.id,
      ...manifest.crossings.map((item) => item.id),
      ...manifest.signageClusters.map((item) => item.id),
      ...manifest.facadeOverrides.map((item) => item.id),
    ];

    const mergedDetail: SceneDetail = {
      ...detail,
      detailStatus: detail.detailStatus === 'OSM_ONLY' ? 'PARTIAL' : detail.detailStatus,
      crossings,
      streetFurniture,
      facadeHints,
      signageClusters,
      intersectionProfiles,
      roadDecals,
      placeReadabilityDiagnostics: buildPlaceReadabilityDiagnostics(
        overriddenBuildings,
        facadeHints,
        roadDecals,
        streetFurniture,
        manifest.streetFurnitureRows.length,
      ),
      heroOverridesApplied,
      provenance: {
        ...detail.provenance,
        overrideCount: heroOverridesApplied.length,
      },
    };

    const mergedMeta: SceneMeta = {
      ...meta,
      buildings: overriddenBuildings,
      detailStatus: mergedDetail.detailStatus,
      landmarkAnchors,
      materialClasses: summarizeMaterialClasses(facadeHints),
      visualCoverage: {
        structure: meta.visualCoverage.structure,
        streetDetail: clampCoverage(meta.visualCoverage.streetDetail + 0.25),
        landmark: clampCoverage(meta.visualCoverage.landmark + 0.35),
        signage: clampCoverage(meta.visualCoverage.signage + 0.4),
      },
    };

    return {
      meta: mergedMeta,
      detail: mergedDetail,
    };
  }

  private mergeFacadeHints(
    meta: SceneMeta,
    detail: SceneDetail,
    overrideAssignments: Map<string, HeroOverrideManifest['facadeOverrides'][number]>,
  ): SceneFacadeHint[] {
    const overridden = [...overrideAssignments.entries()].map(([buildingObjectId, override]) => {
      const matchedBuilding =
        meta.buildings.find((building) => building.objectId === buildingObjectId) ?? null;
      return {
        objectId: matchedBuilding?.objectId ?? override.objectId ?? override.id,
        anchor: override.anchor,
        facadeEdgeIndex:
          override.facadeEdgeIndex ?? (matchedBuilding ? 0 : null),
        windowBands: matchedBuilding
          ? Math.max(
              2,
              Math.floor(
                (matchedBuilding.heightMeters * (override.heightMultiplier ?? 1)) / 3.4,
              ),
            )
          : 4,
        billboardEligible: override.billboardEligible ?? false,
        palette: override.palette,
        shellPalette: override.shellPalette ?? override.palette.slice(0, 2),
        panelPalette: override.panelPalette ?? override.palette,
        materialClass: override.materialClass,
        signageDensity: override.signageDensity,
        emissiveStrength: override.emissiveStrength,
        glazingRatio: override.glazingRatio,
        visualArchetype: override.visualArchetype,
        geometryStrategy: override.geometryStrategy,
        facadePreset: override.facadePreset,
        podiumLevels: override.podiumLevels,
        setbackLevels: override.setbackLevels,
        cornerChamfer: override.cornerChamfer,
        roofAccentType: override.roofAccentType,
        windowPatternDensity: override.windowPatternDensity,
        signBandLevels: override.signBandLevels,
        visualRole: override.visualRole,
        baseMass: override.baseMass,
        facadeSpec: override.facadeSpec,
        podiumSpec: override.podiumSpec,
        signageSpec: override.signageSpec,
        roofSpec: override.roofSpec,
        weakEvidence: false,
      };
    });

    return mergeByObjectId(detail.facadeHints, overridden);
  }

  private applyBuildingOverrides(
    buildings: SceneMeta['buildings'],
    overrideAssignments: Map<string, HeroOverrideManifest['facadeOverrides'][number]>,
  ): SceneMeta['buildings'] {
    return buildings.map((building) => {
      const override = overrideAssignments.get(building.objectId);
      if (!override) {
        return building;
      }

      const multiplier = override.heightMultiplier ?? 1;
      return {
        ...building,
        heightMeters: Number((building.heightMeters * multiplier).toFixed(2)),
        preset: override.preset ?? building.preset,
        roofType: override.roofType ?? building.roofType,
        visualArchetype: override.visualArchetype ?? building.visualArchetype,
        geometryStrategy: override.geometryStrategy ?? building.geometryStrategy,
        facadePreset: override.facadePreset ?? building.facadePreset,
        podiumLevels: override.podiumLevels ?? building.podiumLevels,
        setbackLevels: override.setbackLevels ?? building.setbackLevels,
        cornerChamfer: override.cornerChamfer ?? building.cornerChamfer,
        roofAccentType: override.roofAccentType ?? building.roofAccentType,
        signBandLevels: override.signBandLevels ?? building.signBandLevels,
        emissiveBandStrength:
          override.emissiveStrength ?? building.emissiveBandStrength,
        windowPatternDensity:
          override.windowPatternDensity ?? building.windowPatternDensity,
        facadeColor: override.shellPalette?.[0] ?? building.facadeColor,
        visualRole: override.visualRole ?? building.visualRole,
        baseMass: override.baseMass ?? building.baseMass,
        facadeSpec: override.facadeSpec ?? building.facadeSpec,
        podiumSpec: override.podiumSpec ?? building.podiumSpec,
        signageSpec: override.signageSpec ?? building.signageSpec,
        roofSpec: override.roofSpec ?? building.roofSpec,
      };
    });
  }

  private buildIntersectionDecals(
    manifest: HeroOverrideManifest,
  ): SceneRoadDecal[] {
    return manifest.intersectionOverrides.flatMap((intersection) => [
      ...intersection.crosswalkPolygons.map((polygon, index) => ({
        objectId: `${intersection.id}-crosswalk-poly-${index + 1}`,
        intersectionId: intersection.intersectionId,
        type: 'CROSSWALK_OVERLAY' as const,
        color: '#f8f8f6',
        emphasis: 'hero' as const,
        priority: 'hero' as const,
        layer: 'crosswalk_overlay' as const,
        shapeKind: 'polygon_fill' as const,
        styleToken: 'scramble_white' as const,
        polygon,
      })),
      ...intersection.stripeSets.map((stripeSet, index) => ({
        objectId: `${intersection.id}-stripe-set-${index + 1}`,
        intersectionId: intersection.intersectionId,
        type: 'CROSSWALK_OVERLAY' as const,
        color: '#f8f8f6',
        emphasis: 'hero' as const,
        priority: 'hero' as const,
        layer: 'crosswalk_overlay' as const,
        shapeKind: 'stripe_set' as const,
        styleToken: 'scramble_white' as const,
        stripeSet,
      })),
      ...intersection.stopLines.map((path, index) => ({
        objectId: `${intersection.id}-stop-line-${index + 1}`,
        intersectionId: intersection.intersectionId,
        type: 'STOP_LINE' as const,
        color: '#ffffff',
        emphasis: 'hero' as const,
        priority: 'hero' as const,
        layer: 'lane_overlay' as const,
        shapeKind: 'path_strip' as const,
        styleToken: 'stopline_white' as const,
        path,
      })),
      ...intersection.laneArrows.map((polygon, index) => ({
        objectId: `${intersection.id}-arrow-${index + 1}`,
        intersectionId: intersection.intersectionId,
        type: 'ARROW_MARK' as const,
        color: '#f7f2a2',
        emphasis: 'hero' as const,
        priority: 'hero' as const,
        layer: 'junction_overlay' as const,
        shapeKind: 'arrow_glyph' as const,
        styleToken: 'arrow_yellow' as const,
        polygon,
      })),
      ...(intersection.junctionPaint
        ? [
            {
              objectId: `${intersection.id}-junction-paint`,
              intersectionId: intersection.intersectionId,
              type: 'JUNCTION_OVERLAY' as const,
              color: '#eadb87',
              emphasis: 'hero' as const,
              priority: 'hero' as const,
              layer: 'junction_overlay' as const,
              shapeKind: 'polygon_fill' as const,
              styleToken: 'junction_amber' as const,
              polygon: intersection.junctionPaint,
            },
          ]
        : []),
    ]);
  }
}

function mergeByObjectId<T extends { objectId: string }>(base: T[], overrides: T[]): T[] {
  const map = new Map<string, T>();
  for (const item of base) {
    map.set(item.objectId, item);
  }
  for (const item of overrides) {
    map.set(item.objectId, item);
  }
  return [...map.values()];
}

function summarizeMaterialClasses(facadeHints: SceneFacadeHint[]) {
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
    current.palette = [...new Set([...current.palette, ...hint.palette])].slice(0, 3);
    grouped.set(hint.materialClass, current);
  }

  return [...grouped.entries()].map(([className, value]) => ({
    className,
    palette: value.palette,
    buildingCount: value.buildingCount,
  }));
}

function clampCoverage(value: number): number {
  return Math.max(0, Math.min(1, Number(value.toFixed(2))));
}

function resolveIntersectionProfile(
  profile: HeroOverrideManifest['intersectionOverrides'][number]['profile'],
): IntersectionProfile {
  if (profile === 'scramble_primary' || profile === 'scramble_secondary') {
    return 'scramble_major';
  }
  return 'signalized_standard';
}

function resolveCrossingProfile(
  principal: boolean,
  style: HeroOverrideManifest['crossings'][number]['style'],
): IntersectionProfile {
  if (principal) {
    return 'scramble_major';
  }
  if (style === 'signalized') {
    return 'signalized_standard';
  }
  return 'minor_crossing';
}

function buildPlaceReadabilityDiagnostics(
  buildings: SceneMeta['buildings'],
  facadeHints: SceneFacadeHint[],
  roadDecals: SceneRoadDecal[],
  streetFurniture: SceneDetail['streetFurniture'],
  streetFurnitureRowCount: number,
) {
  const heroBuildings = buildings.filter(
    (building) => building.visualRole && building.visualRole !== 'generic',
  ).length;
  const heroIntersections = roadDecals.filter(
    (decal) =>
      decal.priority === 'hero' &&
      decal.layer === 'crosswalk_overlay' &&
      (decal.shapeKind === 'stripe_set' || decal.shapeKind === 'polygon_fill'),
  ).reduce((ids, decal) => {
    ids.add(decal.intersectionId ?? decal.objectId.replace(/-(crosswalk-poly|stripe-set|scramble-polygon|scramble-stripes).*/, ''));
    return ids;
  }, new Set<string>()).size;
  const scrambleStripeCount = roadDecals.reduce(
    (total, decal) => total + (decal.stripeSet?.stripeCount ?? 0),
    0,
  );
  const billboardPlaneCount = facadeHints.reduce(
    (total, hint) => total + (hint.signageSpec?.billboardFaces.length ?? 0),
    0,
  );
  const canopyCount = facadeHints.reduce(
    (total, hint) => total + (hint.podiumSpec?.canopyEdges.length ?? 0),
    0,
  );
  const roofUnitCount = facadeHints.reduce(
    (total, hint) => total + (hint.roofSpec?.roofUnits ?? 0),
    0,
  );
  const emissiveZoneCount = facadeHints.reduce(
    (total, hint) => total + (hint.signageSpec?.emissiveZones ?? 0),
    0,
  );

  return {
    heroBuildingCount: heroBuildings,
    heroIntersectionCount: heroIntersections,
    scrambleStripeCount,
    billboardPlaneCount,
    canopyCount,
    roofUnitCount,
    emissiveZoneCount,
    streetFurnitureRowCount:
      streetFurnitureRowCount > 0 ? streetFurnitureRowCount : Math.ceil(streetFurniture.length / 2),
  };
}
