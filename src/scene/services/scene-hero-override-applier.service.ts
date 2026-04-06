import { Injectable } from '@nestjs/common';
import { midpoint } from '../../places/utils/geo.utils';
import {
  SceneDetail,
  SceneFacadeHint,
  SceneMeta,
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
    const facadeHints = this.mergeFacadeHints(meta, detail, manifest);
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
      manifest.streetFurniture.map((item) => ({
        objectId: item.id,
        name: item.id,
        type: item.type,
        location: item.location,
        principal: item.principal ?? true,
      })),
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
      manifest.roadDecalOverrides,
    );
    const intersectionProfiles = mergeByObjectId(
      detail.intersectionProfiles ?? [],
      manifest.crossings.map((crossing) => ({
        objectId: `${crossing.id}-intersection`,
        anchor: midpoint(crossing.path) ?? crossing.path[0],
        profile: crossing.principal
          ? 'scramble_major'
          : crossing.style === 'signalized'
            ? 'signalized_standard'
            : 'minor_crossing',
        crossingObjectIds: [crossing.id],
      })),
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
      heroOverridesApplied,
      provenance: {
        ...detail.provenance,
        overrideCount: heroOverridesApplied.length,
      },
    };

    const mergedMeta: SceneMeta = {
      ...meta,
      buildings: this.applyBuildingOverrides(meta.buildings, manifest),
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
    manifest: HeroOverrideManifest,
  ): SceneFacadeHint[] {
    const overridden = manifest.facadeOverrides.map((override) => {
      const matchedBuilding = this.matcher.findMatchingBuilding(meta, override);
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
        weakEvidence: false,
      };
    });

    return mergeByObjectId(detail.facadeHints, overridden);
  }

  private applyBuildingOverrides(
    buildings: SceneMeta['buildings'],
    manifest: HeroOverrideManifest,
  ): SceneMeta['buildings'] {
    return buildings.map((building) => {
      const override = this.matcher.findApplicableFacadeOverride(building, manifest);
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
      };
    });
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
