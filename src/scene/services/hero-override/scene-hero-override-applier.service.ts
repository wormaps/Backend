import { Injectable } from '@nestjs/common';
import { AppLoggerService } from '../../../common/logging/app-logger.service';
import { midpoint } from '../../../places/utils/geo.utils';
import {
  BuildingFacadeSpec,
  BuildingPodiumSpec,
  BuildingRoofSpec,
  BuildingSignageSpec,
  IntersectionProfile,
  LandmarkAnnotationManifest,
  SceneDetail,
  SceneFacadeHint,
  SceneMeta,
  SceneRoadDecal,
} from '../../types/scene.types';
import { appendSceneDiagnosticsLog } from '../../storage/scene-storage.utils';
import { SceneHeroOverrideMatcherService } from './scene-hero-override-matcher.service';

@Injectable()
export class SceneHeroOverrideApplierService {
  constructor(
    private readonly matcher: SceneHeroOverrideMatcherService = new SceneHeroOverrideMatcherService(),
    private readonly appLoggerService: AppLoggerService = new AppLoggerService(),
  ) {}

  apply(
    meta: SceneMeta,
    detail: SceneDetail,
    manifest: LandmarkAnnotationManifest,
  ): { meta: SceneMeta; detail: SceneDetail } {
    const landmarkAssignments = this.matcher.resolveLandmarkAssignments(
      meta,
      manifest,
    );
    const annotatedBuildings = this.applyLandmarkAnnotations(
      meta.buildings,
      landmarkAssignments,
    );
    const facadeHints = this.mergeFacadeHints(
      annotatedBuildings,
      detail,
      landmarkAssignments,
    );
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
        principal: crossing.importance === 'primary',
        style: crossing.style,
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
    const streetFurniture = mergeByObjectId(
      detail.streetFurniture,
      manifest.streetFurnitureRows.flatMap((row) =>
        row.points.map((point, pointIndex) => ({
          objectId: `${row.id}-${pointIndex + 1}`,
          name: `${row.id}-${pointIndex + 1}`,
          type: row.type,
          location: point,
          principal: row.principal ?? false,
        })),
      ),
    );
    const roadDecals = mergeByObjectId(
      detail.roadDecals ?? [],
      this.buildCrossingDecals(manifest),
    );
    const intersectionProfiles = mergeByObjectId(
      detail.intersectionProfiles ?? [],
      manifest.crossings.map((crossing) => ({
        objectId: `${crossing.id}-intersection`,
        anchor: midpoint(crossing.path) ?? crossing.path[0],
        profile: resolveCrossingProfile(crossing.importance, crossing.style),
        crossingObjectIds: [crossing.id],
      })),
    );
    const landmarkAnchors = mergeByObjectId(
      meta.landmarkAnchors,
      manifest.landmarks.map((landmark) => ({
        objectId: landmark.objectId ?? landmark.id,
        name: landmark.name,
        location: landmark.anchor,
        kind: landmark.kind,
      })),
    );
    const annotationsApplied = [
      ...detail.annotationsApplied,
      manifest.id,
      ...manifest.landmarks.map((item) => item.id),
      ...manifest.crossings.map((item) => item.id),
      ...manifest.signageClusters.map((item) => item.id),
    ];

    const structuralCoverage = {
      ...meta.structuralCoverage,
      heroLandmarkCoverage: 1,
    };
    const mergedDetail: SceneDetail = {
      ...detail,
      detailStatus:
        detail.detailStatus === 'OSM_ONLY' ? 'PARTIAL' : detail.detailStatus,
      crossings,
      streetFurniture,
      facadeHints,
      signageClusters,
      intersectionProfiles,
      roadDecals,
      placeReadabilityDiagnostics: buildPlaceReadabilityDiagnostics(
        annotatedBuildings,
        facadeHints,
        roadDecals,
        streetFurniture,
        manifest.streetFurnitureRows.length,
      ),
      annotationsApplied,
      structuralCoverage,
      provenance: {
        ...detail.provenance,
        overrideCount: annotationsApplied.length,
      },
    };

    const mergedMeta: SceneMeta = {
      ...meta,
      buildings: annotatedBuildings,
      detailStatus: mergedDetail.detailStatus,
      landmarkAnchors,
      structuralCoverage,
      materialClasses: summarizeMaterialClasses(facadeHints),
      visualCoverage: {
        structure: meta.visualCoverage.structure,
        streetDetail: clampCoverage(meta.visualCoverage.streetDetail + 0.2),
        landmark: clampCoverage(meta.visualCoverage.landmark + 0.25),
        signage: clampCoverage(meta.visualCoverage.signage + 0.2),
      },
    };

    const payload = {
      manifestId: manifest.id,
      assignedLandmarks: [...landmarkAssignments.keys()],
      addedCrossings: manifest.crossings.length,
      addedSignageClusters: manifest.signageClusters.length,
      addedStreetFurnitureRows: manifest.streetFurnitureRows.length,
      annotationsApplied: annotationsApplied.length,
      structuralCoverage,
    };
    this.appLoggerService.info('scene.annotation_manifest.applied', {
      sceneId: meta.sceneId,
      step: 'annotation_manifest',
      ...payload,
    });
    void appendSceneDiagnosticsLog(
      meta.sceneId,
      'annotation_manifest',
      payload,
    );

    return {
      meta: mergedMeta,
      detail: mergedDetail,
    };
  }

