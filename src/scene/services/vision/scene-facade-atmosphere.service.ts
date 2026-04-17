import { Injectable } from '@nestjs/common';
import type {
  DistrictAtmosphereProfile,
  MaterialClass,
  SceneDetail,
  SceneFacadeContextDiagnostics,
  SceneFacadeHint,
  SceneWideAtmosphereProfile,
} from '../../types/scene.types';
import { resolveSceneStaticAtmosphereProfile } from '../../utils/scene-static-atmosphere.utils';
import {
  resolveDistrictAtmosphereProfile,
  resolveSceneWideAtmosphereProfile as resolveSceneWideAtmosphereProfileImpl,
} from './scene-atmosphere-district.utils';
import { uniquePalette } from './scene-facade-vision.utils';
import { resolveEvidenceStrengthFromScore } from './scene-facade-vision.helpers';

@Injectable()
export class SceneFacadeAtmosphereService {
  summarizeMaterialClasses(facadeHints: SceneFacadeHint[]) {
    const buckets = new Map<
      MaterialClass,
      { count: number; palette: string[] }
    >();

    for (const hint of facadeHints) {
      const current = buckets.get(hint.materialClass) ?? {
        count: 0,
        palette: [],
      };
      current.count += 1;
      current.palette = uniquePalette([...current.palette, ...hint.palette], 4);
      buckets.set(hint.materialClass, current);
    }

    return [...buckets.entries()].map(([className, value]) => ({
      className,
      palette: value.palette.slice(0, 3),
      buildingCount: value.count,
    }));
  }

  summarizeFacadeContextDiagnostics(
    facadeHints: SceneFacadeHint[],
    placePackage: import('../../../places/types/place.types').PlacePackage,
  ): SceneFacadeContextDiagnostics {
    const profileCounts = new Map<string, number>();
    const materialCounts = new Map<string, number>();
    const profileMaterialCounts = new Map<string, number>();
    const districtClusterCounts = new Map<string, number>();
    const evidenceStrengthCounts = new Map<string, number>();

    for (const hint of facadeHints) {
      const profile = hint.contextProfile ?? 'UNKNOWN';
      const material = hint.materialClass;
      profileCounts.set(profile, (profileCounts.get(profile) ?? 0) + 1);
      materialCounts.set(material, (materialCounts.get(material) ?? 0) + 1);
      profileMaterialCounts.set(
        `${profile}:${material}`,
        (profileMaterialCounts.get(`${profile}:${material}`) ?? 0) + 1,
      );
      if (hint.districtCluster) {
        districtClusterCounts.set(
          hint.districtCluster,
          (districtClusterCounts.get(hint.districtCluster) ?? 0) + 1,
        );
      }
      if (hint.evidenceStrength) {
        evidenceStrengthCounts.set(
          hint.evidenceStrength,
          (evidenceStrengthCounts.get(hint.evidenceStrength) ?? 0) + 1,
        );
      }
    }

    const explicitColorBuildingCount = placePackage.buildings.filter(
      (building) => building.facadeColor != null,
    ).length;
    const weakEvidenceCount = facadeHints.filter(
      (hint) => hint.weakEvidence,
    ).length;
    const weakEvidenceRatio =
      facadeHints.length > 0
        ? Number((weakEvidenceCount / facadeHints.length).toFixed(3))
        : 0;

    return {
      weakEvidenceCount,
      weakEvidenceRatio,
      contextualUpgradeCount: facadeHints.filter(
        (hint) => hint.contextualMaterialUpgrade,
      ).length,
      explicitColorBuildingCount,
      profileCounts: sortCounts(profileCounts),
      materialCounts: sortCounts(materialCounts),
      profileMaterialCounts: sortCounts(profileMaterialCounts).slice(0, 12),
      districtClusterCounts: sortCounts(districtClusterCounts),
      evidenceStrengthCounts: sortCounts(evidenceStrengthCounts),
    };
  }

  buildDistrictAtmosphereProfiles(
    facadeHints: SceneFacadeHint[],
  ): DistrictAtmosphereProfile[] {
    const grouped = new Map<
      NonNullable<SceneFacadeHint['districtCluster']>,
      {
        confidenceAccumulator: number;
        evidenceScore: number;
        count: number;
      }
    >();

    for (const hint of facadeHints) {
      if (!hint.districtCluster) {
        continue;
      }
      const current = grouped.get(hint.districtCluster) ?? {
        confidenceAccumulator: 0,
        evidenceScore: 0,
        count: 0,
      };
      current.count += 1;
      current.confidenceAccumulator +=
        typeof hint.districtConfidence === 'number'
          ? clamp(hint.districtConfidence, 0, 1)
          : hint.weakEvidence
            ? 0.42
            : 0.74;
      current.evidenceScore += rankEvidence(hint.evidenceStrength);
      grouped.set(hint.districtCluster, current);
    }

    return [...grouped.entries()]
      .map(([cluster, stats]) => {
        const confidence =
          stats.confidenceAccumulator / Math.max(1, stats.count);
        const evidenceStrength = resolveEvidenceStrengthFromScore(
          stats.evidenceScore / Math.max(1, stats.count),
        );
        return {
          ...resolveDistrictAtmosphereProfile(
            cluster,
            confidence,
            evidenceStrength,
          ),
          buildingCount: stats.count,
        };
      })
      .sort((a, b) => b.buildingCount - a.buildingCount);
  }

  resolveSceneWideAtmosphereProfile(
    districtProfiles: DistrictAtmosphereProfile[],
  ): SceneWideAtmosphereProfile {
    return resolveSceneWideAtmosphereProfileImpl(districtProfiles);
  }

  refreshAtmosphereProfiles(
    detail: SceneDetail,
  ): Pick<
    SceneDetail,
    | 'districtAtmosphereProfiles'
    | 'sceneWideAtmosphereProfile'
    | 'staticAtmosphere'
  > {
    const districtAtmosphereProfiles = this.buildDistrictAtmosphereProfiles(
      detail.facadeHints,
    );
    const sceneWideAtmosphereProfile = this.resolveSceneWideAtmosphereProfile(
      districtAtmosphereProfiles,
    );
    const staticAtmosphere = resolveSceneStaticAtmosphereProfile(detail);

    return {
      districtAtmosphereProfiles,
      sceneWideAtmosphereProfile,
      staticAtmosphere,
    };
  }
}

function rankEvidence(
  value: SceneFacadeHint['evidenceStrength'],
): number {
  if (value === 'strong') {
    return 3;
  }
  if (value === 'medium') {
    return 2;
  }
  if (value === 'weak') {
    return 1;
  }
  return 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function sortCounts(map: Map<string, number>): Array<{
  key: string;
  count: number;
}> {
  return [...map.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}
