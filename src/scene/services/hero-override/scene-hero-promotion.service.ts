import { Injectable } from '@nestjs/common';
import { averageCoordinate } from '../../../common/geo/coordinate-utils.utils';
import { distanceMeters } from '../../../common/geo/distance.utils';
import { AppLoggerService } from '../../../common/logging/app-logger.service';
import {
  LandmarkAnnotationManifest,
  SceneDetail,
  SceneFacadeHint,
  SceneMeta,
} from '../../types/scene.types';

@Injectable()
export class SceneHeroPromotionService {
  constructor(private readonly appLoggerService: AppLoggerService) {}

  promoteContextualHeroBuildings(
    meta: SceneMeta,
    detail: SceneDetail,
    manifestId: string,
  ): void {
    const targetHeroCount = Math.max(
      4,
      Math.ceil(meta.assetProfile.selected.buildingCount * 0.3),
    );
    const existingHero = meta.buildings.filter(
      (building) => building.visualRole && building.visualRole !== 'generic',
    );
    const promoteCount = Math.max(0, targetHeroCount - existingHero.length);
    if (promoteCount === 0) {
      return;
    }

    const hintByObjectId = new Map(
      detail.facadeHints.map((hint) => [hint.objectId, hint]),
    );
    const heroAnchorPoints = existingHero
      .map((building) => averageCoordinate(building.outerRing) ?? null)
      .filter((point): point is { lat: number; lng: number } => Boolean(point));
    const candidates = meta.buildings
      .filter(
        (building) =>
          !existingHero.some((hero) => hero.objectId === building.objectId),
      )
      .map((building) => {
        const center =
          averageCoordinate(building.outerRing) ?? building.outerRing[0];
        const hint = hintByObjectId.get(building.objectId);
        if (!hint) {
          return {
            building,
            hint,
            score: Number.NEGATIVE_INFINITY,
            passesEvidenceGate: false,
          };
        }
        const nearestHeroDistance = heroAnchorPoints.length
          ? Math.min(
              ...heroAnchorPoints.map((anchor) =>
                distanceMeters(anchor, center),
              ),
            )
          : 0;
        const passesEvidenceGate =
          !hint.weakEvidence &&
          (hint.evidenceStrength === 'strong' ||
            hint.evidenceStrength === 'medium' ||
            hint.signageDensity === 'high' ||
            (hint.emissiveStrength ?? 0) >= 0.6);
        const score =
          (hint?.billboardEligible ? 2.8 : 0) +
          (hint?.signageDensity === 'high'
            ? 2.1
            : hint?.signageDensity === 'medium'
              ? 1.1
              : 0.3) +
          (hint?.emissiveStrength ?? 0) * 1.8 +
          (building.heightMeters >= 36
            ? 1.9
            : building.heightMeters >= 24
              ? 1.2
              : 0.5) +
          (building.usage === 'COMMERCIAL' ? 1.6 : 0.6) +
          (hint?.districtCluster === 'landmark_plaza' ? 1.6 : 0) +
          (hint?.districtCluster === 'station_district' ? 1.1 : 0) +
          (hint?.contextProfile === 'NEON_CORE' ? 0.9 : 0) +
          (hint?.districtCluster === 'secondary_retail' ? 0.6 : 0) +
          (hint?.evidenceStrength === 'strong'
            ? 0.8
            : hint?.evidenceStrength === 'medium'
              ? 0.45
              : 0) -
          Math.min(2.2, nearestHeroDistance / 180);
        return { building, hint, score, passesEvidenceGate };
      })
      .filter((item) => item.passesEvidenceGate)
      .sort((a, b) => b.score - a.score)
      .slice(0, promoteCount);

    if (candidates.length === 0) {
      return;
    }

    const promotedIds = new Set(
      candidates.map((item) => item.building.objectId),
    );
    const promotedHints = new Map(
      candidates
        .filter((item) => item.hint)
        .map((item) => [item.building.objectId, item.hint!]),
    );

    meta.buildings = meta.buildings.map((building) => {
      if (!promotedIds.has(building.objectId)) {
        return building;
      }
      return {
        ...building,
        visualRole: 'edge_landmark',
        emissiveBandStrength: Math.max(
          0.62,
          building.emissiveBandStrength ?? 0.38,
        ),
        signBandLevels: Math.max(2, building.signBandLevels ?? 0),
      };
    });
    detail.facadeHints = detail.facadeHints.map((hint) => {
      if (!promotedIds.has(hint.objectId)) {
        return hint;
      }
      const source = promotedHints.get(hint.objectId);
      return {
        ...hint,
        visualRole: 'edge_landmark',
        signageDensity:
          source?.signageDensity === 'low'
            ? 'medium'
            : (source?.signageDensity ?? hint.signageDensity),
        emissiveStrength: Math.max(
          0.78,
          source?.emissiveStrength ?? hint.emissiveStrength,
        ),
        evidenceStrength:
          hint.evidenceStrength === 'weak' ? 'medium' : hint.evidenceStrength,
        contextualMaterialUpgrade: true,
      };
    });
    detail.annotationsApplied = [
      ...detail.annotationsApplied,
      `${manifestId}:auto-hero-promotion:${candidates.length}`,
    ];

    const updatedHeroCount = meta.buildings.filter(
      (building) => building.visualRole && building.visualRole !== 'generic',
    ).length;
    meta.assetProfile = {
      ...meta.assetProfile,
      selected: {
        ...meta.assetProfile.selected,
        buildingCount: Math.max(
          meta.assetProfile.selected.buildingCount,
          updatedHeroCount,
        ),
      },
    };

    const weakEvidencePromoted = candidates.filter(
      (item) => item.hint?.weakEvidence,
    ).length;
    const promotionAudit = {
      manifestId,
      promotedCount: candidates.length,
      weakEvidencePromoted,
      evidenceGateApplied: true,
      candidateScores: candidates.map((item) => ({
        objectId: item.building.objectId,
        score: Number(item.score.toFixed(3)),
        weakEvidence: item.hint?.weakEvidence ?? false,
        evidenceAccepted: item.passesEvidenceGate,
      })),
    };
    this.appLoggerService.info('scene.hero_promotion.audit', {
      sceneId: meta.sceneId,
      step: 'hero_promotion',
      ...promotionAudit,
    });
  }
}