  private applyLandmarkAnnotations(
    buildings: SceneMeta['buildings'],
    landmarkAssignments: Map<
      string,
      LandmarkAnnotationManifest['landmarks'][number]
    >,
  ): SceneMeta['buildings'] {
    return buildings.map((building) => {
      const annotation = landmarkAssignments.get(building.objectId);
      if (!annotation) {
        return building;
      }

      const enhancement = buildHeroEnhancement(building, annotation);
      return {
        ...building,
        visualRole:
          annotation.facadeHint?.visualRole ??
          (annotation.importance === 'primary'
            ? 'hero_landmark'
            : 'edge_landmark'),
        facadeColor:
          annotation.facadeHint?.shellPalette?.[0] ?? building.facadeColor,
        emissiveBandStrength:
          annotation.facadeHint?.emissiveStrength ??
          building.emissiveBandStrength,
        baseMass: enhancement.baseMass,
        podiumSpec: enhancement.podiumSpec,
        signageSpec: enhancement.signageSpec,
        roofSpec: enhancement.roofSpec,
        facadeSpec: enhancement.facadeSpec,
      };
    });
  }

  private mergeFacadeHints(
    buildings: SceneMeta['buildings'],
    detail: SceneDetail,
    landmarkAssignments: Map<
      string,
      LandmarkAnnotationManifest['landmarks'][number]
    >,
  ): SceneFacadeHint[] {
    const annotationHints = [...landmarkAssignments.entries()].map(
      ([objectId, annotation]) => {
        const matchedBuilding =
          buildings.find((building) => building.objectId === objectId) ?? null;
        const buildingHeight = matchedBuilding?.heightMeters ?? 12;
        const facadeHint = annotation.facadeHint;
        const contextProfile: SceneFacadeHint['contextProfile'] =
          annotation.importance === 'primary'
            ? 'NEON_CORE'
            : 'COMMERCIAL_STRIP';
        const districtCluster: SceneFacadeHint['districtCluster'] =
          annotation.kind === 'PLAZA'
            ? 'landmark_plaza'
            : annotation.importance === 'primary'
              ? 'landmark_plaza'
              : 'secondary_retail';
        const evidenceStrength: SceneFacadeHint['evidenceStrength'] = 'strong';
        const inheritedFacadeEdgeIndex = detail.facadeHints.find(
          (item) => item.objectId === objectId,
        )?.facadeEdgeIndex;

        return {
          objectId,
          anchor: annotation.anchor,
          facadeEdgeIndex:
            facadeHint?.facadeEdgeIndex ?? inheritedFacadeEdgeIndex ?? null,
          windowBands: Math.max(2, Math.floor(buildingHeight / 3.4)),
          billboardEligible:
            annotation.kind === 'BUILDING' &&
            annotation.importance === 'primary',
          palette:
            facadeHint?.palette ??
            (matchedBuilding?.facadeColor
              ? [matchedBuilding.facadeColor]
              : ['#b8c0c8']),
          shellPalette: facadeHint?.shellPalette,
          panelPalette: facadeHint?.panelPalette,
          materialClass: facadeHint?.materialClass ?? 'mixed',
          signageDensity: facadeHint?.signageDensity ?? 'medium',
          emissiveStrength: facadeHint?.emissiveStrength ?? 0.55,
          glazingRatio: facadeHint?.glazingRatio ?? 0.3,
          visualArchetype: matchedBuilding?.visualArchetype,
          geometryStrategy: matchedBuilding?.geometryStrategy,
          facadePreset: matchedBuilding?.facadePreset,
          podiumLevels: matchedBuilding?.podiumLevels,
          setbackLevels: matchedBuilding?.setbackLevels,
          cornerChamfer: matchedBuilding?.cornerChamfer,
          roofAccentType: matchedBuilding?.roofAccentType,
          windowPatternDensity: matchedBuilding?.windowPatternDensity,
          signBandLevels: matchedBuilding?.signBandLevels,
          visualRole:
            facadeHint?.visualRole ??
            (annotation.importance === 'primary'
              ? 'hero_landmark'
              : 'edge_landmark'),
          facadeSpec: matchedBuilding?.facadeSpec,
          podiumSpec: matchedBuilding?.podiumSpec,
          signageSpec: matchedBuilding?.signageSpec,
          roofSpec: matchedBuilding?.roofSpec,
          contextProfile,
          districtCluster,
          districtConfidence: annotation.importance === 'primary' ? 0.95 : 0.78,
          evidenceStrength,
          contextualMaterialUpgrade: true,
          weakEvidence: false,
        };
      },
    );

    return mergeByObjectId(detail.facadeHints, annotationHints);
  }

  private buildCrossingDecals(
    manifest: LandmarkAnnotationManifest,
  ): SceneRoadDecal[] {
    return manifest.crossings.map((crossing) => ({
      objectId: `${crossing.id}-stripe`,
      intersectionId: `${crossing.id}-intersection`,
      type: 'CROSSWALK_OVERLAY',
      color: '#f8f8f6',
      emphasis: crossing.importance === 'primary' ? 'hero' : 'standard',
      priority: crossing.importance === 'primary' ? 'hero' : 'standard',
      layer: 'crosswalk_overlay',
      shapeKind: 'path_strip',
      styleToken: 'scramble_white',
      path: crossing.path,
    }));
  }
}

function mergeByObjectId<T extends { objectId: string }>(
  base: T[],
  overrides: T[],
): T[] {
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

function buildHeroEnhancement(
  building: SceneMeta['buildings'][number],
  annotation: LandmarkAnnotationManifest['landmarks'][number],
): {
  baseMass: SceneMeta['buildings'][number]['baseMass'];
  podiumSpec?: BuildingPodiumSpec;
  signageSpec?: BuildingSignageSpec;
  roofSpec?: BuildingRoofSpec;
  facadeSpec?: BuildingFacadeSpec;
} {
  const dominantEdgeIndex = resolveLongestEdgeIndex(building.outerRing);
  const adjacentEdgeIndex =
    (dominantEdgeIndex + 1) % Math.max(1, building.outerRing.length);
  const heroPrimary = annotation.importance === 'primary';
  const visualRole =
    annotation.facadeHint?.visualRole ??
    (heroPrimary ? 'hero_landmark' : 'edge_landmark');
  const signBandLevels = heroPrimary
    ? Math.max(3, building.signBandLevels ?? 3)
    : 2;
  const podiumSpec: BuildingPodiumSpec | undefined =
    annotation.kind === 'BUILDING'
      ? {
          levels: heroPrimary ? 4 : 3,
          setbacks: heroPrimary ? 3 : 2,
          cornerChamfer: building.cornerChamfer ?? heroPrimary,
          canopyEdges:
            visualRole === 'hero_landmark' || visualRole === 'retail_edge'
              ? [dominantEdgeIndex, adjacentEdgeIndex]
              : [dominantEdgeIndex],
        }
      : undefined;
  const signageSpec: BuildingSignageSpec | undefined =
    annotation.kind === 'BUILDING'
      ? {
          billboardFaces: [dominantEdgeIndex],
          signBandLevels,
          screenFaces: [dominantEdgeIndex],
          emissiveZones: heroPrimary ? 4 : 2,
        }
      : undefined;
  const roofSpec: BuildingRoofSpec | undefined =
    annotation.kind === 'BUILDING'
      ? {
          roofUnits: heroPrimary ? 6 : 3,
          crownType: heroPrimary ? 'screen_crown' : 'parapet_crown',
          parapet: true,
        }
      : undefined;
  const facadeSpec: BuildingFacadeSpec | undefined =
    annotation.kind === 'BUILDING'
      ? {
          atlasId: `${annotation.id}-facade`,
          uvMode: 'placeholder',
          emissiveMaskId: heroPrimary ? `${annotation.id}-emissive` : null,
          facadePattern:
            visualRole === 'station_edge'
              ? 'retail_screen'
              : visualRole === 'retail_edge'
                ? 'retail_screen'
                : 'curtain_wall',
          lowerBandType:
            visualRole === 'station_edge' ? 'screen_band' : 'retail_sign_band',
          midBandType:
            building.facadePreset === 'glass_grid'
              ? 'window_grid'
              : 'solid_panel',
          topBandType: heroPrimary ? 'screen_band' : 'window_grid',
          windowRepeatX: heroPrimary ? 10 : 7,
          windowRepeatY: heroPrimary ? 15 : 10,
        }
      : undefined;

  return {
    baseMass: heroPrimary
      ? 'corner_tower'
      : (building.baseMass ?? 'podium_tower'),
    podiumSpec,
    signageSpec,
    roofSpec,
    facadeSpec,
  };
}

function resolveLongestEdgeIndex(ring: { lat: number; lng: number }[]): number {
  if (ring.length < 2) {
    return 0;
  }
  let longestIndex = 0;
  let longestLength = 0;
  for (let index = 0; index < ring.length; index += 1) {
    const current = ring[index];
    const next = ring[(index + 1) % ring.length];
    const length = Math.hypot(next.lng - current.lng, next.lat - current.lat);
    if (length > longestLength) {
      longestLength = length;
      longestIndex = index;
    }
  }
  return longestIndex;
}

function clampCoverage(value: number): number {
  return Math.max(0, Math.min(1, Number(value.toFixed(2))));
}

function resolveCrossingProfile(
  importance: LandmarkAnnotationManifest['crossings'][number]['importance'],
  style: LandmarkAnnotationManifest['crossings'][number]['style'],
): IntersectionProfile {
  if (importance === 'primary') {
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
